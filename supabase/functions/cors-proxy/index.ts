const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const ALLOWED_HOSTS = [
  'github.com',
  'objects.githubusercontent.com',
  'huggingface.co',
  'cdn-lfs.huggingface.co',
  'cdn-lfs-us-1.huggingface.co',
  'cdn-lfs.hf.co',
  'hf.co',
];

const CDN_HOSTS = [
  'github-releases.githubusercontent.com',
  'github-cloud.githubusercontent.com',
  'github-cloud.s3.amazonaws.com',
  'release-assets.githubusercontent.com',
  'cas-bridge.xethub.hf.co',
  'xethub.hf.co',
];

// Simple in-memory rate limiter: max 30 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; reset: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.reset) {
    rateLimitMap.set(ip, { count: 1, reset: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function isAllowedHost(hostname: string): boolean {
  return [...ALLOWED_HOSTS, ...CDN_HOSTS].some(h => hostname === h || hostname.endsWith('.' + h));
}

export function isAllowedUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'https:') return false;
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.startsWith('127.') || hostname.startsWith('10.') || hostname.startsWith('192.168.')) return false;
    return isAllowedHost(hostname);
  } catch {
    return false;
  }
}

export async function fetchAllowed(targetUrl: string, fetcher: typeof fetch = fetch): Promise<Response> {
  let currentUrl = targetUrl;
  for (let redirects = 0; ; redirects++) {
    if (!isAllowedUrl(currentUrl) || redirects > 5) {
      throw new Error('Disallowed URL or too many redirects');
    }
    const response = await fetcher(currentUrl, { redirect: 'manual' });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    if (!location) throw new Error('Redirect without location');
    currentUrl = new URL(location, currentUrl).href;
    await response.body?.cancel();
  }
}

if (typeof Deno !== 'undefined') Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'GET') {
    return new Response(null, { status: 405, headers: corsHeaders });
  }

  // Rate limiting
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
    });
  }

  const url = new URL(req.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl || !isAllowedUrl(targetUrl)) {
    return new Response(JSON.stringify({ error: 'Invalid or disallowed URL' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const response = await fetchAllowed(targetUrl);

    if (!response.ok) {
      throw new Error(`Upstream responded with ${response.status}`);
    }

    const headers = new Headers(corsHeaders);
    const ct = response.headers.get('content-type');
    if (ct) headers.set('Content-Type', ct);
    const cl = response.headers.get('content-length');
    if (cl) headers.set('Content-Length', cl);

    return new Response(response.body, { status: 200, headers });
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({ error: 'Failed to proxy request' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
