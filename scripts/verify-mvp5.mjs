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

for (const marker of ['listKeyRefs', 'setKey(', 'removeKey(', 'safeStorage']) {
  if (!cloudSource.includes(marker)) {
    failures.push(`Vault runtime marker missing: ${marker}`);
  }
}

for (const marker of ['vac:vault-list', 'vac:vault-set', 'vac:vault-remove']) {
  if (!mainSource.includes(marker) || !preloadSource.includes(marker)) {
    failures.push(`Vault IPC marker missing: ${marker}`);
  }
}

for (const marker of ['Key vault', 'window.vac.vault.list()', 'Save key reference', 'Vault refs']) {
  if (!appSource.includes(marker)) {
    failures.push(`Settings polish marker missing: ${marker}`);
  }
}

if (failures.length > 0) {
  console.error('MVP 5 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('MVP 5 verification passed. Settings polish, vault management, and runtime smoke markers are wired.');
