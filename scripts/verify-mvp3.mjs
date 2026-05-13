import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

const requiredPaths = [
  'apps/desktop/src/voice-runtime.ts',
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

const mainSource = readFileSync(join(root, 'apps/desktop/src/main.ts'), 'utf8');
const preloadSource = readFileSync(join(root, 'apps/desktop/src/preload.ts'), 'utf8');
const appSource = readFileSync(join(root, 'apps/renderer/src/App.tsx'), 'utf8');
const runtimeSource = readFileSync(join(root, 'apps/desktop/src/voice-runtime.ts'), 'utf8');

for (const marker of ['vac:voice-session-start', 'vac:voice-session-stop', 'vac:voice-push-mic', 'vac:voice-speak-text']) {
  if (!mainSource.includes(marker) || !preloadSource.includes(marker)) {
    failures.push(`Voice IPC marker missing: ${marker}`);
  }
}

for (const marker of ['startSession', 'pushMicChunk', 'speakText', 'onEvent']) {
  if (!appSource.includes(marker)) {
    failures.push(`Renderer voice marker missing: ${marker}`);
  }
}

for (const marker of ['class VoiceRuntime', 'pushMicAudio', 'synthesizeText']) {
  if (!runtimeSource.includes(marker)) {
    failures.push(`Desktop voice runtime marker missing: ${marker}`);
  }
}

if (!runtimeSource.includes('tts_chunk') && !runtimeSource.includes('pushLlmChunk')) {
  failures.push('Desktop voice runtime marker missing: tts_chunk emission or pushLlmChunk handoff');
}

if (failures.length > 0) {
  console.error('MVP 3 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('MVP 3 verification passed. Mic capture and playback loop is wired.');
