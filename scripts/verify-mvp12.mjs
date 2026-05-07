import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

const requiredPaths = [
  'apps/desktop/src/main.ts',
  'apps/desktop/src/preload.ts',
  'apps/renderer/src/App.tsx',
  'apps/renderer/src/vac.d.ts',
  'apps/desktop/package.json'
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
const desktopPackage = readFileSync(join(root, 'apps/desktop/package.json'), 'utf8');

for (const marker of [
  'SelfDevEngine',
  'vac:self-dev-create-task',
  'vac:self-dev-approve-task',
  'vac:self-dev-run-sandbox',
  'vac:self-dev-deploy',
  'publishSelfDevUpdate('
]) {
  if (!mainSource.includes(marker)) {
    failures.push(`Desktop self-dev marker missing: ${marker}`);
  }
}

for (const marker of ['selfDev:', 'vac:self-dev-list-tasks', 'runSandbox', 'deployTask']) {
  if (!preloadSource.includes(marker)) {
    failures.push(`Preload self-dev marker missing: ${marker}`);
  }
}

for (const marker of ['MVP 12 self-dev execution loop', 'Propose task', 'Approve task', 'Run sandbox', 'Deploy production']) {
  if (!appSource.includes(marker)) {
    failures.push(`Projects UI marker missing: ${marker}`);
  }
}

if (!dtsSource.includes('selfDev:') || !dtsSource.includes('createTask') || !dtsSource.includes('deployTask')) {
  failures.push('Renderer self-dev type bridge missing.');
}

if (!desktopPackage.includes('"@vac/self-dev": "workspace:*"')) {
  failures.push('Desktop package dependency missing: @vac/self-dev');
}

if (failures.length > 0) {
  console.error('MVP 12 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('MVP 12 verification passed. Self-dev approval loop and project execution workflow are wired.');
