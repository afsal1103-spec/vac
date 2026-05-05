import Database from 'better-sqlite3';
import { SQLITE_SCHEMA } from './schema.js';
import type { MessageRow, SqliteMemoryConfig, UserRow } from './types.js';

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

  close() {
    this.db.close();
  }
}
