export type ReadyPlayerMeCreateUrlOptions = {
  appId: string;
  locale?: string;
  clearCache?: boolean;
};

const BASE_URL = 'https://demo.readyplayer.me/avatar';

export function buildReadyPlayerMeCreateUrl(options: ReadyPlayerMeCreateUrlOptions): string {
  const params = new URLSearchParams({
    frameApi: '1',
    appId: options.appId,
    bodyType: 'fullbody'
  });

  if (options.locale) params.set('locale', options.locale);
  if (options.clearCache) params.set('clearCache', 'true');

  return `${BASE_URL}?${params.toString()}`;
}

export function validateAvatarGlbUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol.startsWith('http') && parsed.pathname.endsWith('.glb');
  } catch {
    return false;
  }
}
