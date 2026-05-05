import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

const requiredPaths = [
  'packages/voice-engine/tsconfig.json',
  'packages/voice-engine/src/types.ts',
  'packages/voice-engine/src/sidecar.ts',
  'packages/voice-engine/src/adapters.ts',
  'packages/voice-engine/src/pipeline.ts',
  'packages/voice-engine/src/coordinator.ts',
  'packages/voice-engine/src/index.ts'
];

for (const path of requiredPaths) {
  if (!existsSync(join(root, path))) failures.push(`Missing required path: ${path}`);
}

const pkg = JSON.parse(readFileSync(join(root, 'packages/voice-engine/package.json'), 'utf8').replace(/^\uFEFF/, ''));
const pipelineSource = readFileSync(join(root, 'packages/voice-engine/src/pipeline.ts'), 'utf8');
const sidecarSource = readFileSync(join(root, 'packages/voice-engine/src/sidecar.ts'), 'utf8');

if (!pipelineSource.includes('pushMicAudio(')) failures.push('Voice pipeline should accept mic audio streaming input.');
if (!pipelineSource.includes('pushLlmChunk(')) failures.push('Voice pipeline should accept LLM chunk streaming input.');
if (!pipelineSource.includes("type: 'tts_chunk'")) failures.push('Voice pipeline should emit TTS chunk events.');
if (!sidecarSource.includes('spawn(')) failures.push('Voice sidecar should spawn a child process.');
if (!pkg.devDependencies?.typescript) failures.push('Voice engine should include TypeScript for compilation.');

if (failures.length > 0) {
  console.error('Phase 4 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Phase 4 verification passed. Voice engine scaffold is ready.');
