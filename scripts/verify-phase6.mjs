import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

const requiredPaths = [
  'packages/memory/tsconfig.json',
  'packages/memory/src/types.ts',
  'packages/memory/src/schema.ts',
  'packages/memory/src/sqlite-store.ts',
  'packages/memory/src/vector-store.ts',
  'packages/memory/src/retrieval.ts',
  'packages/memory/src/index.ts'
];

for (const path of requiredPaths) {
  if (!existsSync(join(root, path))) failures.push(`Missing required path: ${path}`);
}

const pkg = JSON.parse(readFileSync(join(root, 'packages/memory/package.json'), 'utf8').replace(/^\uFEFF/, ''));
const schemaSource = readFileSync(join(root, 'packages/memory/src/schema.ts'), 'utf8');
const sqliteSource = readFileSync(join(root, 'packages/memory/src/sqlite-store.ts'), 'utf8');
const vectorSource = readFileSync(join(root, 'packages/memory/src/vector-store.ts'), 'utf8');

if (!pkg.dependencies?.['better-sqlite3']) failures.push('Missing memory dependency: better-sqlite3.');
for (const table of ['users', 'conversations', 'messages', 'personalities', 'skills', 'improvement_logs']) {
  if (!schemaSource.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
    failures.push(`Schema missing table: ${table}`);
  }
}
if (!sqliteSource.includes('class SqliteMemoryStore')) failures.push('SqliteMemoryStore class missing.');
if (!vectorSource.includes('similaritySearch')) failures.push('Vector store similarity search missing.');

if (failures.length > 0) {
  console.error('Phase 6 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Phase 6 verification passed. Memory scaffold is ready.');
