/**
 * Shared utilities for RunAnywhere SDK integration.
 * Used by both llm-engine.ts and tts-engine.ts to avoid duplication.
 */

export const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Returns the appropriate SDK environment based on the build mode.
 * Uses Production for prod builds, Development otherwise.
 */
export async function getSDKEnvironment(): Promise<any> {
  const { SDKEnvironment } = await import('@runanywhere/web');
  return import.meta.env.PROD ? SDKEnvironment.Production : SDKEnvironment.Development;
}

/**
 * Wraps a URL through the Supabase CORS proxy for cross-origin model downloads.
 * Falls back to direct URL if no Supabase URL is configured.
 */
export function getProxyUrl(url: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    console.warn('[STORYWORLD] No VITE_SUPABASE_URL, using direct URL');
    return url;
  }
  return `${supabaseUrl}/functions/v1/cors-proxy?url=${encodeURIComponent(url)}`;
}

/**
 * Fetch with an abort timeout.
 */
export async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
