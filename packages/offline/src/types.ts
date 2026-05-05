export type GeoPoint = {
  lat: number;
  lon: number;
};

export type TileRegion = {
  name: string;
  minZoom: number;
  maxZoom: number;
  northWest: GeoPoint;
  southEast: GeoPoint;
};

export type CachedTile = {
  z: number;
  x: number;
  y: number;
  url: string;
  fetchedAt: string;
};

export type DirectoryGrant = {
  id: string;
  path: string;
  grantedAt: string;
  reason: string;
};

export type FileSummary = {
  path: string;
  sizeBytes: number;
  lastModifiedIso: string;
  excerpt: string;
};
