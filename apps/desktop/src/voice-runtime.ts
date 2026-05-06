import { randomUUID } from 'node:crypto';

export type VoiceProvider = 'local' | 'deepgram-elevenlabs';

export type VoicePipelineConfig = {
  provider: VoiceProvider;
  language: string;
  voiceId: string;
  enableWordTimestamps: boolean;
};

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

export type PipelineEvent =
  | { type: 'stt_chunk'; chunk: SttChunk }
  | { type: 'llm_chunk'; chunk: LlmChunk }
  | { type: 'tts_chunk'; chunk: TtsChunk }
  | { type: 'status'; message: string }
  | { type: 'error'; message: string };

export type VoiceSession = {
  id: string;
  config: VoicePipelineConfig;
  createdAt: string;
};

function buildSineWaveWavBase64(seconds: number, sampleRate: number, frequencyHz: number): string {
  const samples = Math.max(1, Math.floor(seconds * sampleRate));
  const bytesPerSample = 2;
  const channelCount = 1;
  const dataSize = samples * bytesPerSample * channelCount;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channelCount, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channelCount * bytesPerSample, 28);
  buffer.writeUInt16LE(channelCount * bytesPerSample, 32);
  buffer.writeUInt16LE(bytesPerSample * 8, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples; i += 1) {
    const amplitude = Math.sin((2 * Math.PI * frequencyHz * i) / sampleRate) * 0.2;
    const sample = Math.max(-32767, Math.min(32767, Math.floor(amplitude * 32767)));
    buffer.writeInt16LE(sample, 44 + i * 2);
  }

  return buffer.toString('base64');
}

export class VoiceRuntime {
  private sessions = new Map<string, VoiceSession>();

  constructor(private readonly onEvent: (sessionId: string, event: PipelineEvent) => void) {}

  startSession(config: VoicePipelineConfig): VoiceSession {
    const session: VoiceSession = {
      id: `voice_${randomUUID()}`,
      config,
      createdAt: new Date().toISOString()
    };
    this.sessions.set(session.id, session);
    this.emit(session.id, {
      type: 'status',
      message: `Voice session started (${config.provider}, ${config.voiceId})`
    });
    return session;
  }

  stopSession(sessionId: string) {
    this.requireSession(sessionId);
    this.sessions.delete(sessionId);
    this.emit(sessionId, {
      type: 'status',
      message: 'Voice session stopped'
    });
  }

  pushMicAudio(sessionId: string, audioBase64: string): SttChunk[] {
    this.requireSession(sessionId);
    if (!audioBase64) return [];

    const chunk: SttChunk = {
      text: '[mic chunk]',
      startMs: 0,
      endMs: 220,
      confidence: 0.85,
      isFinal: false
    };
    this.emit(sessionId, { type: 'stt_chunk', chunk });
    return [chunk];
  }

  synthesizeText(sessionId: string, text: string, isFinal: boolean): TtsChunk[] {
    this.requireSession(sessionId);
    const trimmed = text.trim();
    if (!trimmed) return [];

    this.emit(sessionId, { type: 'llm_chunk', chunk: { text: trimmed, isFinal } });
    const wavBase64 = buildSineWaveWavBase64(Math.min(1.2, Math.max(0.2, trimmed.length / 80)), 22050, 220);
    const chunk: TtsChunk = {
      audioBase64: wavBase64,
      sampleRate: 22050,
      format: 'wav',
      text: trimmed,
      isFinal
    };
    this.emit(sessionId, { type: 'tts_chunk', chunk });
    return [chunk];
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
}
