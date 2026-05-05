import type { ChatMessage, CompletionChunk, CompletionOptions, RouterHealth } from './types.js';

export interface ProviderAdapter {
  readonly provider: CompletionOptions['provider'];
  stream(messages: ChatMessage[], options: CompletionOptions): AsyncGenerator<CompletionChunk, void, void>;
  health(model: string): Promise<RouterHealth>;
}

export class OllamaAdapter implements ProviderAdapter {
  readonly provider = 'ollama' as const;

  async *stream(messages: ChatMessage[], options: CompletionOptions): AsyncGenerator<CompletionChunk, void, void> {
    try {
      const response = await fetch('http://127.0.0.1:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: options.model,
          messages,
          stream: false,
          options: {
            temperature: options.temperature ?? 0.7,
            num_predict: options.maxTokens ?? 256
          }
        }),
        signal: options.signal
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as {
        message?: { content?: string };
      };

      const content = payload.message?.content?.trim() || 'Ollama returned an empty response.';
      yield { text: content, done: false };
      yield { text: '', done: true };
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown Ollama error';
      yield { text: `Ollama is unavailable right now. ${detail}`, done: false };
      yield { text: '', done: true };
    }
  }

  async health(model: string): Promise<RouterHealth> {
    try {
      const response = await fetch('http://127.0.0.1:11434/api/tags');
      return {
        provider: 'ollama',
        model,
        online: response.ok,
        detail: response.ok ? 'Local Ollama endpoint reachable' : `Ollama returned ${response.status}`
      };
    } catch (error) {
      return {
        provider: 'ollama',
        model,
        online: false,
        detail: error instanceof Error ? error.message : 'Unable to reach Ollama'
      };
    }
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
