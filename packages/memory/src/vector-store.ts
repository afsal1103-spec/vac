import type { MemoryRecord, SearchResult } from './types.js';

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  const size = Math.min(a.length, b.length);
  for (let i = 0; i < size; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export interface VectorMemory {
  upsert(record: MemoryRecord): Promise<void>;
  similaritySearch(queryEmbedding: number[], topK: number): Promise<SearchResult[]>;
  clear(): Promise<void>;
}

export class InMemoryVectorStore implements VectorMemory {
  private records = new Map<string, MemoryRecord>();

  async upsert(record: MemoryRecord): Promise<void> {
    this.records.set(record.id, record);
  }

  async similaritySearch(queryEmbedding: number[], topK: number): Promise<SearchResult[]> {
    const rows: SearchResult[] = [];

    for (const record of this.records.values()) {
      rows.push({
        id: record.id,
        text: record.text,
        metadata: record.metadata,
        score: cosineSimilarity(queryEmbedding, record.embedding)
      });
    }

    rows.sort((left, right) => right.score - left.score);
    return rows.slice(0, topK);
  }

  async clear(): Promise<void> {
    this.records.clear();
  }
}
