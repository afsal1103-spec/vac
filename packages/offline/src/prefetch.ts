import type { TileRegion } from './types.js';
import { buildTileUrl, estimateTileCount, latLonToTile } from './maps.js';

export type TilePrefetchPlan = {
  region: TileRegion;
  tileUrlTemplate: string;
  estimatedTiles: number;
  previewUrls: string[];
};

export function buildTilePrefetchPlan(region: TileRegion, tileUrlTemplate: string): TilePrefetchPlan {
  const estimatedTiles = estimateTileCount(region);
  const zoom = region.minZoom;
  const nw = latLonToTile(region.northWest, zoom);
  const se = latLonToTile(region.southEast, zoom);

  const previewUrls = [
    buildTileUrl(tileUrlTemplate, zoom, nw.x, nw.y),
    buildTileUrl(tileUrlTemplate, zoom, se.x, se.y)
  ];

  return {
    region,
    tileUrlTemplate,
    estimatedTiles,
    previewUrls
  };
}
