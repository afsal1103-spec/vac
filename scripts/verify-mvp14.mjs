import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

const requiredPaths = [
  'packages/voice-engine/src/types.ts',
  'packages/voice-engine/src/pipeline.ts',
  'packages/voice-engine/src/coordinator.ts',
  'apps/desktop/src/voice-runtime.ts',
  'apps/desktop/src/main.ts',
  'apps/desktop/package.json'
];

for (const relativePath of requiredPaths) {
  if (!existsSync(join(root, relativePath))) {
    failures.push(`Missing required path: ${relativePath}`);
  }
}

const typesSource = readFileSync(join(root, 'packages/voice-engine/src/types.ts'), 'utf8');
const pipelineSource = readFileSync(join(root, 'packages/voice-engine/src/pipeline.ts'), 'utf8');
const coordinatorSource = readFileSync(join(root, 'packages/voice-engine/src/coordinator.ts'), 'utf8');
const desktopRuntimeSource = readFileSync(join(root, 'apps/desktop/src/voice-runtime.ts'), 'utf8');
const mainSource = readFileSync(join(root, 'apps/desktop/src/main.ts'), 'utf8');
const desktopPkg = readFileSync(join(root, 'apps/desktop/package.json'), 'utf8');

for (const marker of ['qualityProfile', 'noiseSuppression', 'fallbackProviders', 'sttMaxRetries', 'ttsMaxRetries']) {
  if (!typesSource.includes(marker)) {
    failures.push(`Voice config marker missing in types.ts: ${marker}`);
  }
}

for (const marker of ['prepareMicAudio(', 'prepareTextForTts(', 'getProvider()', 'noise gate']) {
  if (!pipelineSource.includes(marker)) {
    failures.push(`Pipeline hardening marker missing: ${marker}`);
  }
}

for (const marker of [
  'VoiceCoordinatorOptions',
  'withRetriesAndFallback(',
  'switchToNextProvider(',
  "this.emit('status'",
  'buildProviderOrder('
]) {
  if (!coordinatorSource.includes(marker)) {
    failures.push(`Coordinator resilience marker missing: ${marker}`);
  }
}

for (const marker of ['VoiceEngineCoordinator', 'normalizeConfig(', 'fallbackProviders', 'qualityProfile']) {
  if (!desktopRuntimeSource.includes(marker)) {
    failures.push(`Desktop voice runtime integration marker missing: ${marker}`);
  }
}

for (const marker of ['vac:voice-session-start', 'vac:voice-session-stop', 'vac:voice-push-mic', 'vac:voice-speak-text']) {
  if (!mainSource.includes(marker)) {
    failures.push(`Desktop voice IPC marker missing: ${marker}`);
  }
}

if (!desktopPkg.includes('"@vac/voice-engine": "workspace:*"')) {
  failures.push('Desktop dependency missing: @vac/voice-engine');
}

if (failures.length > 0) {
  console.error('MVP 14 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('MVP 14 verification passed. Voice coordinator retries, fallback, and quality hardening are wired.');
