import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];

const requiredPaths = [
  '.github/workflows/build.yml',
  '.github/workflows/release.yml',
  'apps/desktop/package.json',
  'package.json'
];

for (const relativePath of requiredPaths) {
  if (!existsSync(join(root, relativePath))) {
    failures.push(`Missing required path: ${relativePath}`);
  }
}

const rootPackage = JSON.parse(
  readFileSync(join(root, 'package.json'), 'utf8').replace(/^\uFEFF/, '')
);
const desktopPackage = JSON.parse(
  readFileSync(join(root, 'apps/desktop/package.json'), 'utf8').replace(/^\uFEFF/, '')
);
const buildWorkflow = readFileSync(join(root, '.github/workflows/build.yml'), 'utf8');
const releaseWorkflow = readFileSync(join(root, '.github/workflows/release.yml'), 'utf8');
const mainSource = readFileSync(join(root, 'apps/desktop/src/main.ts'), 'utf8');

if (!rootPackage.scripts?.['package:desktop']) {
  failures.push('Root package should expose package:desktop.');
}

if (!rootPackage.scripts?.['verify:phase10']) {
  failures.push('Root package should expose verify:phase10.');
}

if (!desktopPackage.scripts?.package?.includes('electron-builder')) {
  failures.push('Desktop package script should call electron-builder.');
}

if (desktopPackage.dependencies?.electron || desktopPackage.dependencies?.['electron-builder']) {
  failures.push('Electron tooling should live in desktop devDependencies for electron-builder.');
}

if (!desktopPackage.devDependencies?.electron || !desktopPackage.devDependencies?.['electron-builder']) {
  failures.push('Desktop devDependencies should include electron and electron-builder.');
}

if (!JSON.stringify(desktopPackage.build?.extraResources ?? []).includes('../renderer/dist')) {
  failures.push('Desktop package should include renderer dist as extraResources.');
}

if (!mainSource.includes('process.resourcesPath')) {
  failures.push('Electron main should resolve renderer path in packaged apps.');
}

for (const os of ['windows-latest', 'macos-latest', 'ubuntu-latest']) {
  if (!buildWorkflow.includes(os) || !releaseWorkflow.includes(os)) {
    failures.push(`CI/release matrix missing ${os}.`);
  }
}

if (!releaseWorkflow.includes('workflow_dispatch')) {
  failures.push('Release workflow should support manual dispatch.');
}

if (!releaseWorkflow.includes('actions/upload-artifact@v4')) {
  failures.push('Release workflow should upload packaged artifacts.');
}

if (!releaseWorkflow.includes('pnpm package:desktop')) {
  failures.push('Release workflow should run pnpm package:desktop.');
}

if (failures.length > 0) {
  console.error('Phase 10 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Phase 10 verification passed. CI/CD and packaging scaffold is ready.');
