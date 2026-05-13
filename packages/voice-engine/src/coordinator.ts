import { EventEmitter } from 'node:events';
import type { LlmChunk, VoicePipelineConfig } from './types.js';
import { VoicePipeline } from './pipeline.js';

export type PipelineSession = {
  id: string;
  pipeline: VoicePipeline;
  config: VoicePipelineConfig;
  providerOrder: VoicePipelineConfig['provider'][];
  providerIndex: number;
};

export type VoiceCoordinatorOptions = {
  retryDelayMs?: number;
  defaultSttRetries?: number;
  defaultTtsRetries?: number;
};

export class VoiceEngineCoordinator extends EventEmitter {
  private sessions = new Map<string, PipelineSession>();
  private retryDelayMs: number;
  private defaultSttRetries: number;
  private defaultTtsRetries: number;

  constructor(options: VoiceCoordinatorOptions = {}) {
    super();
    this.retryDelayMs = Math.max(40, options.retryDelayMs ?? 120);
    this.defaultSttRetries = Math.max(0, options.defaultSttRetries ?? 2);
    this.defaultTtsRetries = Math.max(0, options.defaultTtsRetries ?? 2);
  }

  async createSession(id: string, config: VoicePipelineConfig): Promise<PipelineSession> {
    if (this.sessions.has(id)) {
      throw new Error(`Voice session ${id} already exists.`);
    }

    const providerOrder = this.buildProviderOrder(config);
    const { pipeline, providerIndex } = await this.startFirstAvailableProvider(id, config, providerOrder);

    const session: PipelineSession = { id, pipeline, config, providerOrder, providerIndex };
    this.sessions.set(id, session);
    this.emit('status', { sessionId: id, message: `Voice session created with provider ${session.pipeline.getProvider()}` });
    return session;
  }

  getSession(id: string): PipelineSession | undefined {
    return this.sessions.get(id);
  }

  async pushMicAudio(id: string, pcm16Base64: string) {
    const session = this.requireSession(id);
    const retries = session.config.sttMaxRetries ?? this.defaultSttRetries;
    return this.withRetriesAndFallback(session, 'stt', retries, async () => session.pipeline.pushMicAudio(pcm16Base64));
  }

  async pushLlmChunk(id: string, llmChunk: LlmChunk) {
    const session = this.requireSession(id);
    const retries = session.config.ttsMaxRetries ?? this.defaultTtsRetries;
    return this.withRetriesAndFallback(session, 'tts', retries, async () => session.pipeline.pushLlmChunk(llmChunk));
  }

  async stopSession(id: string) {
    const session = this.requireSession(id);
    await session.pipeline.stop();
    this.sessions.delete(id);
    this.emit('status', { sessionId: id, message: 'Voice session stopped and removed.' });
  }

  private requireSession(id: string): PipelineSession {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Voice session ${id} was not found.`);
    return session;
  }

  private buildProviderOrder(config: VoicePipelineConfig): VoicePipelineConfig['provider'][] {
    const fallback = Array.isArray(config.fallbackProviders) ? config.fallbackProviders : [];
    const order = [config.provider, ...fallback];
    const deduped: VoicePipelineConfig['provider'][] = [];
    for (const provider of order) {
      if (!deduped.includes(provider)) {
        deduped.push(provider);
      }
    }
    return deduped;
  }

  private async startFirstAvailableProvider(
    sessionId: string,
    config: VoicePipelineConfig,
    providerOrder: VoicePipelineConfig['provider'][]
  ): Promise<{ pipeline: VoicePipeline; providerIndex: number }> {
    const errors: string[] = [];
    for (let index = 0; index < providerOrder.length; index += 1) {
      const provider = providerOrder[index];
      const pipeline = new VoicePipeline({ ...config, provider });
      this.attachPipelineEvents(sessionId, pipeline);
      try {
        await pipeline.start();
        return { pipeline, providerIndex: index };
      } catch (error) {
        errors.push(`${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    throw new Error(`Unable to initialize voice pipeline. ${errors.join(' | ')}`);
  }

  private attachPipelineEvents(sessionId: string, pipeline: VoicePipeline) {
    pipeline.on('event', (event) => {
      this.emit('event', { sessionId, event });
    });
  }

  private async withRetriesAndFallback<T>(
    session: PipelineSession,
    stage: 'stt' | 'tts',
    retries: number,
    operation: () => Promise<T>
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt < retries) {
          this.emit('status', {
            sessionId: session.id,
            message: `${stage.toUpperCase()} failure on ${session.pipeline.getProvider()}, retry ${attempt + 1}/${retries}`
          });
          await this.sleep(this.retryDelayMs * (attempt + 1));
          continue;
        }
      }
    }

    const fallbackSwitched = await this.switchToNextProvider(session, `${stage.toUpperCase()} retries exhausted`);
    if (fallbackSwitched) {
      return operation();
    }

    throw lastError instanceof Error ? lastError : new Error(`${stage.toUpperCase()} failed with no fallback provider available.`);
  }

  private async switchToNextProvider(session: PipelineSession, reason: string): Promise<boolean> {
    const nextIndex = session.providerIndex + 1;
    if (nextIndex >= session.providerOrder.length) {
      return false;
    }

    const oldProvider = session.pipeline.getProvider();
    await session.pipeline.stop().catch(() => undefined);

    const nextProvider = session.providerOrder[nextIndex];
    const nextPipeline = new VoicePipeline({ ...session.config, provider: nextProvider });
    this.attachPipelineEvents(session.id, nextPipeline);
    await nextPipeline.start();
    session.pipeline = nextPipeline;
    session.providerIndex = nextIndex;
    this.emit('status', {
      sessionId: session.id,
      message: `Switched provider ${oldProvider} -> ${nextProvider} (${reason})`
    });
    return true;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
