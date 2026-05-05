import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

const requiredPaths = [
  'packages/avatar-engine/tsconfig.json',
  'packages/avatar-engine/src/engine.ts',
  'packages/avatar-engine/src/ready-player-me.ts',
  'packages/avatar-engine/src/lip-sync.ts',
  'packages/avatar-engine/src/overlay.ts',
  'packages/avatar-engine/src/index.ts'
];

for (const path of requiredPaths) {
  if (!existsSync(join(root, path))) failures.push(`Missing required path: ${path}`);
}

const pkg = JSON.parse(readFileSync(join(root, 'packages/avatar-engine/package.json'), 'utf8').replace(/^\uFEFF/, ''));
const engineSource = readFileSync(join(root, 'packages/avatar-engine/src/engine.ts'), 'utf8');
const rpmSource = readFileSync(join(root, 'packages/avatar-engine/src/ready-player-me.ts'), 'utf8');

if (!pkg.dependencies?.three) failures.push('Avatar engine must depend on three.');
if (!pkg.dependencies?.['@readyplayerme/visage']) failures.push('Avatar engine must depend on @readyplayerme/visage.');
if (!engineSource.includes('loadAvatar(')) failures.push('Avatar engine should expose avatar loading.');
if (!engineSource.includes('setLipSyncTrack(')) failures.push('Avatar engine should expose lip sync track setter.');
if (!engineSource.includes('DEFAULT_VISEME_MAP')) failures.push('Avatar engine should define viseme map bindings.');
if (!rpmSource.includes('buildReadyPlayerMeCreateUrl')) failures.push('RPM URL builder is missing.');

if (failures.length > 0) {
  console.error('Phase 3 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Phase 3 verification passed. Avatar engine scaffold is ready.');
