export type AiProvider = 'ollama' | 'openai' | 'anthropic' | 'openrouter';

export type ChatRole = 'system' | 'user' | 'assistant';

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type CompletionOptions = {
  provider: AiProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

export type CompletionChunk = {
  text: string;
  done: boolean;
};

export type PersonalityProfile = {
  name: string;
  role: string;
  traits: string[];
  communicationStyle: string;
  knowledgeDomains: string[];
  voiceId: string;
  guardrails: string[];
};

export type RouterHealth = {
  provider: AiProvider;
  model: string;
  online: boolean;
  detail: string;
};
