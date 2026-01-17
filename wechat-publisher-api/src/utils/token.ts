interface TokenEntry {
  accessToken: string;
  expiresAt: number;
}

const tokenCache = new Map<string, TokenEntry>();
const EXPIRY_SAFETY_SECONDS = 300;

export const getCachedToken = (appId: string): string | null => {
  const entry = tokenCache.get(appId);
  if (!entry) {
    return null;
  }
  if (Date.now() >= entry.expiresAt) {
    tokenCache.delete(appId);
    return null;
  }
  return entry.accessToken;
};

export const setCachedToken = (appId: string, accessToken: string, expiresIn: number) => {
  const expiresAt = Date.now() + Math.max(expiresIn - EXPIRY_SAFETY_SECONDS, 0) * 1000;
  tokenCache.set(appId, { accessToken, expiresAt });
};
