import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

const requiredPaths = [
  'apps/desktop/src/cloud-runtime.ts',
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

const cloudSource = readFileSync(join(root, 'apps/desktop/src/cloud-runtime.ts'), 'utf8');
const mainSource = readFileSync(join(root, 'apps/desktop/src/main.ts'), 'utf8');
const preloadSource = readFileSync(join(root, 'apps/desktop/src/preload.ts'), 'utf8');
const appSource = readFileSync(join(root, 'apps/renderer/src/App.tsx'), 'utf8');

for (const marker of ['VAC_SUPABASE_URL', 'VAC_SUPABASE_ANON_KEY', '/auth/v1/signup', "/rest/v1/${table}", 'conversation_summaries']) {
  if (!cloudSource.includes(marker)) {
    failures.push(`Cloud runtime marker missing: ${marker}`);
  }
}

for (const marker of ['vac:cloud-status', 'vac:cloud-sign-up', 'vac:cloud-sign-in', 'vac:cloud-sync-now']) {
  if (!mainSource.includes(marker) || !preloadSource.includes(marker)) {
    failures.push(`Cloud IPC marker missing: ${marker}`);
  }
}

for (const marker of ['Cloud sync', 'Sync profile now', 'window.vac.cloud.signIn', '.syncNow()']) {
  if (!appSource.includes(marker)) {
    failures.push(`Settings cloud UI marker missing: ${marker}`);
  }
}

if (failures.length > 0) {
  console.error('MVP 4 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('MVP 4 verification passed. Supabase auth and sync controls are wired.');
