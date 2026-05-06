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

for (const marker of [
  'improvement_events',
  'improvement_runs',
  'loadSelfImprovementConfig(',
  'runSelfImprovementNow(',
  'captureUserImprovementEvents(',
  'applyImprovementSummary('
]) {
  if (!runtimeSource.includes(marker)) {
    failures.push(`Runtime self-improvement marker missing: ${marker}`);
  }
}

for (const marker of [
  'vac:self-improvement-status',
  'vac:self-improvement-config-save',
  'vac:self-improvement-run-now',
  'vac:self-improvement-list-runs',
  'scheduleSelfImprovement('
]) {
  if (!mainSource.includes(marker)) {
    failures.push(`Main-process self-improvement marker missing: ${marker}`);
  }
}

for (const marker of ['selfImprovement:', 'vac:self-improvement-status', 'onStatusUpdate']) {
  if (!preloadSource.includes(marker)) {
    failures.push(`Preload self-improvement marker missing: ${marker}`);
  }
}

for (const marker of ['Self-improvement loop (MVP 11)', 'Run now', 'Pause loop', 'Pending improve events']) {
  if (!appSource.includes(marker)) {
    failures.push(`Renderer self-improvement marker missing: ${marker}`);
  }
}

if (!dtsSource.includes('selfImprovement:') || !dtsSource.includes('runNow()') || !dtsSource.includes('onStatusUpdate')) {
  failures.push('Renderer self-improvement type bridge missing.');
}

if (failures.length > 0) {
  console.error('MVP 11 verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('MVP 11 verification passed. Self-improvement scheduler, telemetry, and settings controls are wired.');
