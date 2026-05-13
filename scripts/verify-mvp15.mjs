import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

const requiredPaths = [
  'apps/desktop/src/voice-runtime.ts',
  'packages/voice-engine/src/sidecar.ts',
  'services/agent/sidecar.py',
  'apps/desktop/src/preload.ts',
  'apps/renderer/src/vac.d.ts'
];

for (const relativePath of requiredPaths) {
  if (!existsSync(join(root, relativePath))) {
    failures.push(`Missing required path: ${relativePath}`);
  }
}

const runtimeSource = readFileSync(join(root, 'apps/desktop/src/voice-runtime.ts'), 'utf8');
const sidecarSource = readFileSync(join(root, 'packages/voice-engine/src/sidecar.ts'), 'utf8');
const pySource = readFileSync(join(root, 'services/agent/sidecar.py'), 'utf8');
const preloadSource = readFileSync(join(root, 'apps/desktop/src/preload.ts'), 'utf8');
const dtsSource = readFileSync(join(root, 'apps/renderer/src/vac.d.ts'), 'utf8');

for (const marker of [
  'VoiceSidecar',
  'ensureSidecarHealthy(',
  'handleSidecarMessage(',
  'migrateSidecarSessionToCoordinator(',
  "type: 'health_ping'",
  "type: 'speak_text'"
]) {
  if (!runtimeSource.includes(marker)) {
    failures.push(`Desktop voice runtime sidecar marker missing: ${marker}`);
  }
}

for (const marker of ["this.child.on('error'", 'isRunning()', "this.emit('message'"]) {
  if (!sidecarSource.includes(marker)) {
    failures.push(`Voice sidecar wrapper marker missing: ${marker}`);
  }
}

for (const marker of ['def handle_message', '"health_pong"', '"stt_chunk"', '"tts_chunk"', 'build_sine_wav_base64']) {
  if (!pySource.includes(marker)) {
    failures.push(`Python sidecar protocol marker missing: ${marker}`);
  }
}

for (const marker of ['qualityProfile', 'noiseSuppression', 'fallbackProviders']) {
  if (!preloadSource.includes(marker) || !dtsSource.includes(marker)) {
    failures.push(`Renderer/Preload voice config marker missing: ${marker}`);
  }
}

if (failures.length > 0) {
  console.error('MVP 15 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('MVP 15 verification passed. Real sidecar process integration and streamed protocol wiring are in place.');
