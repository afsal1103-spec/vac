import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const requiredPaths = [
  'package.json',
  'pnpm-workspace.yaml',
  'tsconfig.base.json',
  '.editorconfig',
  '.gitignore',
  'README.md',
  '.github/workflows/build.yml',
  'apps/desktop/package.json',
  'apps/renderer/package.json',
  'packages/ai-core/package.json',
  'packages/avatar-engine/package.json',
  'packages/voice-engine/package.json',
  'packages/memory/package.json',
  'packages/offline/package.json',
  'packages/self-dev/package.json'
];

const readText = (relativePath) =>
  readFileSync(join(root, relativePath), 'utf8').replace(/^\uFEFF/, '');

const workspaceFile = readText('pnpm-workspace.yaml');
const rootPackage = JSON.parse(readText('package.json'));
const failures = [];

for (const relativePath of requiredPaths) {
  if (!existsSync(join(root, relativePath))) {
    failures.push(`Missing required path: ${relativePath}`);
  }
}

for (const pattern of ['apps/*', 'packages/*']) {
  if (!workspaceFile.includes(pattern)) {
    failures.push(`Workspace pattern missing: ${pattern}`);
  }
}

if (rootPackage.private !== true) {
  failures.push('Root package must be private for a pnpm monorepo.');
}

if (!rootPackage.packageManager?.startsWith('pnpm@')) {
  failures.push('Root packageManager must pin pnpm.');
}

if (failures.length > 0) {
  console.error('Phase 0 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Phase 0 verification passed. VAC monorepo scaffold is ready.');
