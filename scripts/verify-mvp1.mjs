import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

const requiredPaths = [
  'apps/desktop/src/runtime.ts',
  'apps/desktop/src/preload.ts',
  'apps/desktop/src/main.ts',
  'apps/renderer/src/App.tsx',
  'apps/renderer/src/vac.d.ts'
];

for (const relativePath of requiredPaths) {
  if (!existsSync(join(root, relativePath))) {
    failures.push(`Missing required path: ${relativePath}`);
  }
}

const runtimeSource = readFileSync(join(root, 'apps/desktop/src/runtime.ts'), 'utf8');
const preloadSource = readFileSync(join(root, 'apps/desktop/src/preload.ts'), 'utf8');
const mainSource = readFileSync(join(root, 'apps/desktop/src/main.ts'), 'utf8');
const appSource = readFileSync(join(root, 'apps/renderer/src/App.tsx'), 'utf8');

for (const snippet of ['loadProfile()', 'saveProfile(', 'sendMessage(', 'listConversations()']) {
  if (!runtimeSource.includes(snippet)) {
    failures.push(`Runtime missing MVP behavior: ${snippet}`);
  }
}

for (const channel of ['vac:profile-load', 'vac:profile-save', 'vac:chat-list-conversations', 'vac:chat-send-message']) {
  if (!mainSource.includes(channel) || !preloadSource.includes(channel)) {
    failures.push(`Renderer bridge missing channel: ${channel}`);
  }
}

for (const marker of ['Save and continue', 'Saved threads', 'Ask VAC anything...']) {
  if (!appSource.includes(marker)) {
    failures.push(`Renderer MVP UI missing marker: ${marker}`);
  }
}

if (failures.length > 0) {
  console.error('MVP 1 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('MVP 1 verification passed. Local onboarding and chat loop is wired.');
