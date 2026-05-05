import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];
const requiredFiles = [
  'apps/desktop/src/main.ts',
  'apps/desktop/src/preload.ts',
  'apps/desktop/tsconfig.json'
];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) failures.push(`Missing required file: ${file}`);
}

const mainSource = readFileSync(join(root, 'apps/desktop/src/main.ts'), 'utf8');
const preloadSource = readFileSync(join(root, 'apps/desktop/src/preload.ts'), 'utf8');
const desktopPackage = JSON.parse(
  readFileSync(join(root, 'apps/desktop/package.json'), 'utf8').replace(/^\uFEFF/, '')
);

const requiredMainSnippets = [
  'contextIsolation: true',
  'nodeIntegration: false',
  'transparent: true',
  'alwaysOnTop: true',
  'setIgnoreMouseEvents(true',
  "askForMediaAccess('microphone')"
];

for (const snippet of requiredMainSnippets) {
  if (!mainSource.includes(snippet)) failures.push(`Electron main missing snippet: ${snippet}`);
}

if (!preloadSource.includes('contextBridge.exposeInMainWorld')) {
  failures.push('Preload must expose a contextBridge API.');
}

if (desktopPackage.main !== 'dist/main.js') {
  failures.push('Desktop package main must point to dist/main.js.');
}

if (!desktopPackage.dependencies?.electron) {
  failures.push('Desktop package must depend on Electron.');
}

if (failures.length > 0) {
  console.error('Phase 1 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Phase 1 verification passed. Electron shell scaffold is ready.');
