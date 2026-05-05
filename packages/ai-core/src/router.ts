import {
  AnthropicAdapter,
  OllamaAdapter,
  OpenAiAdapter,
  OpenRouterAdapter,
  type ProviderAdapter
} from './providers.js';
import { DEFAULT_PERSONALITY, buildPersonalitySystemPrompt } from './personality.js';
import type {
  AiProvider,
  ChatMessage,
  CompletionChunk,
  CompletionOptions,
  PersonalityProfile,
  RouterHealth
} from './types.js';

function createDefaultAdapters(): Record<AiProvider, ProviderAdapter> {
  return {
    ollama: new OllamaAdapter(),
    openai: new OpenAiAdapter(),
    anthropic: new AnthropicAdapter(),
    openrouter: new OpenRouterAdapter()
  };
}

export class AiRouter {
  private adapters: Record<AiProvider, ProviderAdapter>;

  constructor(adapters: Partial<Record<AiProvider, ProviderAdapter>> = {}) {
    this.adapters = { ...createDefaultAdapters(), ...adapters };
  }

  async *complete(
    messages: ChatMessage[],
    options: CompletionOptions,
    personality: PersonalityProfile = DEFAULT_PERSONALITY
  ): AsyncGenerator<CompletionChunk, void, void> {
    const adapter = this.adapters[options.provider];
    if (!adapter) {
      throw new Error(`Provider ${options.provider} is not configured.`);
    }

    const systemMessage: ChatMessage = {
      role: 'system',
      content: buildPersonalitySystemPrompt(personality)
    };

    const finalMessages = [systemMessage, ...messages];
    for await (const chunk of adapter.stream(finalMessages, options)) {
      yield chunk;
    }
  }

  async health(modelByProvider: Record<AiProvider, string>): Promise<RouterHealth[]> {
    return Promise.all(
      Object.entries(this.adapters).map(async ([provider, adapter]) =>
        adapter.health(modelByProvider[provider as AiProvider])
      )
    );
  }
}
