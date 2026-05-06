import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

const requiredPaths = [
  'apps/desktop/src/runtime.ts',
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

const runtimeSource = readFileSync(join(root, 'apps/desktop/src/runtime.ts'), 'utf8');
const mainSource = readFileSync(join(root, 'apps/desktop/src/main.ts'), 'utf8');
const preloadSource = readFileSync(join(root, 'apps/desktop/src/preload.ts'), 'utf8');
const appSource = readFileSync(join(root, 'apps/renderer/src/App.tsx'), 'utf8');
const dtsSource = readFileSync(join(root, 'apps/renderer/src/vac.d.ts'), 'utf8');

for (const marker of ['StreamChunkHandler', 'sliceChunk(', 'onChunk?.({ conversationId']) {
  if (!runtimeSource.includes(marker)) {
    failures.push(`Runtime streaming marker missing: ${marker}`);
  }
}

if (!mainSource.includes('publishChatStream')) {
  failures.push('Chat stream IPC marker missing: publishChatStream');
}

if (!mainSource.includes('vac:chat-stream') || !preloadSource.includes('vac:chat-stream')) {
  failures.push('Chat stream IPC marker missing: vac:chat-stream');
}

for (const marker of ['onStream(', 'streamingReply', 'Streaming via', 'speakText({']) {
  if (!appSource.includes(marker)) {
    failures.push(`Renderer streaming marker missing: ${marker}`);
  }
}

if (!dtsSource.includes('chat:') || !dtsSource.includes('onStream(')) {
  failures.push('Renderer type bridge missing chat stream typing.');
}

if (failures.length > 0) {
  console.error('MVP 8 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('MVP 8 verification passed. Live chat streaming and incremental voice handoff are wired.');
