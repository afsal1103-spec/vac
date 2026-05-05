import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];
const requiredFiles = [
  'apps/renderer/index.html',
  'apps/renderer/vite.config.ts',
  'apps/renderer/tsconfig.json',
  'apps/renderer/src/main.tsx',
  'apps/renderer/src/App.tsx',
  'apps/renderer/src/styles.css'
];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) failures.push(`Missing required file: ${file}`);
}

const appSource = readFileSync(join(root, 'apps/renderer/src/App.tsx'), 'utf8');
const packageJson = JSON.parse(
  readFileSync(join(root, 'apps/renderer/package.json'), 'utf8').replace(/^\uFEFF/, '')
);

for (const route of ['/onboarding', '/dashboard', '/chat', '/projects', '/customize', '/settings']) {
  if (!appSource.includes(`path="${route}"`)) failures.push(`Missing renderer route: ${route}`);
}

for (const dependency of ['react-router-dom', 'zustand', '@tanstack/react-query', 'vite']) {
  if (!packageJson.dependencies?.[dependency]) failures.push(`Renderer dependency missing: ${dependency}`);
}

if (!appSource.includes('Ready Player Me')) failures.push('Onboarding should include Ready Player Me avatar handoff scaffolding.');
if (!appSource.includes('Preferred AI provider')) failures.push('Onboarding should collect preferred AI provider.');
if (!appSource.includes('Voice selection')) failures.push('Onboarding should collect voice selection.');

if (failures.length > 0) {
  console.error('Phase 2 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Phase 2 verification passed. React renderer scaffold is ready.');
