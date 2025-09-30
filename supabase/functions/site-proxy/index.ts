import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProxyRequest {
  url: string;
  incidentId: string;
  cookies?: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
  }>;
}

// Utility to detect resource type from URL and Content-Type
function getResourceType(url: string, contentType: string): string {
  const urlLower = url.toLowerCase();
  const ctLower = contentType.toLowerCase();
  
  // Check Content-Type first
  if (ctLower.includes('text/html')) return 'html';
  if (ctLower.includes('text/css')) return 'css';
  if (ctLower.includes('javascript') || ctLower.includes('application/json')) return 'javascript';
  if (ctLower.includes('image/')) return 'image';
  if (ctLower.includes('font/') || ctLower.includes('woff')) return 'font';
  
  // Fallback to URL extension
  if (urlLower.match(/\.(jpg|jpeg|png|gif|svg|webp|ico)$/)) return 'image';
  if (urlLower.match(/\.(css)$/)) return 'css';
  if (urlLower.match(/\.(js|json)$/)) return 'javascript';
  if (urlLower.match(/\.(woff|woff2|ttf|eot)$/)) return 'font';
  
  return 'html';
}

// Rewrite URLs in HTML to go through proxy
function rewriteHTMLUrls(html: string, baseUrl: string, proxyBase: string, incidentId: string): string {
  const base = new URL(baseUrl);
  const origin = `${base.protocol}//${base.host}`;
  
  // Rewrite img src
  html = html.replace(
    /(<img[^>]+src=["'])([^"']+)(["'])/gi,
    (match, prefix, url, suffix) => {
      try {
        const absoluteUrl = new URL(url, origin).href;
        const proxiedUrl = `${proxyBase}?url=${encodeURIComponent(absoluteUrl)}&incident=${incidentId}`;
        console.log(`  Rewriting image: ${url} -> ${proxiedUrl}`);
        return `${prefix}${proxiedUrl}${suffix}`;
      } catch (e) {
        console.error(`  Failed to rewrite image URL: ${url}`, e);
        return match;
      }
    }
  );
  
  // Rewrite link href (CSS)
  html = html.replace(
    /(<link[^>]+href=["'])([^"']+)(["'][^>]*>)/gi,
    (match, prefix, url, suffix) => {
      if (match.includes('stylesheet')) {
        try {
          const absoluteUrl = new URL(url, origin).href;
          const proxiedUrl = `${proxyBase}?url=${encodeURIComponent(absoluteUrl)}&incident=${incidentId}`;
          console.log(`  Rewriting CSS: ${url} -> ${proxiedUrl}`);
          return `${prefix}${proxiedUrl}${suffix}`;
        } catch (e) {
          console.error(`  Failed to rewrite CSS URL: ${url}`, e);
          return match;
        }
      }
      return match;
    }
  );
  
  // Rewrite script src
  html = html.replace(
    /(<script[^>]+src=["'])([^"']+)(["'])/gi,
    (match, prefix, url, suffix) => {
      try {
        const absoluteUrl = new URL(url, origin).href;
        const proxiedUrl = `${proxyBase}?url=${encodeURIComponent(absoluteUrl)}&incident=${incidentId}`;
        console.log(`  Rewriting JS: ${url} -> ${proxiedUrl}`);
        return `${prefix}${proxiedUrl}${suffix}`;
      } catch (e) {
        console.error(`  Failed to rewrite JS URL: ${url}`, e);
        return match;
      }
    }
  );
  
  // Rewrite CSS url() references
  html = html.replace(
    /url\(["']?([^"')]+)["']?\)/gi,
    (match, url) => {
      try {
        const absoluteUrl = new URL(url, origin).href;
        return `url("${proxyBase}?url=${encodeURIComponent(absoluteUrl)}&incident=${incidentId}")`;
      } catch {
        return match;
      }
    }
  );
  
  return html;
}

// Rewrite URLs in CSS
function rewriteCSSUrls(css: string, baseUrl: string, proxyBase: string, incidentId: string): string {
  const base = new URL(baseUrl);
  const origin = `${base.protocol}//${base.host}`;
  
  return css.replace(
    /url\(["']?([^"')]+)["']?\)/gi,
    (match, url) => {
      try {
        const absoluteUrl = new URL(url, origin).href;
        return `url("${proxyBase}?url=${encodeURIComponent(absoluteUrl)}&incident=${incidentId}")`;
      } catch {
        return match;
      }
    }
  );
}

serve(async (req) => {
  console.log('Site proxy request:', req.method, req.url);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (req.method === 'POST') {
      const { url, incidentId, cookies = [] }: ProxyRequest = await req.json();
      
      console.log('Proxying URL:', url, 'for incident:', incidentId);
      
      // Validate URL
      if (!url || !url.startsWith('http')) {
        throw new Error('Invalid URL provided');
      }

      // Build cookie header from captured cookies
      const cookieHeader = cookies
        .map(cookie => `${cookie.name}=${cookie.value}`)
        .join('; ');

      // Get the base URL for referrer
      const baseUrl = new URL(url);
      const referrerUrl = `${baseUrl.protocol}//${baseUrl.host}`;

      // Realistic headers to bypass bot detection
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        'Connection': 'keep-alive',
        'DNT': '1',
        'Referer': referrerUrl,
        'Sec-CH-UA': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-CH-UA-Mobile': '?0',
        'Sec-CH-UA-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      };

      if (cookieHeader) {
        headers['Cookie'] = cookieHeader;
      }

      // Add random delay to simulate human behavior
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

      const response = await fetch(url, {
        method: 'GET',
        headers: headers,
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const resourceType = getResourceType(url, contentType);
      
      console.log(`Resource type detected: ${resourceType} for ${url}`);

      // Get proxy base URL for rewriting
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const proxyBase = `${supabaseUrl}/functions/v1/site-proxy`;

      // Handle different resource types
      if (resourceType === 'image' || resourceType === 'font') {
        // Binary resources - pass through directly
        const arrayBuffer = await response.arrayBuffer();
        
        return new Response(arrayBuffer, {
          headers: {
            ...corsHeaders,
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400', // 24h cache
            'X-Resource-Type': resourceType
          }
        });
      } else if (resourceType === 'css') {
        // CSS - rewrite internal URLs
        let content = await response.text();
        content = rewriteCSSUrls(content, url, proxyBase, incidentId);
        
        return new Response(content, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/css',
            'Cache-Control': 'public, max-age=21600', // 6h cache
            'X-Resource-Type': 'css'
          }
        });
      } else if (resourceType === 'javascript') {
        // JavaScript - pass through without modification
        const content = await response.text();
        
        return new Response(content, {
          headers: {
            ...corsHeaders,
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=21600', // 6h cache
            'X-Resource-Type': 'javascript'
          }
        });
      } else {
        // HTML - full processing with URL rewriting
        let content = await response.text();
        
        // Remove X-Frame-Options and CSP headers that might block iframe
        content = content.replace(
          /<meta[^>]*http-equiv=["']?X-Frame-Options["']?[^>]*>/gi,
          ''
        );
        content = content.replace(
          /<meta[^>]*http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi,
          ''
        );

        // Add iframe-friendly meta tags (NO base href - it conflicts with proxy)
        content = content.replace(
          '</head>',
          `<meta name="robots" content="noindex, nofollow">
           <style>
             body { margin: 0; padding: 10px; }
             * { max-width: 100% !important; }
           </style>
           </head>`
        );
        
        // Rewrite all URLs to go through proxy
        console.log('Starting URL rewriting for:', url);
        content = rewriteHTMLUrls(content, url, proxyBase, incidentId);
        console.log('URL rewriting complete');
        
        // Log the proxy access
        await supabase.from('audit_logs').insert({
          user_id: null,
          action: 'proxy_access',
          resource_type: 'site',
          resource_id: incidentId,
          new_values: { url, resourceType: 'html', timestamp: new Date().toISOString() }
        });
        
        return new Response(content, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/html',
            'X-Frame-Options': 'ALLOWALL',
            'Content-Security-Policy': 'frame-ancestors *',
            'Cache-Control': 'no-cache',
            'X-Resource-Type': 'html'
          }
        });
      }
    }

    // Handle GET requests with URL parameters (for resource proxying)
    if (req.method === 'GET') {
      const urlObj = new URL(req.url);
      const targetUrl = urlObj.searchParams.get('url');
      const incidentId = urlObj.searchParams.get('incident');
      
      if (!targetUrl || !incidentId) {
        return new Response(JSON.stringify({ error: 'Missing url or incident parameter' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('GET proxy request for resource:', targetUrl, 'incident:', incidentId);

      // Fetch the resource
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': '*/*',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          'Referer': new URL(targetUrl).origin
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch resource: ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const resourceType = getResourceType(targetUrl, contentType);

      // Handle binary resources
      if (resourceType === 'image' || resourceType === 'font') {
        const arrayBuffer = await response.arrayBuffer();
        return new Response(arrayBuffer, {
          headers: {
            ...corsHeaders,
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400'
          }
        });
      }

      // Handle text resources
      const content = await response.text();
      
      if (resourceType === 'css') {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const proxyBase = `${supabaseUrl}/functions/v1/site-proxy`;
        const rewrittenContent = rewriteCSSUrls(content, targetUrl, proxyBase, incidentId);
        
        return new Response(rewrittenContent, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/css',
            'Cache-Control': 'public, max-age=21600'
          }
        });
      }

      return new Response(content, {
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=21600'
        }
      });
    }


    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Site proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const errorDetails = error instanceof Error ? error.toString() : String(error);
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: errorDetails
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});