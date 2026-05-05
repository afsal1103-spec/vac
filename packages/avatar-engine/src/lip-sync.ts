import type { LipSyncTrack, VisemeFrame } from './engine';

export function buildLipSyncTrackFromRhubarbLines(lines: string[]): LipSyncTrack {
  const frames: VisemeFrame[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const [timeText, visemeRaw] = trimmed.split(/\s+/);
    const seconds = Number.parseFloat(timeText);
    if (Number.isNaN(seconds) || !visemeRaw) continue;

    frames.push({
      time: Math.round(seconds * 1000),
      viseme: normalizeRhubarbViseme(visemeRaw),
      value: 1
    });
  }

  const durationMs = frames.length > 0 ? frames[frames.length - 1].time + 80 : 0;
  return { durationMs, frames };
}

function normalizeRhubarbViseme(raw: string): string {
  const map: Record<string, string> = {
    A: 'PP',
    B: 'KK',
    C: 'IH',
    D: 'AA',
    E: 'OH',
    F: 'OU',
    G: 'FF',
    H: 'TH',
    X: 'PP'
  };

  return map[raw.toUpperCase()] ?? 'PP';
}
