import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

const requiredPaths = [
  'packages/offline/tsconfig.json',
  'packages/offline/src/types.ts',
  'packages/offline/src/maps.ts',
  'packages/offline/src/file-agent.ts',
  'packages/offline/src/prefetch.ts',
  'packages/offline/src/index.ts'
];

for (const path of requiredPaths) {
  if (!existsSync(join(root, path))) failures.push(`Missing required path: ${path}`);
}

const pkg = JSON.parse(readFileSync(join(root, 'packages/offline/package.json'), 'utf8').replace(/^\uFEFF/, ''));
const fileAgentSource = readFileSync(join(root, 'packages/offline/src/file-agent.ts'), 'utf8');
const mapsSource = readFileSync(join(root, 'packages/offline/src/maps.ts'), 'utf8');

if (!pkg.dependencies?.leaflet) failures.push('Missing offline dependency: leaflet.');
if (!fileAgentSource.includes('assertPathAllowed')) failures.push('File agent should enforce user directory permissions.');
if (!mapsSource.includes('estimateTileCount')) failures.push('Offline maps should estimate tile count for prefetch.');
if (!mapsSource.includes('latLonToTile')) failures.push('Tile coordinate helper missing.');

if (failures.length > 0) {
  console.error('Phase 7 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Phase 7 verification passed. Offline scaffold is ready.');
