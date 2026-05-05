import type { SearchResult } from './types.js';

export function buildMemoryContext(results: SearchResult[]): string {
  if (results.length === 0) {
    return 'No relevant memory items were found.';
  }

  const lines = results.map(
    (item, index) => `${index + 1}. (${item.score.toFixed(3)}) ${item.text}`
  );

  return ['You remember the following relevant history:', ...lines].join('\n');
}
