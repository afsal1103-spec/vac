import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

const requiredPaths = [
  'packages/self-dev/tsconfig.json',
  'packages/self-dev/src/types.ts',
  'packages/self-dev/src/proposal.ts',
  'packages/self-dev/src/sandbox.ts',
  'packages/self-dev/src/approval.ts',
  'packages/self-dev/src/deploy.ts',
  'packages/self-dev/src/engine.ts',
  'packages/self-dev/src/index.ts'
];

for (const path of requiredPaths) {
  if (!existsSync(join(root, path))) failures.push(`Missing required path: ${path}`);
}

const pkg = JSON.parse(readFileSync(join(root, 'packages/self-dev/package.json'), 'utf8').replace(/^\uFEFF/, ''));
const sandboxSource = readFileSync(join(root, 'packages/self-dev/src/sandbox.ts'), 'utf8');
const deploySource = readFileSync(join(root, 'packages/self-dev/src/deploy.ts'), 'utf8');

if (!pkg.dependencies?.vm2) failures.push('Missing self-dev dependency: vm2.');
if (!sandboxSource.includes('NodeVM')) failures.push('Sandbox runner must use vm2 NodeVM.');
if (!deploySource.includes('approval token')) failures.push('Production deploy should require explicit approval token.');
if (!deploySource.includes('applyToSandboxOnly')) failures.push('Sandbox-only deployment path missing.');

if (failures.length > 0) {
  console.error('Phase 8 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Phase 8 verification passed. Self-dev scaffold is ready.');
