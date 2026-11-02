/**
 * Assetra Frontend API Configuration
 * Supports local development and production backends (e.g. Render / Railway).
 */

const envApiUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || '';
const rawBase = envApiUrl.trim().replace(/\/+$/, '');

export const API_BASE_URL = rawBase
  ? (rawBase.endsWith('/api') ? rawBase : `${rawBase}/api`)
  : '/api';

/**
 * Resolves an API path against the configured backend base URL.
 * Examples:
 *   getApiUrl('/api/assets') -> 'https://assetra-backend.onrender.com/api/assets' (or '/api/assets' locally)
 *   getApiUrl('/health')     -> 'https://assetra-backend.onrender.com/api/health' (or '/api/health' locally)
 */
export function getApiUrl(path) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!rawBase) {
    return cleanPath.startsWith('/api') ? cleanPath : `/api${cleanPath}`;
  }
  if (cleanPath.startsWith('/api')) {
    const withoutApi = cleanPath.slice(4);
    return `${API_BASE_URL}${withoutApi}`;
  }
  return `${API_BASE_URL}${cleanPath}`;
}
