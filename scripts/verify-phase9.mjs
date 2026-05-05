import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

const requiredPaths = [
  'packages/backend/package.json',
  'packages/backend/tsconfig.json',
  'packages/backend/src/types.ts',
  'packages/backend/src/client.ts',
  'packages/backend/src/auth.ts',
  'packages/backend/src/sync.ts',
  'packages/backend/src/vault.ts',
  'packages/backend/src/index.ts'
];

for (const path of requiredPaths) {
  if (!existsSync(join(root, path))) failures.push(`Missing required path: ${path}`);
}

const pkg = JSON.parse(readFileSync(join(root, 'packages/backend/package.json'), 'utf8').replace(/^\uFEFF/, ''));
const authSource = readFileSync(join(root, 'packages/backend/src/auth.ts'), 'utf8');
const syncSource = readFileSync(join(root, 'packages/backend/src/sync.ts'), 'utf8');
const vaultSource = readFileSync(join(root, 'packages/backend/src/vault.ts'), 'utf8');

if (!pkg.dependencies?.['@supabase/supabase-js']) failures.push('Missing backend dependency: @supabase/supabase-js.');
if (!authSource.includes('signInWithPassword')) failures.push('Auth service should support email/password sign in.');
if (!syncSource.includes('conversation_summaries')) failures.push('Sync service should manage conversation summaries.');
if (!vaultSource.includes('LocalKeyVault')) failures.push('Local key vault implementation missing.');

if (failures.length > 0) {
  console.error('Phase 9 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Phase 9 verification passed. Backend scaffold is ready.');
