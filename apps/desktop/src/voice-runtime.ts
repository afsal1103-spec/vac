import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  VoiceEngineCoordinator,
  VoiceSidecar,
  type PipelineEvent,
  type VoicePipelineConfig,
  type VoiceProvider,
  type SttChunk,
  type TtsChunk
} from '@vac/voice-engine';

export type { VoiceProvider, VoicePipelineConfig, SttChunk, TtsChunk, PipelineEvent };

export type VoiceSession = {
  id: string;
  config: VoicePipelineConfig;
  createdAt: string;
};

export class VoiceRuntime {
  private sessions = new Map<string, VoiceSession & { mode: 'coordinator' | 'sidecar' }>();
  private readonly coordinator = new VoiceEngineCoordinator({
    retryDelayMs: 120,
    defaultSttRetries: 2,
    defaultTtsRetries: 2
  });
  private readonly sidecar = new VoiceSidecar();
  private sidecarHealthy = false;
  private sidecarLastStartedAt: string | null = null;
  private sidecarScriptPath = join(process.cwd(), 'services', 'agent', 'sidecar.py');
  private sidecarCwd = join(process.cwd(), 'services', 'agent');

  constructor(private readonly onEvent: (sessionId: string, event: PipelineEvent) => void) {
    this.coordinator.on('event', (payload: { sessionId: string; event: PipelineEvent }) => {
      this.onEvent(payload.sessionId, payload.event);
    });

    this.coordinator.on('status', (payload: { sessionId: string; message: string }) => {
      this.onEvent(payload.sessionId, { type: 'status', message: payload.message });
    });

    this.sidecar.on('message', (message: Record<string, unknown>) => {
      this.handleSidecarMessage(message);
    });

    this.sidecar.on('stderr', (line: string) => {
      this.broadcastToSidecarSessions({ type: 'status', message: `Voice sidecar stderr: ${line}` });
    });

    this.sidecar.on('error', (detail: string) => {
      this.sidecarHealthy = false;
      this.broadcastToSidecarSessions({ type: 'error', message: `Voice sidecar error: ${detail}` });
    });

    this.sidecar.on('exit', () => {
      this.sidecarHealthy = false;
      this.broadcastToSidecarSessions({ type: 'error', message: 'Voice sidecar exited unexpectedly.' });
    });
  }

  async startSession(config: VoicePipelineConfig): Promise<VoiceSession> {
    const normalizedConfig = this.normalizeConfig(config);
    const useSidecar = this.shouldUseSidecar(normalizedConfig);
    const session: VoiceSession = {
      id: `voice_${randomUUID()}`,
      config: normalizedConfig,
      createdAt: new Date().toISOString()
    };

    if (useSidecar) {
      try {
        await this.ensureSidecarHealthy();
        this.sidecar.send({
          type: 'session_start',
          sessionId: session.id,
          config: normalizedConfig
        });
        this.sessions.set(session.id, { ...session, mode: 'sidecar' });
        this.emit(session.id, {
          type: 'status',
          message: `Voice session started via sidecar (${normalizedConfig.provider}, ${normalizedConfig.voiceId})`
        });
        return session;
      } catch (error) {
        this.emit(session.id, {
          type: 'error',
          message: `Sidecar start failed, falling back to coordinator: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }

    await this.coordinator.createSession(session.id, normalizedConfig);
    this.sessions.set(session.id, { ...session, mode: 'coordinator' });
    this.emit(session.id, {
      type: 'status',
      message: `Voice session started (${normalizedConfig.provider}, ${normalizedConfig.voiceId}, quality=${normalizedConfig.qualityProfile ?? 'balanced'})`
    });
    return session;
  }

  async stopSession(sessionId: string): Promise<void> {
    const session = this.requireSession(sessionId);
    if (session.mode === 'sidecar' && this.sidecar.isRunning()) {
      this.sidecar.send({ type: 'session_stop', sessionId });
    } else {
      await this.coordinator.stopSession(sessionId);
    }
    this.sessions.delete(sessionId);
    this.emit(sessionId, {
      type: 'status',
      message: 'Voice session stopped'
    });
  }

  async pushMicAudio(sessionId: string, audioBase64: string): Promise<SttChunk[]> {
    const session = this.requireSession(sessionId);
    if (!audioBase64.trim()) return [];
    if (session.mode === 'sidecar') {
      try {
        await this.ensureSidecarHealthy();
        this.sidecar.send({
          type: 'push_mic',
          sessionId,
          audioBase64,
          language: session.config.language
        });
        return [];
      } catch (error) {
        this.emit(sessionId, {
          type: 'error',
          message: `Sidecar mic push failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
        await this.migrateSidecarSessionToCoordinator(session);
      }
    }
    return this.coordinator.pushMicAudio(sessionId, audioBase64);
  }

  async synthesizeText(sessionId: string, text: string, isFinal: boolean): Promise<TtsChunk[]> {
    const session = this.requireSession(sessionId);
    const trimmed = text.trim();
    if (!trimmed) return [];
    if (session.mode === 'sidecar') {
      try {
        await this.ensureSidecarHealthy();
        this.sidecar.send({
          type: 'speak_text',
          sessionId,
          text: trimmed,
          isFinal,
          voiceId: session.config.voiceId
        });
        return [];
      } catch (error) {
        this.emit(sessionId, {
          type: 'error',
          message: `Sidecar TTS failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
        await this.migrateSidecarSessionToCoordinator(session);
      }
    }
    return this.coordinator.pushLlmChunk(sessionId, { text: trimmed, isFinal });
  }

  private emit(sessionId: string, event: PipelineEvent) {
    this.onEvent(sessionId, event);
  }

  private requireSession(sessionId: string): VoiceSession & { mode: 'coordinator' | 'sidecar' } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Voice session ${sessionId} was not found.`);
    }
    return session;
  }

  private normalizeConfig(config: VoicePipelineConfig): VoicePipelineConfig {
    const fallbackProviders = config.fallbackProviders?.length
      ? config.fallbackProviders
      : config.provider === 'local'
        ? (['deepgram-elevenlabs'] as VoiceProvider[])
        : (['local'] as VoiceProvider[]);

    return {
      ...config,
      qualityProfile: config.qualityProfile ?? 'balanced',
      noiseSuppression: config.noiseSuppression ?? true,
      echoCancellation: config.echoCancellation ?? true,
      autoGainControl: config.autoGainControl ?? true,
      sttMaxRetries: config.sttMaxRetries ?? 2,
      ttsMaxRetries: config.ttsMaxRetries ?? 2,
      fallbackProviders
    };
  }

  private shouldUseSidecar(config: VoicePipelineConfig): boolean {
    return config.provider === 'deepgram-elevenlabs';
  }

  private async ensureSidecarHealthy() {
    if (!existsSync(this.sidecarScriptPath)) {
      throw new Error(`Sidecar script missing at ${this.sidecarScriptPath}`);
    }

    if (!this.sidecar.isRunning()) {
      const pythonBin = process.env.VAC_PYTHON_BIN || 'python';
      this.sidecar.start(pythonBin, [this.sidecarScriptPath], this.sidecarCwd);
      this.sidecarLastStartedAt = new Date().toISOString();
    }

    if (this.sidecarHealthy) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Sidecar health check timed out.'));
      }, 2000);

      const onMessage = (message: Record<string, unknown>) => {
        if (message.type === 'health_pong') {
          cleanup();
          this.sidecarHealthy = true;
          resolve();
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        this.sidecar.removeListener('message', onMessage);
      };

      this.sidecar.on('message', onMessage);
      this.sidecar.send({ type: 'health_ping' });
    });
  }

  private handleSidecarMessage(message: Record<string, unknown>) {
    const type = String(message.type ?? '').trim();
    const sessionId = typeof message.sessionId === 'string' ? message.sessionId : '';
    if (type === 'health_pong') {
      this.sidecarHealthy = true;
      return;
    }

    if (!sessionId || !this.sessions.has(sessionId)) {
      return;
    }

    if (type === 'status' && typeof message.message === 'string') {
      this.emit(sessionId, { type: 'status', message: message.message });
      return;
    }

    if (type === 'error' && typeof message.message === 'string') {
      this.emit(sessionId, { type: 'error', message: message.message });
      return;
    }

    if (type === 'stt_chunk' && typeof message.chunk === 'object' && message.chunk) {
      this.emit(sessionId, { type: 'stt_chunk', chunk: message.chunk as SttChunk });
      return;
    }

    if (type === 'llm_chunk' && typeof message.chunk === 'object' && message.chunk) {
      const chunk = message.chunk as { text: string; isFinal: boolean };
      this.emit(sessionId, { type: 'llm_chunk', chunk });
      return;
    }

    if (type === 'tts_chunk' && typeof message.chunk === 'object' && message.chunk) {
      this.emit(sessionId, { type: 'tts_chunk', chunk: message.chunk as TtsChunk });
    }
  }

  private broadcastToSidecarSessions(event: PipelineEvent) {
    for (const session of this.sessions.values()) {
      if (session.mode === 'sidecar') {
        this.emit(session.id, event);
      }
    }
  }

  private async migrateSidecarSessionToCoordinator(session: VoiceSession & { mode: 'coordinator' | 'sidecar' }) {
    if (session.mode !== 'sidecar') {
      return;
    }
    await this.coordinator.createSession(session.id, {
      ...session.config,
      provider: 'local'
    });
    this.sessions.set(session.id, { ...session, mode: 'coordinator' });
    this.emit(session.id, {
      type: 'status',
      message: `Session migrated from sidecar to coordinator fallback (local provider).`
    });
  }
}
