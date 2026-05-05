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
    this.emitEvent({ type: 'status', message: `Voice pipeline started with ${this.stt.name} + ${this.tts.name}` });
  }

  async stop() {
    await this.stt.close();
    await this.tts.close();
    this.emitEvent({ type: 'status', message: 'Voice pipeline stopped' });
  }

  async pushMicAudio(pcm16Base64: string) {
    const sttChunks = await this.stt.pushAudio(pcm16Base64);
    for (const chunk of sttChunks) {
      this.emitEvent({ type: 'stt_chunk', chunk });
    }
    return sttChunks;
  }

  async pushLlmChunk(llmChunk: LlmChunk) {
    this.emitEvent({ type: 'llm_chunk', chunk: llmChunk });
    const ttsChunks = await this.tts.synthesize(llmChunk.text, llmChunk.isFinal);
    for (const chunk of ttsChunks) {
      this.emitEvent({ type: 'tts_chunk', chunk });
    }
    return ttsChunks;
  }

  private emitEvent(event: PipelineEvent) {
    this.emit('event', event);
  }
}
