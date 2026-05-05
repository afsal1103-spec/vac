import Database from 'better-sqlite3';
import { SQLITE_SCHEMA } from './schema.js';
import type {
  ConversationRow,
  MessageRow,
  PersonalityRow,
  SqliteMemoryConfig,
  UserRow
} from './types.js';

export class SqliteMemoryStore {
  private db: Database.Database;

  constructor(config: SqliteMemoryConfig) {
    this.db = new Database(config.dbPath);
    this.db.pragma('journal_mode = WAL');
  }

  migrate() {
    this.db.exec(SQLITE_SCHEMA);
  }

  upsertUser(user: UserRow) {
    const statement = this.db.prepare(`
      INSERT INTO users (id, name, created_at)
      VALUES (@id, @name, @createdAt)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name
    `);

    statement.run(user);
  }

  upsertConversation(conversation: ConversationRow) {
    const statement = this.db.prepare(`
      INSERT INTO conversations (id, user_id, title, created_at)
      VALUES (@id, @userId, @title, @createdAt)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title
    `);

    statement.run(conversation);
  }

  upsertPersonality(personality: PersonalityRow) {
    const statement = this.db.prepare(`
      INSERT INTO personalities (id, user_id, profile_json, created_at)
      VALUES (@id, @userId, @profileJson, @createdAt)
      ON CONFLICT(id) DO UPDATE SET profile_json=excluded.profile_json
    `);

    statement.run(personality);
  }

  insertMessage(message: MessageRow) {
    const statement = this.db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, created_at)
      VALUES (@id, @conversationId, @role, @content, @createdAt)
    `);

    statement.run(message);
  }

  getRecentMessages(conversationId: string, limit = 20): MessageRow[] {
    const statement = this.db.prepare(`
      SELECT id,
             conversation_id as conversationId,
             role,
             content,
             created_at as createdAt
      FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `);

    return statement.all(conversationId, limit) as MessageRow[];
  }

  getUser(userId: string): UserRow | null {
    const statement = this.db.prepare(`
      SELECT id,
             name,
             created_at as createdAt
      FROM users
      WHERE id = ?
      LIMIT 1
    `);

    return (statement.get(userId) as UserRow | undefined) ?? null;
  }

  getPersonalityByUser(userId: string): PersonalityRow | null {
    const statement = this.db.prepare(`
      SELECT id,
             user_id as userId,
             profile_json as profileJson,
             created_at as createdAt
      FROM personalities
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);

    return (statement.get(userId) as PersonalityRow | undefined) ?? null;
  }

  listConversations(userId: string): ConversationRow[] {
    const statement = this.db.prepare(`
      SELECT id,
             user_id as userId,
             title,
             created_at as createdAt
      FROM conversations
      WHERE user_id = ?
      ORDER BY created_at DESC
    `);

    return statement.all(userId) as ConversationRow[];
  }

  close() {
    this.db.close();
  }
}
