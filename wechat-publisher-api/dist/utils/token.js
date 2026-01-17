"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setCachedToken = exports.getCachedToken = void 0;
const tokenCache = new Map();
const EXPIRY_SAFETY_SECONDS = 300;
const getCachedToken = (appId) => {
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
exports.getCachedToken = getCachedToken;
const setCachedToken = (appId, accessToken, expiresIn) => {
    const expiresAt = Date.now() + Math.max(expiresIn - EXPIRY_SAFETY_SECONDS, 0) * 1000;
    tokenCache.set(appId, { accessToken, expiresAt });
};
exports.setCachedToken = setCachedToken;
