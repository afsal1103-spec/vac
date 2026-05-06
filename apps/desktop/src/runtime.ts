import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AiRouter, DEFAULT_PERSONALITY, mergePersonalityProfile, type AiProvider, type RouterHealth } from '@vac/ai-core';

type Provider = 'ollama' | 'openrouter' | 'openai' | 'anthropic';

export type AppProfile = {
  userId: string;
  userName: string;
  assistantName: string;
  personality: string;
  voice: string;
  provider: Provider;
  createdAt: string;
};

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type StoredConversation = {
  id: string;
  title: string;
  createdAt: string;
};

export type ChatExchange = {
  conversationId: string;
  reply: string;
  messages: ChatMessage[];
};

export type AiRuntimeConfig = {
  models: Record<Provider, string>;
  temperature: number;
  maxTokens: number;
  fallbackOrder: Provider[];
};

type UserRow = {
  id: string;
  name: string;
  createdAt: string;
};

type PersonalityRow = {
  id: string;
  userId: string;
  profileJson: string;
  createdAt: string;
};

type AppConfigRow = {
  key: string;
  valueJson: string;
  updatedAt: string;
};

const DEFAULT_USER_ID = 'local-user';
const DEFAULT_PERSONALITY_ID = 'local-personality';
const AI_RUNTIME_CONFIG_KEY = 'ai_runtime_config';
const AVAILABLE_PROVIDERS: Provider[] = ['ollama', 'openrouter', 'openai', 'anthropic'];
const UNAVAILABLE_REPLY_HINTS = ['unavailable right now', 'request failed', 'returned an empty response'];

const DEFAULT_AI_CONFIG: AiRuntimeConfig = {
  models: {
    ollama: 'llama3.2',
    openrouter: 'openai/gpt-4o-mini',
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-5-haiku-latest'
  },
  temperature: 0.7,
  maxTokens: 512,
  fallbackOrder: ['ollama', 'openrouter', 'openai', 'anthropic']
};

const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS personalities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  profile_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

export class VacRuntime {
  private readonly db = new Database(join(app.getPath('userData'), 'vac.sqlite'));
  private readonly aiRouter = new AiRouter();

  constructor() {
    this.db.pragma('journal_mode = WAL');
    this.db.exec(SQLITE_SCHEMA);
  }

  loadProfile(): AppProfile | null {
    const user = this.db
      .prepare(
        `
          SELECT id, name, created_at as createdAt
          FROM users
          WHERE id = ?
          LIMIT 1
        `
      )
      .get(DEFAULT_USER_ID) as UserRow | undefined;

    const personality = this.db
      .prepare(
        `
          SELECT id, user_id as userId, profile_json as profileJson, created_at as createdAt
          FROM personalities
          WHERE user_id = ?
          ORDER BY created_at DESC
          LIMIT 1
        `
      )
      .get(DEFAULT_USER_ID) as PersonalityRow | undefined;

    if (!user || !personality) {
      return null;
    }

    const parsed = JSON.parse(personality.profileJson) as Omit<AppProfile, 'userId' | 'userName' | 'createdAt'>;
    return {
      userId: user.id,
      userName: user.name,
      createdAt: user.createdAt,
      ...parsed
    };
  }

  saveProfile(input: Omit<AppProfile, 'userId' | 'createdAt'>): AppProfile {
    const createdAt = new Date().toISOString();
    const profile: AppProfile = {
      userId: DEFAULT_USER_ID,
      createdAt,
      ...input
    };

    this.db
      .prepare(
        `
          INSERT INTO users (id, name, created_at)
          VALUES (@id, @name, @createdAt)
          ON CONFLICT(id) DO UPDATE SET name=excluded.name
        `
      )
      .run({ id: profile.userId, name: profile.userName, createdAt: profile.createdAt });

    this.db
      .prepare(
        `
          INSERT INTO personalities (id, user_id, profile_json, created_at)
          VALUES (@id, @userId, @profileJson, @createdAt)
          ON CONFLICT(id) DO UPDATE SET profile_json=excluded.profile_json
        `
      )
      .run({
        id: DEFAULT_PERSONALITY_ID,
        userId: profile.userId,
        profileJson: JSON.stringify({
          assistantName: profile.assistantName,
          personality: profile.personality,
          voice: profile.voice,
          provider: profile.provider
        }),
        createdAt: profile.createdAt
      });

    return profile;
  }

  listConversations(): StoredConversation[] {
    return this.db
      .prepare(
        `
          SELECT id, title, created_at as createdAt
          FROM conversations
          WHERE user_id = ?
          ORDER BY created_at DESC
        `
      )
      .all(DEFAULT_USER_ID) as StoredConversation[];
  }

  createSyncSnapshot() {
    return {
      profile: this.loadProfile(),
      conversations: this.listConversations()
    };
  }

  loadAiConfig(): AiRuntimeConfig {
    const row = this.db
      .prepare(
        `
          SELECT key, value_json as valueJson, updated_at as updatedAt
          FROM app_config
          WHERE key = ?
          LIMIT 1
        `
      )
      .get(AI_RUNTIME_CONFIG_KEY) as AppConfigRow | undefined;

    if (!row) {
      return DEFAULT_AI_CONFIG;
    }

    try {
      const parsed = JSON.parse(row.valueJson) as Partial<AiRuntimeConfig>;
      return this.normalizeAiConfig(parsed);
    } catch {
      return DEFAULT_AI_CONFIG;
    }
  }

  saveAiConfig(input: Partial<AiRuntimeConfig>): AiRuntimeConfig {
    const merged = this.normalizeAiConfig({ ...this.loadAiConfig(), ...input });
    this.db
      .prepare(
        `
          INSERT INTO app_config (key, value_json, updated_at)
          VALUES (@key, @valueJson, @updatedAt)
          ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
        `
      )
      .run({
        key: AI_RUNTIME_CONFIG_KEY,
        valueJson: JSON.stringify(merged),
        updatedAt: new Date().toISOString()
      });

    return merged;
  }

  async getAiHealth(): Promise<RouterHealth[]> {
    const config = this.loadAiConfig();
    return this.aiRouter.health({
      ollama: config.models.ollama,
      openrouter: config.models.openrouter,
      openai: config.models.openai,
      anthropic: config.models.anthropic
    });
  }

  getConversationMessages(conversationId: string): ChatMessage[] {
    return (
      this.db
        .prepare(
          `
            SELECT role, content
            FROM messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC
          `
        )
        .all(conversationId) as ChatMessage[]
    );
  }

  async sendMessage(input: { conversationId?: string; content: string }): Promise<ChatExchange> {
    const profile = this.loadProfile();
    if (!profile) {
      throw new Error('Profile is not configured yet.');
    }

    const conversationId = input.conversationId ?? randomUUID();
    const existingMessages = input.conversationId ? this.getConversationMessages(conversationId) : [];
    const userMessage: ChatMessage = { role: 'user', content: input.content };
    const messages = [...existingMessages, userMessage];

    if (!input.conversationId) {
      this.db
        .prepare(
          `
            INSERT INTO conversations (id, user_id, title, created_at)
            VALUES (@id, @userId, @title, @createdAt)
          `
        )
        .run({
          id: conversationId,
          userId: DEFAULT_USER_ID,
          title: input.content.slice(0, 48) || 'New conversation',
          createdAt: new Date().toISOString()
        });
    }

    this.db
      .prepare(
        `
          INSERT INTO messages (id, conversation_id, role, content, created_at)
          VALUES (@id, @conversationId, @role, @content, @createdAt)
        `
      )
      .run({
        id: randomUUID(),
        conversationId,
        role: 'user',
        content: input.content,
        createdAt: new Date().toISOString()
      });

    const reply = await this.completeWithProvider(profile, messages);
    const assistantMessage: ChatMessage = { role: 'assistant', content: reply };

    this.db
      .prepare(
        `
          INSERT INTO messages (id, conversation_id, role, content, created_at)
          VALUES (@id, @conversationId, @role, @content, @createdAt)
        `
      )
      .run({
        id: randomUUID(),
        conversationId,
        role: 'assistant',
        content: assistantMessage.content,
        createdAt: new Date().toISOString()
      });

    return {
      conversationId,
      reply: assistantMessage.content,
      messages: [...messages, assistantMessage]
    };
  }

  private async completeWithProvider(profile: AppProfile, messages: ChatMessage[]): Promise<string> {
    const config = this.loadAiConfig();
    const providerOrder = this.buildProviderOrder(profile.provider, config.fallbackOrder);
    const personality = mergePersonalityProfile(DEFAULT_PERSONALITY, {
      name: profile.assistantName,
      communicationStyle: profile.personality,
      voiceId: profile.voice
    });
    const failures: string[] = [];

    for (const provider of providerOrder) {
      const model = config.models[provider];
      try {
        let reply = '';
        for await (const chunk of this.aiRouter.complete(
          messages,
          {
            provider: provider as AiProvider,
            model,
            temperature: config.temperature,
            maxTokens: config.maxTokens
          },
          personality
        )) {
          if (!chunk.done) {
            reply += chunk.text;
          }
        }

        const normalized = reply.trim();
        if (!normalized) {
          failures.push(`${provider}: empty response`);
          continue;
        }

        if (this.looksUnavailable(normalized)) {
          failures.push(`${provider}: unavailable`);
          continue;
        }

        return normalized;
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Unknown error';
        failures.push(`${provider}: ${detail}`);
      }
    }

    return `${profile.assistantName} could not reach any configured provider. ${failures.join(' | ')}`;
  }

  private buildProviderOrder(primary: Provider, fallbackOrder: Provider[]): Provider[] {
    const visited = new Set<Provider>();
    const ordered: Provider[] = [];

    if (AVAILABLE_PROVIDERS.includes(primary)) {
      ordered.push(primary);
      visited.add(primary);
    }

    for (const provider of fallbackOrder) {
      if (!visited.has(provider) && AVAILABLE_PROVIDERS.includes(provider)) {
        ordered.push(provider);
        visited.add(provider);
      }
    }

    for (const provider of AVAILABLE_PROVIDERS) {
      if (!visited.has(provider)) {
        ordered.push(provider);
      }
    }

    return ordered;
  }

  private looksUnavailable(reply: string): boolean {
    const lowered = reply.toLowerCase();
    return UNAVAILABLE_REPLY_HINTS.some((hint) => lowered.includes(hint));
  }

  private normalizeAiConfig(input: Partial<AiRuntimeConfig>): AiRuntimeConfig {
    const incomingModels = input.models ?? DEFAULT_AI_CONFIG.models;
    const models: Record<Provider, string> = {
      ollama: incomingModels.ollama?.trim() || DEFAULT_AI_CONFIG.models.ollama,
      openrouter: incomingModels.openrouter?.trim() || DEFAULT_AI_CONFIG.models.openrouter,
      openai: incomingModels.openai?.trim() || DEFAULT_AI_CONFIG.models.openai,
      anthropic: incomingModels.anthropic?.trim() || DEFAULT_AI_CONFIG.models.anthropic
    };

    const fallbackCandidate = Array.isArray(input.fallbackOrder) ? input.fallbackOrder : DEFAULT_AI_CONFIG.fallbackOrder;
    const fallbackOrder = fallbackCandidate.filter((provider): provider is Provider =>
      AVAILABLE_PROVIDERS.includes(provider)
    );

    return {
      models,
      temperature: typeof input.temperature === 'number' ? Math.min(1.5, Math.max(0, input.temperature)) : DEFAULT_AI_CONFIG.temperature,
      maxTokens: typeof input.maxTokens === 'number' ? Math.min(2048, Math.max(64, Math.floor(input.maxTokens))) : DEFAULT_AI_CONFIG.maxTokens,
      fallbackOrder: fallbackOrder.length > 0 ? fallbackOrder : DEFAULT_AI_CONFIG.fallbackOrder
    };
  }
}
