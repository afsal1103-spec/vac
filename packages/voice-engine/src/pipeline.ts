import { EventEmitter } from 'node:events';
import {
  DeepgramAdapter,
  ElevenLabsAdapter,
  LocalCoquiAdapter,
  LocalWhisperAdapter,
  type SttAdapter,
  type TtsAdapter
} from './adapters.js';
import type { LlmChunk, PipelineEvent, VoicePipelineConfig } from './types.js';

function pickAdapters(provider: VoicePipelineConfig['provider']): { stt: SttAdapter; tts: TtsAdapter } {
  if (provider === 'deepgram-elevenlabs') {
    return { stt: new DeepgramAdapter(), tts: new ElevenLabsAdapter() };
  }

  return { stt: new LocalWhisperAdapter(), tts: new LocalCoquiAdapter() };
}

export class VoicePipeline extends EventEmitter {
  private config: VoicePipelineConfig;
  private stt: SttAdapter;
  private tts: TtsAdapter;

  constructor(config: VoicePipelineConfig) {
    super();
    this.config = config;
    const adapters = pickAdapters(config.provider);
    this.stt = adapters.stt;
    this.tts = adapters.tts;
  }

  async start() {
    await this.stt.open(this.config);
    await this.tts.open(this.config);
    const quality = this.config.qualityProfile ?? 'balanced';
    this.emitEvent({
      type: 'status',
      message: `Voice pipeline started with ${this.stt.name} + ${this.tts.name} (${quality}, noiseSuppression=${this.config.noiseSuppression !== false})`
    });
  }

  async stop() {
    await this.stt.close();
    await this.tts.close();
    this.emitEvent({ type: 'status', message: 'Voice pipeline stopped' });
  }

  async pushMicAudio(pcm16Base64: string) {
    const prepared = this.prepareMicAudio(pcm16Base64);
    if (!prepared) {
      this.emitEvent({ type: 'status', message: 'Mic chunk skipped (empty or filtered by noise gate).' });
      return [];
    }

    try {
      const sttChunks = await this.stt.pushAudio(prepared);
      for (const chunk of sttChunks) {
        this.emitEvent({ type: 'stt_chunk', chunk });
      }
      return sttChunks;
    } catch (error) {
      this.emitEvent({
        type: 'error',
        message: `STT adapter ${this.stt.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      throw error;
    }
  }

  async pushLlmChunk(llmChunk: LlmChunk) {
    const normalizedChunk: LlmChunk = {
      text: this.prepareTextForTts(llmChunk.text),
      isFinal: llmChunk.isFinal
    };
    if (!normalizedChunk.text) {
      return [];
    }

    this.emitEvent({ type: 'llm_chunk', chunk: normalizedChunk });
    try {
      const ttsChunks = await this.tts.synthesize(normalizedChunk.text, normalizedChunk.isFinal);
      for (const chunk of ttsChunks) {
        this.emitEvent({ type: 'tts_chunk', chunk });
      }
      return ttsChunks;
    } catch (error) {
      this.emitEvent({
        type: 'error',
        message: `TTS adapter ${this.tts.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      throw error;
    }
  }

  getProvider(): VoicePipelineConfig['provider'] {
    return this.config.provider;
  }

  getConfig(): VoicePipelineConfig {
    return { ...this.config };
  }

  private prepareMicAudio(pcm16Base64: string): string {
    const trimmed = pcm16Base64.trim();
    if (!trimmed) {
      return '';
    }

    if (this.config.noiseSuppression !== false && trimmed.length < 80) {
      return '';
    }

    return trimmed;
  }

  private prepareTextForTts(input: string): string {
    return input.replace(/\s+/g, ' ').trim();
  }

  private emitEvent(event: PipelineEvent) {
    this.emit('event', event);
  }
}
