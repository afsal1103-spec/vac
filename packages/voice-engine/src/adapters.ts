import type { SttChunk, TtsChunk, VoicePipelineConfig } from './types.js';

export type SttAdapter = {
  name: string;
  open(config: VoicePipelineConfig): Promise<void>;
  pushAudio(pcm16Base64: string): Promise<SttChunk[]>;
  close(): Promise<void>;
};

export type TtsAdapter = {
  name: string;
  open(config: VoicePipelineConfig): Promise<void>;
  synthesize(text: string, isFinal: boolean): Promise<TtsChunk[]>;
  close(): Promise<void>;
};

export class LocalWhisperAdapter implements SttAdapter {
  readonly name = 'local-whisper';

  async open(_config: VoicePipelineConfig) {}

  async pushAudio(pcm16Base64: string): Promise<SttChunk[]> {
    if (!pcm16Base64) return [];
    return [{ text: '[local-stt chunk]', startMs: 0, endMs: 200, confidence: 0.9, isFinal: false }];
  }

  async close() {}
}

export class DeepgramAdapter implements SttAdapter {
  readonly name = 'deepgram-streaming';

  async open(_config: VoicePipelineConfig) {}

  async pushAudio(pcm16Base64: string): Promise<SttChunk[]> {
    if (!pcm16Base64) return [];
    return [{ text: '[deepgram chunk]', startMs: 0, endMs: 180, confidence: 0.91, isFinal: false }];
  }

  async close() {}
}

export class LocalCoquiAdapter implements TtsAdapter {
  readonly name = 'local-coqui';

  async open(_config: VoicePipelineConfig) {}

  async synthesize(text: string, isFinal: boolean): Promise<TtsChunk[]> {
    if (!text.trim()) return [];
    return [{ audioBase64: '', sampleRate: 22050, format: 'wav', text, isFinal }];
  }

  async close() {}
}

export class ElevenLabsAdapter implements TtsAdapter {
  readonly name = 'elevenlabs-streaming';

  async open(_config: VoicePipelineConfig) {}

  async synthesize(text: string, isFinal: boolean): Promise<TtsChunk[]> {
    if (!text.trim()) return [];
    return [{ audioBase64: '', sampleRate: 22050, format: 'wav', text, isFinal }];
  }

  async close() {}
}
