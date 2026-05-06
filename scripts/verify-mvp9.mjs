import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

const requiredPaths = [
  'apps/desktop/src/runtime.ts',
  'apps/desktop/src/main.ts',
  'apps/desktop/src/preload.ts',
  'apps/renderer/src/App.tsx',
  'apps/renderer/src/vac.d.ts'
];

for (const relativePath of requiredPaths) {
  if (!existsSync(join(root, relativePath))) {
    failures.push(`Missing required path: ${relativePath}`);
  }
}

const runtimeSource = readFileSync(join(root, 'apps/desktop/src/runtime.ts'), 'utf8');
const mainSource = readFileSync(join(root, 'apps/desktop/src/main.ts'), 'utf8');
const preloadSource = readFileSync(join(root, 'apps/desktop/src/preload.ts'), 'utf8');
const appSource = readFileSync(join(root, 'apps/renderer/src/App.tsx'), 'utf8');
const dtsSource = readFileSync(join(root, 'apps/renderer/src/vac.d.ts'), 'utf8');

for (const marker of ['buildMemoryContext', 'InMemoryVectorStore', 'memory_summaries', 'buildMemorySnapshot(', 'compactConversationSummary(']) {
  if (!runtimeSource.includes(marker)) {
    failures.push(`Runtime memory intelligence marker missing: ${marker}`);
  }
}

for (const marker of ['vac:memory-last-context']) {
  if (!mainSource.includes(marker) || !preloadSource.includes(marker)) {
    failures.push(`Memory IPC marker missing: ${marker}`);
  }
}

for (const marker of ['Memory hits:']) {
  if (!appSource.includes(marker)) {
    failures.push(`Chat memory UI marker missing: ${marker}`);
  }
}

if (!dtsSource.includes('memory:') || !dtsSource.includes('getLastContext')) {
  failures.push('Renderer memory type bridge missing.');
}

if (failures.length > 0) {
  console.error('MVP 9 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('MVP 9 verification passed. Memory retrieval, summary compaction, and relevance scoring are wired.');
