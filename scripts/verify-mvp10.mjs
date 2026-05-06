import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

const requiredPaths = [
  'apps/desktop/src/runtime.ts',
  'apps/desktop/src/main.ts',
  'apps/desktop/src/preload.ts',
  'apps/renderer/src/App.tsx',
  'apps/renderer/src/vac.d.ts',
  'packages/offline/src/file-agent.ts'
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
const offlineSource = readFileSync(join(root, 'packages/offline/src/file-agent.ts'), 'utf8');

for (const marker of ['FilePermissionRegistry', 'FileAgent', 'offline_grants', 'setChatFileContextPaths(', 'buildFileContextPrompt(']) {
  if (!runtimeSource.includes(marker)) {
    failures.push(`Runtime offline marker missing: ${marker}`);
  }
}

for (const marker of ['vac:offline-list-grants', 'vac:offline-pick-and-grant', 'vac:offline-search-files', 'vac:offline-set-chat-context']) {
  if (!mainSource.includes(marker) || !preloadSource.includes(marker)) {
    failures.push(`Offline IPC marker missing: ${marker}`);
  }
}

for (const marker of ['Offline file agent (MVP 10)', 'Pick and grant directory', 'Search granted files', 'Use in chat', 'File context:']) {
  if (!appSource.includes(marker)) {
    failures.push(`Renderer offline marker missing: ${marker}`);
  }
}

if (!dtsSource.includes('offline:') || !dtsSource.includes('pickAndGrant') || !dtsSource.includes('setChatContext')) {
  failures.push('Renderer offline type bridge missing.');
}

if (!offlineSource.includes('upsertGrant(')) {
  failures.push('Offline package grant hydration marker missing: upsertGrant');
}

if (failures.length > 0) {
  console.error('MVP 10 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('MVP 10 verification passed. Offline grants, file agent search, and chat file context are wired.');
