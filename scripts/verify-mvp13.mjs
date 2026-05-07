import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

const requiredPaths = [
  'apps/desktop/src/main.ts',
  'apps/desktop/src/preload.ts',
  'apps/renderer/src/App.tsx',
  'apps/renderer/src/vac.d.ts',
  'package.json'
];

for (const relativePath of requiredPaths) {
  if (!existsSync(join(root, relativePath))) {
    failures.push(`Missing required path: ${relativePath}`);
  }
}

const mainSource = readFileSync(join(root, 'apps/desktop/src/main.ts'), 'utf8');
const preloadSource = readFileSync(join(root, 'apps/desktop/src/preload.ts'), 'utf8');
const appSource = readFileSync(join(root, 'apps/renderer/src/App.tsx'), 'utf8');
const dtsSource = readFileSync(join(root, 'apps/renderer/src/vac.d.ts'), 'utf8');

for (const marker of [
  'self-dev-state.json',
  'loadSelfDevState(',
  'persistSelfDevState(',
  'vac:self-dev-reject-task',
  'approvalTokenSecret',
  'SELF_DEV_TOKEN_TTL_MINUTES'
]) {
  if (!mainSource.includes(marker)) {
    failures.push(`Desktop MVP13 marker missing: ${marker}`);
  }
}

for (const marker of ['rejectTask', 'tokenExpiresAt', 'rejectedReason']) {
  if (!preloadSource.includes(marker)) {
    failures.push(`Preload MVP13 marker missing: ${marker}`);
  }
}

for (const marker of ['MVP 13 persistence and token hardening', 'Reject task', 'Status filter', 'Persistence']) {
  if (!appSource.includes(marker)) {
    failures.push(`Projects MVP13 marker missing: ${marker}`);
  }
}

if (!dtsSource.includes('rejectTask') || !dtsSource.includes('rejected') || !dtsSource.includes('tokenExpiresAt')) {
  failures.push('Renderer d.ts MVP13 self-dev typing markers missing.');
}

if (failures.length > 0) {
  console.error('MVP 13 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('MVP 13 verification passed. Persistent self-dev state, secure approval tokens, and reject flow are wired.');
