import type { ChatMessage, CompletionChunk, CompletionOptions, RouterHealth } from './types.js';

export interface ProviderAdapter {
  readonly provider: CompletionOptions['provider'];
  stream(messages: ChatMessage[], options: CompletionOptions): AsyncGenerator<CompletionChunk, void, void>;
  health(model: string, apiKey?: string): Promise<RouterHealth>;
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

  async *stream(messages: ChatMessage[], options: CompletionOptions): AsyncGenerator<CompletionChunk, void, void> {
    if (!options.apiKey) {
      throw new Error('OpenAI key is not configured.');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 512,
        stream: false
      }),
      signal: options.signal
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`OpenAI request failed (${response.status}): ${detail || 'no detail'}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = payload.choices?.[0]?.message?.content?.trim() || 'OpenAI returned an empty response.';
    yield { text: content, done: false };
    yield { text: '', done: true };
  }

  async health(model: string, apiKey?: string): Promise<RouterHealth> {
    if (!apiKey) {
      return { provider: 'openai', model, online: false, detail: 'Missing OpenAI API key' };
    }
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      return {
        provider: 'openai',
        model,
        online: response.ok,
        detail: response.ok ? 'OpenAI API reachable' : `OpenAI returned ${response.status}`
      };
    } catch (error) {
      return {
        provider: 'openai',
        model,
        online: false,
        detail: error instanceof Error ? error.message : 'Unable to reach OpenAI'
      };
    }
  }
}

export class AnthropicAdapter implements ProviderAdapter {
  readonly provider = 'anthropic' as const;

  async *stream(messages: ChatMessage[], options: CompletionOptions): AsyncGenerator<CompletionChunk, void, void> {
    if (!options.apiKey) {
      throw new Error('Anthropic key is not configured.');
    }

    const system = messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n\n');
    const converted = messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: [{ type: 'text', text: message.content }]
      }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': options.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model,
        system: system || undefined,
        messages: converted,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 512
      }),
      signal: options.signal
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Anthropic request failed (${response.status}): ${detail || 'no detail'}`);
    }

    const payload = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };

    const content = payload.content?.find((item) => item.type === 'text')?.text?.trim() || 'Anthropic returned an empty response.';
    yield { text: content, done: false };
    yield { text: '', done: true };
  }

  async health(model: string, apiKey?: string): Promise<RouterHealth> {
    if (!apiKey) {
      return { provider: 'anthropic', model, online: false, detail: 'Missing Anthropic API key' };
    }
    try {
      const response = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      });
      return {
        provider: 'anthropic',
        model,
        online: response.ok,
        detail: response.ok ? 'Anthropic API reachable' : `Anthropic returned ${response.status}`
      };
    } catch (error) {
      return {
        provider: 'anthropic',
        model,
        online: false,
        detail: error instanceof Error ? error.message : 'Unable to reach Anthropic'
      };
    }
  }
}

export class OpenRouterAdapter implements ProviderAdapter {
  readonly provider = 'openrouter' as const;

  async *stream(messages: ChatMessage[], options: CompletionOptions): AsyncGenerator<CompletionChunk, void, void> {
    if (!options.apiKey) {
      throw new Error('OpenRouter key is not configured.');
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://vac.local',
        'X-Title': 'VAC Desktop'
      },
      body: JSON.stringify({
        model: options.model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 512,
        stream: false
      }),
      signal: options.signal
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`OpenRouter request failed (${response.status}): ${detail || 'no detail'}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = payload.choices?.[0]?.message?.content?.trim() || 'OpenRouter returned an empty response.';
    yield { text: content, done: false };
    yield { text: '', done: true };
  }

  async health(model: string, apiKey?: string): Promise<RouterHealth> {
    if (!apiKey) {
      return { provider: 'openrouter', model, online: false, detail: 'Missing OpenRouter API key' };
    }
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://vac.local',
          'X-Title': 'VAC Desktop'
        }
      });
      return {
        provider: 'openrouter',
        model,
        online: response.ok,
        detail: response.ok ? 'OpenRouter API reachable' : `OpenRouter returned ${response.status}`
      };
    } catch (error) {
      return {
        provider: 'openrouter',
        model,
        online: false,
        detail: error instanceof Error ? error.message : 'Unable to reach OpenRouter'
      };
    }
  }
}
