import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

const requiredPaths = [
  'packages/ai-core/tsconfig.json',
  'packages/ai-core/src/types.ts',
  'packages/ai-core/src/personality.ts',
  'packages/ai-core/src/providers.ts',
  'packages/ai-core/src/router.ts',
  'packages/ai-core/src/self-improvement.ts',
  'packages/ai-core/src/index.ts'
];

for (const path of requiredPaths) {
  if (!existsSync(join(root, path))) failures.push(`Missing required path: ${path}`);
}

const pkg = JSON.parse(readFileSync(join(root, 'packages/ai-core/package.json'), 'utf8').replace(/^\uFEFF/, ''));
const routerSource = readFileSync(join(root, 'packages/ai-core/src/router.ts'), 'utf8');
const personalitySource = readFileSync(join(root, 'packages/ai-core/src/personality.ts'), 'utf8');

for (const dep of ['openai', '@anthropic-ai/sdk', 'ollama']) {
  if (!pkg.dependencies?.[dep]) failures.push(`Missing ai-core dependency: ${dep}`);
}

if (!routerSource.includes('class AiRouter')) failures.push('AiRouter class is missing.');
if (!routerSource.includes('provider')) failures.push('Router should use provider selection.');
if (!routerSource.includes('buildPersonalitySystemPrompt')) failures.push('Router should inject personality system prompt.');
if (!personalitySource.includes('DEFAULT_PERSONALITY')) failures.push('Default personality profile is missing.');

if (failures.length > 0) {
  console.error('Phase 5 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Phase 5 verification passed. AI core scaffold is ready.');
