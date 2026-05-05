import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

const requiredPaths = [
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

const mainSource = readFileSync(join(root, 'apps/desktop/src/main.ts'), 'utf8');
const preloadSource = readFileSync(join(root, 'apps/desktop/src/preload.ts'), 'utf8');
const appSource = readFileSync(join(root, 'apps/renderer/src/App.tsx'), 'utf8');

for (const marker of ['vac:overlay-get-state', 'vac:overlay-state', "mode: 'thinking'", "mode: 'speaking'"]) {
  if (!mainSource.includes(marker) && !preloadSource.includes(marker)) {
    failures.push(`Overlay pipeline marker missing: ${marker}`);
  }
}

for (const marker of ['onStateChange', 'Overlay mode', 'overlayState.lastMessage']) {
  if (!appSource.includes(marker)) {
    failures.push(`Renderer overlay UI marker missing: ${marker}`);
  }
}

if (failures.length > 0) {
  console.error('MVP 2 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('MVP 2 verification passed. Overlay status loop is wired.');
