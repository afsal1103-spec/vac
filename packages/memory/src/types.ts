export type SqliteMemoryConfig = {
  dbPath: string;
};

export type UserRow = {
  id: string;
  name: string;
  createdAt: string;
};

export type MessageRow = {
  id: string;
  conversationId: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export type MemoryRecord = {
  id: string;
  text: string;
  metadata: Record<string, string>;
  embedding: number[];
};

export type SearchResult = {
  id: string;
  text: string;
  score: number;
  metadata: Record<string, string>;
};
