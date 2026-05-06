import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

const requiredPaths = [
  'apps/desktop/src/runtime.ts',
  'apps/desktop/src/main.ts',
  'apps/desktop/src/preload.ts',
  'apps/renderer/src/App.tsx',
  'apps/renderer/src/styles.css',
  'apps/renderer/public/vac_background.png'
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
const styleSource = readFileSync(join(root, 'apps/renderer/src/styles.css'), 'utf8');

for (const marker of ['AiRouter', 'loadAiConfig()', 'saveAiConfig(', 'getAiHealth()', 'fallbackOrder']) {
  if (!runtimeSource.includes(marker)) {
    failures.push(`Runtime routing marker missing: ${marker}`);
  }
}

for (const marker of ['vac:ai-config-get', 'vac:ai-config-save', 'vac:ai-health']) {
  if (!mainSource.includes(marker) || !preloadSource.includes(marker)) {
    failures.push(`AI IPC marker missing: ${marker}`);
  }
}

for (const marker of ['AI router (MVP 6)', 'Save AI config', 'Check provider health', '.getConfig()']) {
  if (!appSource.includes(marker)) {
    failures.push(`Settings AI marker missing: ${marker}`);
  }
}

if (!styleSource.includes("url('/vac_background.png')")) {
  failures.push('Global theme background image is not wired.');
}

if (failures.length > 0) {
  console.error('MVP 6 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('MVP 6 verification passed. Provider routing and global background theme are wired.');
