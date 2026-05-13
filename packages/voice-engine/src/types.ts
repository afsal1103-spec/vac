export type SttChunk = {
  text: string;
  startMs: number;
  endMs: number;
  confidence?: number;
  isFinal: boolean;
};

export type LlmChunk = {
  text: string;
  isFinal: boolean;
};

export type TtsChunk = {
  audioBase64: string;
  sampleRate: number;
  format: 'wav' | 'pcm_s16le';
  text: string;
  isFinal: boolean;
};

export type VoiceProvider = 'local' | 'deepgram-elevenlabs';

export type VoiceQualityProfile = 'low_latency' | 'balanced' | 'high_quality';

export type VoicePipelineConfig = {
  provider: VoiceProvider;
  language: string;
  voiceId: string;
  enableWordTimestamps: boolean;
  qualityProfile?: VoiceQualityProfile;
  inputDeviceId?: string;
  outputDeviceId?: string;
  noiseSuppression?: boolean;
  echoCancellation?: boolean;
  autoGainControl?: boolean;
  sttMaxRetries?: number;
  ttsMaxRetries?: number;
  fallbackProviders?: VoiceProvider[];
};

export type PipelineEvent =
  | { type: 'stt_chunk'; chunk: SttChunk }
  | { type: 'llm_chunk'; chunk: LlmChunk }
  | { type: 'tts_chunk'; chunk: TtsChunk }
  | { type: 'status'; message: string }
  | { type: 'error'; message: string };
