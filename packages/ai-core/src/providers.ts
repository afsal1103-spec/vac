import type { ChatMessage, CompletionChunk, CompletionOptions, RouterHealth } from './types.js';

export interface ProviderAdapter {
  readonly provider: CompletionOptions['provider'];
  stream(messages: ChatMessage[], options: CompletionOptions): AsyncGenerator<CompletionChunk, void, void>;
  health(model: string): Promise<RouterHealth>;
}

export class OllamaAdapter implements ProviderAdapter {
  readonly provider = 'ollama' as const;

  async *stream(_messages: ChatMessage[], _options: CompletionOptions): AsyncGenerator<CompletionChunk, void, void> {
    yield { text: '[ollama chunk]', done: false };
    yield { text: '', done: true };
  }

  async health(model: string): Promise<RouterHealth> {
    return { provider: 'ollama', model, online: true, detail: 'Local endpoint reachable (stub)' };
  }
}

export class OpenAiAdapter implements ProviderAdapter {
  readonly provider = 'openai' as const;

  async *stream(_messages: ChatMessage[], _options: CompletionOptions): AsyncGenerator<CompletionChunk, void, void> {
    yield { text: '[openai chunk]', done: false };
    yield { text: '', done: true };
  }

  async health(model: string): Promise<RouterHealth> {
    return { provider: 'openai', model, online: true, detail: 'API client configured (stub)' };
  }
}

export class AnthropicAdapter implements ProviderAdapter {
  readonly provider = 'anthropic' as const;

  async *stream(_messages: ChatMessage[], _options: CompletionOptions): AsyncGenerator<CompletionChunk, void, void> {
    yield { text: '[anthropic chunk]', done: false };
    yield { text: '', done: true };
  }

  async health(model: string): Promise<RouterHealth> {
    return { provider: 'anthropic', model, online: true, detail: 'API client configured (stub)' };
  }
}

export class OpenRouterAdapter implements ProviderAdapter {
  readonly provider = 'openrouter' as const;

  async *stream(_messages: ChatMessage[], _options: CompletionOptions): AsyncGenerator<CompletionChunk, void, void> {
    yield { text: '[openrouter chunk]', done: false };
    yield { text: '', done: true };
  }

  async health(model: string): Promise<RouterHealth> {
    return { provider: 'openrouter', model, online: true, detail: 'OpenRouter endpoint configured (stub)' };
  }
}
