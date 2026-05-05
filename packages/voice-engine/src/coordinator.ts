import type { LlmChunk, VoicePipelineConfig } from './types.js';
import { VoicePipeline } from './pipeline.js';

export type PipelineSession = {
  id: string;
  pipeline: VoicePipeline;
};

export class VoiceEngineCoordinator {
  private sessions = new Map<string, PipelineSession>();

  async createSession(id: string, config: VoicePipelineConfig): Promise<PipelineSession> {
    if (this.sessions.has(id)) {
      throw new Error(`Voice session ${id} already exists.`);
    }

    const pipeline = new VoicePipeline(config);
    await pipeline.start();

    const session = { id, pipeline };
    this.sessions.set(id, session);
    return session;
  }

  getSession(id: string): PipelineSession | undefined {
    return this.sessions.get(id);
  }

  async pushMicAudio(id: string, pcm16Base64: string) {
    const session = this.requireSession(id);
    return session.pipeline.pushMicAudio(pcm16Base64);
  }

  async pushLlmChunk(id: string, llmChunk: LlmChunk) {
    const session = this.requireSession(id);
    return session.pipeline.pushLlmChunk(llmChunk);
  }

  async stopSession(id: string) {
    const session = this.requireSession(id);
    await session.pipeline.stop();
    this.sessions.delete(id);
  }

  private requireSession(id: string): PipelineSession {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Voice session ${id} was not found.`);
    return session;
  }
}
