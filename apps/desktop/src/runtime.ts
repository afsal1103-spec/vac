import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AiRouter, DEFAULT_PERSONALITY, mergePersonalityProfile, type AiProvider, type RouterHealth } from '@vac/ai-core';
import { buildMemoryContext, InMemoryVectorStore } from '@vac/memory';
import { FileAgent, FilePermissionRegistry, type DirectoryGrant, type FileSummary } from '@vac/offline';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import type { CloudRuntime } from './cloud-runtime.js';

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

type StreamChunkHandler = (chunk: { conversationId: string; text: string; done: boolean; provider: Provider }) => void;

export type MemoryContextSnapshot = {
  query: string;
  context: string;
  hits: Array<{ id: string; score: number; text: string; source: string }>;
  generatedAt: string;
};

export type AiRuntimeConfig = {
  models: Record<Provider, string>;
  keyAliases: Record<Provider, string>;
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

type MemorySummaryRow = {
  conversationId: string;
  summary: string;
  updatedAt: string;
};

type OfflineGrantRow = {
  id: string;
  path: string;
  grantedAt: string;
  reason: string;
};

const DEFAULT_USER_ID = 'local-user';
const DEFAULT_PERSONALITY_ID = 'local-personality';
const AI_RUNTIME_CONFIG_KEY = 'ai_runtime_config';
const FILE_CONTEXT_PATHS_KEY = 'file_context_paths';
const AVAILABLE_PROVIDERS: Provider[] = ['ollama', 'openrouter', 'openai', 'anthropic'];
const UNAVAILABLE_REPLY_HINTS = ['unavailable right now', 'request failed', 'returned an empty response'];

const DEFAULT_AI_CONFIG: AiRuntimeConfig = {
  models: {
    ollama: 'llama3.2',
    openrouter: 'openai/gpt-4o-mini',
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-5-haiku-latest'
  },
  keyAliases: {
    ollama: '',
    openrouter: '',
    openai: '',
    anthropic: ''
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

CREATE TABLE IF NOT EXISTS memory_summaries (
  conversation_id TEXT PRIMARY KEY,
  summary TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS offline_grants (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  granted_at TEXT NOT NULL,
  reason TEXT NOT NULL
);
`;

export class VacRuntime {
  private readonly db = new Database(join(app.getPath('userData'), 'vac.sqlite'));
  private readonly aiRouter = new AiRouter();
  private readonly vectorStore = new InMemoryVectorStore();
  private readonly permissions = new FilePermissionRegistry();
  private readonly fileAgent = new FileAgent(this.permissions);
  private cloudRuntime: CloudRuntime | null = null;
  private lastMemoryContext: MemoryContextSnapshot | null = null;
  private activeFileContextPaths: string[] = [];

  constructor() {
    this.db.pragma('journal_mode = WAL');
    this.db.exec(SQLITE_SCHEMA);
    this.hydrateOfflineGrants();
    this.activeFileContextPaths = this.loadFileContextPaths();
    void this.hydrateMemoryIndex();
  }

  attachCloudRuntime(cloudRuntime: CloudRuntime) {
    this.cloudRuntime = cloudRuntime;
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
    const keyByProvider = this.resolveProviderKeys(config);
    return this.aiRouter.health({
      ollama: config.models.ollama,
      openrouter: config.models.openrouter,
      openai: config.models.openai,
      anthropic: config.models.anthropic
    }, keyByProvider);
  }

  getLastMemoryContext(): MemoryContextSnapshot | null {
    return this.lastMemoryContext;
  }

  listOfflineGrants(): DirectoryGrant[] {
    return this.permissions.list();
  }

  grantOfflineDirectory(directoryPath: string, reason: string): DirectoryGrant {
    const grant = this.permissions.grant(directoryPath, reason);
    this.db
      .prepare(
        `
          INSERT INTO offline_grants (id, path, granted_at, reason)
          VALUES (@id, @path, @grantedAt, @reason)
          ON CONFLICT(id) DO UPDATE SET path = excluded.path, granted_at = excluded.granted_at, reason = excluded.reason
        `
      )
      .run(grant);
    return grant;
  }

  revokeOfflineGrant(grantId: string): { removed: boolean } {
    const removed = this.permissions.revoke(grantId);
    if (removed) {
      this.db.prepare('DELETE FROM offline_grants WHERE id = ?').run(grantId);
      const filtered = this.activeFileContextPaths.filter((filePath) => this.isPathAllowed(filePath));
      this.activeFileContextPaths = filtered;
      this.saveFileContextPaths(filtered);
    }
    return { removed };
  }

  listOfflineFiles(directoryPath: string): string[] {
    return this.fileAgent
      .listFiles(directoryPath)
      .filter((filePath) => {
        try {
          return statSync(filePath).isFile();
        } catch {
          return false;
        }
      })
      .slice(0, 500);
  }

  searchOfflineFiles(directoryPath: string, query: string, maxResults = 20): FileSummary[] {
    this.permissions.assertPathAllowed(directoryPath);
    const normalizedQuery = query.trim().toLowerCase();
    const files = this.walkFiles(directoryPath, 4, 800);
    const results: FileSummary[] = [];

    for (const filePath of files) {
      if (results.length >= maxResults) break;
      try {
        const stats = statSync(filePath);
        if (!stats.isFile()) continue;
        const content = stats.size <= 1024 * 1024 ? readFileSync(filePath, 'utf8') : '';
        const haystack = `${filePath.toLowerCase()}\n${content.toLowerCase()}`;
        if (!normalizedQuery || haystack.includes(normalizedQuery)) {
          results.push({
            path: filePath,
            sizeBytes: stats.size,
            lastModifiedIso: stats.mtime.toISOString(),
            excerpt: content.slice(0, 240)
          });
        }
      } catch {
        continue;
      }
    }

    return results;
  }

  summarizeOfflineFile(filePath: string, maxChars = 500): FileSummary {
    return this.fileAgent.summarizeFile(filePath, maxChars);
  }

  getChatFileContextPaths(): string[] {
    return [...this.activeFileContextPaths];
  }

  setChatFileContextPaths(paths: string[]): string[] {
    const deduped = Array.from(new Set(paths.map((item) => item.trim()).filter(Boolean))).slice(0, 8);
    const validated = deduped.filter((filePath) => {
      try {
        this.permissions.assertPathAllowed(filePath);
        return statSync(filePath).isFile();
      } catch {
        return false;
      }
    });
    this.activeFileContextPaths = validated;
    this.saveFileContextPaths(validated);
    return [...this.activeFileContextPaths];
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

  async sendMessage(input: { conversationId?: string; content: string }, onChunk?: StreamChunkHandler): Promise<ChatExchange> {
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

    const userMessageId = randomUUID();
    this.db
      .prepare(
        `
          INSERT INTO messages (id, conversation_id, role, content, created_at)
          VALUES (@id, @conversationId, @role, @content, @createdAt)
        `
      )
      .run({
        id: userMessageId,
        conversationId,
        role: 'user',
        content: input.content,
        createdAt: new Date().toISOString()
      });

    await this.vectorStore.upsert({
      id: `message:${userMessageId}`,
      text: input.content,
      metadata: {
        source: 'message',
        role: 'user',
        conversationId
      },
      embedding: this.embedText(input.content)
    });

    const reply = await this.completeWithProvider(profile, messages, conversationId, onChunk);
    const assistantMessage: ChatMessage = { role: 'assistant', content: reply };

    const assistantMessageId = randomUUID();
    this.db
      .prepare(
        `
          INSERT INTO messages (id, conversation_id, role, content, created_at)
          VALUES (@id, @conversationId, @role, @content, @createdAt)
        `
      )
      .run({
        id: assistantMessageId,
        conversationId,
        role: 'assistant',
        content: assistantMessage.content,
        createdAt: new Date().toISOString()
      });

    await this.vectorStore.upsert({
      id: `message:${assistantMessageId}`,
      text: assistantMessage.content,
      metadata: {
        source: 'message',
        role: 'assistant',
        conversationId
      },
      embedding: this.embedText(assistantMessage.content)
    });

    const summary = this.compactConversationSummary([...messages, assistantMessage]);
    this.db
      .prepare(
        `
          INSERT INTO memory_summaries (conversation_id, summary, updated_at)
          VALUES (@conversationId, @summary, @updatedAt)
          ON CONFLICT(conversation_id) DO UPDATE SET summary = excluded.summary, updated_at = excluded.updated_at
        `
      )
      .run({
        conversationId,
        summary,
        updatedAt: new Date().toISOString()
      });

    await this.vectorStore.upsert({
      id: `summary:${conversationId}`,
      text: summary,
      metadata: {
        source: 'summary',
        conversationId
      },
      embedding: this.embedText(summary)
    });

    return {
      conversationId,
      reply: assistantMessage.content,
      messages: [...messages, assistantMessage]
    };
  }

  private async completeWithProvider(
    profile: AppProfile,
    messages: ChatMessage[],
    conversationId: string,
    onChunk?: StreamChunkHandler
  ): Promise<string> {
    const config = this.loadAiConfig();
    const providerOrder = this.buildProviderOrder(profile.provider, config.fallbackOrder);
    const personality = mergePersonalityProfile(DEFAULT_PERSONALITY, {
      name: profile.assistantName,
      communicationStyle: profile.personality,
      voiceId: profile.voice
    });
    const memorySnapshot = await this.buildMemorySnapshot(messages[messages.length - 1]?.content ?? '', conversationId);
    const injectedSystemMessages: ChatMessage[] = [];
    const fileContext = this.buildFileContextPrompt();
    if (fileContext) {
      injectedSystemMessages.push({ role: 'system', content: fileContext });
    }
    if (memorySnapshot.hits.length > 0) {
      injectedSystemMessages.push({ role: 'system', content: memorySnapshot.context });
    }
    const enrichedMessages = injectedSystemMessages.length > 0 ? [...injectedSystemMessages, ...messages] : messages;
    const failures: string[] = [];

    for (const provider of providerOrder) {
      const model = config.models[provider];
      try {
        let reply = '';
        for await (const chunk of this.aiRouter.complete(
          enrichedMessages,
          {
            provider: provider as AiProvider,
            model,
            temperature: config.temperature,
            maxTokens: config.maxTokens,
            apiKey: this.resolveProviderKey(provider, config)
          },
          personality
        )) {
          if (!chunk.done) {
            const slices = this.sliceChunk(chunk.text);
            for (const slice of slices) {
              reply += slice;
              onChunk?.({ conversationId, text: slice, done: false, provider });
            }
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

        onChunk?.({ conversationId, text: '', done: true, provider });
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
    const incomingAliases = input.keyAliases ?? DEFAULT_AI_CONFIG.keyAliases;
    const models: Record<Provider, string> = {
      ollama: incomingModels.ollama?.trim() || DEFAULT_AI_CONFIG.models.ollama,
      openrouter: incomingModels.openrouter?.trim() || DEFAULT_AI_CONFIG.models.openrouter,
      openai: incomingModels.openai?.trim() || DEFAULT_AI_CONFIG.models.openai,
      anthropic: incomingModels.anthropic?.trim() || DEFAULT_AI_CONFIG.models.anthropic
    };
    const keyAliases: Record<Provider, string> = {
      ollama: incomingAliases.ollama?.trim() || '',
      openrouter: incomingAliases.openrouter?.trim() || '',
      openai: incomingAliases.openai?.trim() || '',
      anthropic: incomingAliases.anthropic?.trim() || ''
    };

    const fallbackCandidate = Array.isArray(input.fallbackOrder) ? input.fallbackOrder : DEFAULT_AI_CONFIG.fallbackOrder;
    const fallbackOrder = fallbackCandidate.filter((provider): provider is Provider =>
      AVAILABLE_PROVIDERS.includes(provider)
    );

    return {
      models,
      keyAliases,
      temperature: typeof input.temperature === 'number' ? Math.min(1.5, Math.max(0, input.temperature)) : DEFAULT_AI_CONFIG.temperature,
      maxTokens: typeof input.maxTokens === 'number' ? Math.min(2048, Math.max(64, Math.floor(input.maxTokens))) : DEFAULT_AI_CONFIG.maxTokens,
      fallbackOrder: fallbackOrder.length > 0 ? fallbackOrder : DEFAULT_AI_CONFIG.fallbackOrder
    };
  }

  private async hydrateMemoryIndex() {
    await this.vectorStore.clear();

    const messageRows = this.db
      .prepare(
        `
          SELECT id, conversation_id as conversationId, role, content
          FROM messages
          ORDER BY created_at ASC
        `
      )
      .all() as Array<{ id: string; conversationId: string; role: 'system' | 'user' | 'assistant'; content: string }>;

    for (const row of messageRows) {
      await this.vectorStore.upsert({
        id: `message:${row.id}`,
        text: row.content,
        metadata: {
          source: 'message',
          role: row.role,
          conversationId: row.conversationId
        },
        embedding: this.embedText(row.content)
      });
    }

    const summaries = this.db
      .prepare(
        `
          SELECT conversation_id as conversationId, summary, updated_at as updatedAt
          FROM memory_summaries
        `
      )
      .all() as MemorySummaryRow[];

    for (const summary of summaries) {
      await this.vectorStore.upsert({
        id: `summary:${summary.conversationId}`,
        text: summary.summary,
        metadata: {
          source: 'summary',
          conversationId: summary.conversationId,
          updatedAt: summary.updatedAt
        },
        embedding: this.embedText(summary.summary)
      });
    }
  }

  private async buildMemorySnapshot(query: string, activeConversationId: string): Promise<MemoryContextSnapshot> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      const empty: MemoryContextSnapshot = {
        query: '',
        context: 'No relevant memory items were found.',
        hits: [],
        generatedAt: new Date().toISOString()
      };
      this.lastMemoryContext = empty;
      return empty;
    }

    const rawResults = await this.vectorStore.similaritySearch(this.embedText(normalizedQuery), 8);
    const filtered = rawResults
      .filter((item) => item.score > 0.08)
      .filter((item) => item.metadata.conversationId !== activeConversationId || item.metadata.source === 'summary')
      .slice(0, 5);

    const context = buildMemoryContext(filtered);
    const snapshot: MemoryContextSnapshot = {
      query: normalizedQuery,
      context,
      hits: filtered.map((item) => ({
        id: item.id,
        score: item.score,
        text: item.text,
        source: item.metadata.source ?? 'message'
      })),
      generatedAt: new Date().toISOString()
    };
    this.lastMemoryContext = snapshot;
    return snapshot;
  }

  private embedText(input: string): number[] {
    const cleaned = input.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
    const terms = cleaned.split(/\s+/).filter(Boolean);
    const vectorSize = 64;
    const vector = new Array<number>(vectorSize).fill(0);

    for (const term of terms) {
      let hash = 2166136261;
      for (let i = 0; i < term.length; i += 1) {
        hash ^= term.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      const index = Math.abs(hash) % vectorSize;
      vector[index] += 1;
    }

    const magnitude = Math.sqrt(vector.reduce((total, value) => total + value * value, 0));
    if (magnitude === 0) {
      return vector;
    }
    return vector.map((value) => value / magnitude);
  }

  private compactConversationSummary(messages: ChatMessage[]): string {
    const userMessages = messages.filter((message) => message.role === 'user');
    const assistantMessages = messages.filter((message) => message.role === 'assistant');
    const latestUser = userMessages[userMessages.length - 1]?.content ?? '';
    const latestAssistant = assistantMessages[assistantMessages.length - 1]?.content ?? '';
    const summary = `User asked: ${latestUser.slice(0, 140)} | Assistant answered: ${latestAssistant.slice(0, 180)}`;
    return summary.trim();
  }

  private hydrateOfflineGrants() {
    const rows = this.db
      .prepare(
        `
          SELECT id, path, granted_at as grantedAt, reason
          FROM offline_grants
          ORDER BY granted_at ASC
        `
      )
      .all() as OfflineGrantRow[];

    for (const row of rows) {
      this.permissions.upsertGrant({
        id: row.id,
        path: row.path,
        grantedAt: row.grantedAt,
        reason: row.reason
      });
    }
  }

  private loadFileContextPaths(): string[] {
    const row = this.db
      .prepare(
        `
          SELECT value_json as valueJson
          FROM app_config
          WHERE key = ?
          LIMIT 1
        `
      )
      .get(FILE_CONTEXT_PATHS_KEY) as { valueJson: string } | undefined;

    if (!row) return [];
    try {
      const parsed = JSON.parse(row.valueJson) as string[];
      return Array.isArray(parsed) ? parsed.filter((item) => this.isPathAllowed(item)) : [];
    } catch {
      return [];
    }
  }

  private saveFileContextPaths(paths: string[]) {
    this.db
      .prepare(
        `
          INSERT INTO app_config (key, value_json, updated_at)
          VALUES (@key, @valueJson, @updatedAt)
          ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
        `
      )
      .run({
        key: FILE_CONTEXT_PATHS_KEY,
        valueJson: JSON.stringify(paths),
        updatedAt: new Date().toISOString()
      });
  }

  private isPathAllowed(filePath: string): boolean {
    try {
      this.permissions.assertPathAllowed(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private walkFiles(rootPath: string, maxDepth: number, maxFiles: number): string[] {
    const results: string[] = [];
    const stack: Array<{ path: string; depth: number }> = [{ path: rootPath, depth: 0 }];

    while (stack.length > 0 && results.length < maxFiles) {
      const current = stack.pop();
      if (!current) break;
      let entries: string[] = [];
      try {
        entries = readdirSync(current.path);
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (results.length >= maxFiles) break;
        const fullPath = join(current.path, entry);
        try {
          const stats = statSync(fullPath);
          if (stats.isDirectory() && current.depth < maxDepth) {
            stack.push({ path: fullPath, depth: current.depth + 1 });
          } else if (stats.isFile()) {
            results.push(fullPath);
          }
        } catch {
          continue;
        }
      }
    }

    return results;
  }

  private buildFileContextPrompt(): string | null {
    if (this.activeFileContextPaths.length === 0) {
      return null;
    }

    const summaries = this.activeFileContextPaths
      .map((filePath) => {
        try {
          return this.summarizeOfflineFile(filePath, 400);
        } catch {
          return null;
        }
      })
      .filter((item): item is FileSummary => Boolean(item))
      .slice(0, 5);

    if (summaries.length === 0) {
      return null;
    }

    const lines = summaries.map(
      (summary, index) =>
        `${index + 1}. ${summary.path} (${summary.sizeBytes} bytes): ${summary.excerpt.replace(/\s+/g, ' ').trim()}`
    );

    return ['User approved the following local files as chat context:', ...lines].join('\n');
  }

  private resolveProviderKeys(config: AiRuntimeConfig): Partial<Record<Provider, string>> {
    return {
      ollama: this.resolveProviderKey('ollama', config) ?? undefined,
      openrouter: this.resolveProviderKey('openrouter', config) ?? undefined,
      openai: this.resolveProviderKey('openai', config) ?? undefined,
      anthropic: this.resolveProviderKey('anthropic', config) ?? undefined
    };
  }

  private resolveProviderKey(provider: Provider, config: AiRuntimeConfig): string | undefined {
    if (provider === 'ollama') {
      return undefined;
    }
    if (!this.cloudRuntime) {
      return undefined;
    }
    const resolved = this.cloudRuntime.resolveProviderSecret(provider, config.keyAliases[provider]);
    return resolved ?? undefined;
  }

  private sliceChunk(input: string): string[] {
    const normalized = input.trim();
    if (!normalized) {
      return [];
    }
    const slices: string[] = [];
    let cursor = 0;
    const step = 42;
    while (cursor < normalized.length) {
      slices.push(normalized.slice(cursor, cursor + step));
      cursor += step;
    }
    return slices;
  }
}
