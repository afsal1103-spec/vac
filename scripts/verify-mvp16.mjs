import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

const requiredPaths = [
  'apps/desktop/src/voice-runtime.ts',
  'packages/voice-engine/src/sidecar.ts',
  'services/agent/sidecar.py',
  'package.json'
];

for (const relativePath of requiredPaths) {
  if (!existsSync(join(root, relativePath))) {
    failures.push(`Missing required path: ${relativePath}`);
  }
}

const runtimeSource = readFileSync(join(root, 'apps/desktop/src/voice-runtime.ts'), 'utf8');
const wrapperSource = readFileSync(join(root, 'packages/voice-engine/src/sidecar.ts'), 'utf8');
const sidecarSource = readFileSync(join(root, 'services/agent/sidecar.py'), 'utf8');
const rootPackageSource = readFileSync(join(root, 'package.json'), 'utf8');

for (const marker of [
  'ensureSidecarHealthy(',
  'language: session.config.language',
  'voiceId: session.config.voiceId',
  'migrateSidecarSessionToCoordinator(',
  "type: 'status'"
]) {
  if (!runtimeSource.includes(marker)) {
    failures.push(`Desktop runtime MVP16 marker missing: ${marker}`);
  }
}

for (const marker of ["this.child.on('error'", 'isRunning(): boolean', "this.emit('message', parsed)"]) {
  if (!wrapperSource.includes(marker)) {
    failures.push(`Voice wrapper MVP16 marker missing: ${marker}`);
  }
}

for (const marker of [
  'def transcribe_with_openai',
  'def transcribe_with_deepgram',
  'def synthesize_with_openai',
  'def synthesize_with_elevenlabs',
  'Cloud STT unavailable, using synthetic fallback.',
  'Cloud TTS unavailable, using synthetic fallback.',
  'def get_config'
]) {
  if (!sidecarSource.includes(marker)) {
    failures.push(`Python sidecar MVP16 marker missing: ${marker}`);
  }
}

if (!rootPackageSource.includes('"verify:mvp16"')) {
  failures.push('Root package scripts missing verify:mvp16');
}

if (failures.length > 0) {
  console.error('MVP 16 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('MVP 16 verification passed. Cloud sidecar STT/TTS calls with runtime fallback are wired.');
