import type { GeoPoint, TileRegion } from './types.js';

export function estimateTileCount(region: TileRegion): number {
  let total = 0;
  for (let zoom = region.minZoom; zoom <= region.maxZoom; zoom += 1) {
    const nw = latLonToTile(region.northWest, zoom);
    const se = latLonToTile(region.southEast, zoom);
    const width = Math.abs(se.x - nw.x) + 1;
    const height = Math.abs(se.y - nw.y) + 1;
    total += width * height;
  }
  return total;
}

export function buildTileUrl(template: string, z: number, x: number, y: number): string {
  return template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
}

export function latLonToTile(point: GeoPoint, zoom: number): { x: number; y: number } {
  const latRad = (point.lat * Math.PI) / 180;
  const n = 2 ** zoom;
  const x = Math.floor(((point.lon + 180) / 360) * n);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}
