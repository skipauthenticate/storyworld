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
];

function isAllowedUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'https:') return false;
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.startsWith('127.') || hostname.startsWith('10.') || hostname.startsWith('192.168.')) return false;
    return ALLOWED_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h));
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
    // Follow redirects and get final response
    const response = await fetch(targetUrl, { redirect: 'follow' });

    // Check if the redirect landed on an allowed host
    const finalUrl = response.url;
    if (finalUrl !== targetUrl) {
      const finalHostname = new URL(finalUrl).hostname.toLowerCase();
      const isAllowed = ALLOWED_HOSTS.some(h => finalHostname === h || finalHostname.endsWith('.' + h));
      if (!isAllowed) {
        // Also allow common CDN hosts for GitHub/HF redirects
        const cdnHosts = ['github-releases.githubusercontent.com', 'github-cloud.githubusercontent.com', 'github-cloud.s3.amazonaws.com'];
        const isCdn = cdnHosts.some(h => finalHostname === h || finalHostname.endsWith('.' + h));
        if (!isCdn) {
          throw new Error(`Redirect to disallowed host: ${finalHostname}`);
        }
      }
    }

    if (!response.ok) {
      throw new Error(`Upstream responded with ${response.status}`);
    }

    const headers = new Headers(corsHeaders);
    const ct = response.headers.get('content-type');
    if (ct) headers.set('Content-Type', ct);
    const cl = response.headers.get('content-length');
    if (cl) headers.set('Content-Length', cl);

    // Stream the response body through
    return new Response(response.body, { status: 200, headers });
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({ error: 'Failed to proxy request', detail: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
