import { randomUUID } from 'node:crypto';
import {
  VoiceEngineCoordinator,
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
  private sessions = new Map<string, VoiceSession>();
  private readonly coordinator = new VoiceEngineCoordinator({
    retryDelayMs: 120,
    defaultSttRetries: 2,
    defaultTtsRetries: 2
  });

  constructor(private readonly onEvent: (sessionId: string, event: PipelineEvent) => void) {
    this.coordinator.on('event', (payload: { sessionId: string; event: PipelineEvent }) => {
      this.onEvent(payload.sessionId, payload.event);
    });

    this.coordinator.on('status', (payload: { sessionId: string; message: string }) => {
      this.onEvent(payload.sessionId, { type: 'status', message: payload.message });
    });
  }

  async startSession(config: VoicePipelineConfig): Promise<VoiceSession> {
    const normalizedConfig = this.normalizeConfig(config);
    const session: VoiceSession = {
      id: `voice_${randomUUID()}`,
      config: normalizedConfig,
      createdAt: new Date().toISOString()
    };

    await this.coordinator.createSession(session.id, normalizedConfig);
    this.sessions.set(session.id, session);
    this.emit(session.id, {
      type: 'status',
      message: `Voice session started (${normalizedConfig.provider}, ${normalizedConfig.voiceId}, quality=${normalizedConfig.qualityProfile ?? 'balanced'})`
    });
    return session;
  }

  async stopSession(sessionId: string): Promise<void> {
    this.requireSession(sessionId);
    await this.coordinator.stopSession(sessionId);
    this.sessions.delete(sessionId);
    this.emit(sessionId, {
      type: 'status',
      message: 'Voice session stopped'
    });
  }

  async pushMicAudio(sessionId: string, audioBase64: string): Promise<SttChunk[]> {
    this.requireSession(sessionId);
    if (!audioBase64.trim()) return [];
    return this.coordinator.pushMicAudio(sessionId, audioBase64);
  }

  async synthesizeText(sessionId: string, text: string, isFinal: boolean): Promise<TtsChunk[]> {
    this.requireSession(sessionId);
    const trimmed = text.trim();
    if (!trimmed) return [];
    return this.coordinator.pushLlmChunk(sessionId, { text: trimmed, isFinal });
  }

  private emit(sessionId: string, event: PipelineEvent) {
    this.onEvent(sessionId, event);
  }

  private requireSession(sessionId: string): VoiceSession {
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
}
