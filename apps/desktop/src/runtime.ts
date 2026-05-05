import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

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

const DEFAULT_USER_ID = 'local-user';
const DEFAULT_PERSONALITY_ID = 'local-personality';

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
`;

function buildSystemPrompt(profile: AppProfile): string {
  return [
    `You are ${profile.assistantName}, a Virtual Avatar Companion.`,
    `Primary personality: ${profile.personality}.`,
    `Voice preset: ${profile.voice}.`,
    'Be concise, practical, and honest about runtime limitations.'
  ].join('\n');
}

export class VacRuntime {
  private readonly db = new Database(join(app.getPath('userData'), 'vac.sqlite'));

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
    if (profile.provider !== 'ollama') {
      return `${profile.assistantName} is configured for ${profile.provider}, but MVP 1 only wires a live Ollama request.`;
    }

    try {
      const response = await fetch('http://127.0.0.1:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2',
          stream: false,
          messages: [{ role: 'system', content: buildSystemPrompt(profile) }, ...messages]
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama returned ${response.status}`);
      }

      const payload = (await response.json()) as { message?: { content?: string } };
      return payload.message?.content?.trim() || 'Ollama returned an empty response.';
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown error';
      return `Ollama is unavailable right now. ${detail}`;
    }
  }
}
