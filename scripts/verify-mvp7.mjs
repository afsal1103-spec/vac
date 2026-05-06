import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

const requiredPaths = [
  'packages/ai-core/src/providers.ts',
  'packages/ai-core/src/types.ts',
  'apps/desktop/src/runtime.ts',
  'apps/desktop/src/cloud-runtime.ts',
  'apps/renderer/src/App.tsx'
];

for (const relativePath of requiredPaths) {
  if (!existsSync(join(root, relativePath))) {
    failures.push(`Missing required path: ${relativePath}`);
  }
}

const providersSource = readFileSync(join(root, 'packages/ai-core/src/providers.ts'), 'utf8');
const typesSource = readFileSync(join(root, 'packages/ai-core/src/types.ts'), 'utf8');
const runtimeSource = readFileSync(join(root, 'apps/desktop/src/runtime.ts'), 'utf8');
const cloudSource = readFileSync(join(root, 'apps/desktop/src/cloud-runtime.ts'), 'utf8');
const appSource = readFileSync(join(root, 'apps/renderer/src/App.tsx'), 'utf8');

for (const marker of ['api.openai.com/v1/chat/completions', 'api.anthropic.com/v1/messages', 'openrouter.ai/api/v1/chat/completions']) {
  if (!providersSource.includes(marker)) {
    failures.push(`Provider endpoint marker missing: ${marker}`);
  }
}

for (const marker of ['apiKey?: string']) {
  if (!typesSource.includes(marker)) {
    failures.push(`Completion options credential marker missing: ${marker}`);
  }
}

for (const marker of ['keyAliases', 'resolveProviderKey(', 'attachCloudRuntime(', 'apiKey: this.resolveProviderKey']) {
  if (!runtimeSource.includes(marker)) {
    failures.push(`Desktop runtime key wiring marker missing: ${marker}`);
  }
}

for (const marker of ['resolveProviderSecret(']) {
  if (!cloudSource.includes(marker)) {
    failures.push(`Vault secret resolver marker missing: ${marker}`);
  }
}

for (const marker of ['OpenAI key alias', 'OpenRouter key alias', 'Anthropic key alias']) {
  if (!appSource.includes(marker)) {
    failures.push(`Settings key alias marker missing: ${marker}`);
  }
}

if (failures.length > 0) {
  console.error('MVP 7 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('MVP 7 verification passed. Real cloud provider adapters and vault-backed key routing are wired.');
