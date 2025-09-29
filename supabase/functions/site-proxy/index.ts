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
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
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

      let providerUsed = 'direct';
      let response = await fetch(url, {
        method: 'GET',
        headers: headers,
        redirect: 'follow'
      });

      // If blocked by anti-bot, try fallbacks (if configured)
      if (!response.ok && [401, 403, 429, 503].includes(response.status)) {
        const scraperKey = Deno.env.get('SCRAPERAPI_KEY') ?? '';
        const zyteKey = Deno.env.get('ZYTE_API_KEY') ?? '';
        const browserlessUrl = Deno.env.get('BROWSERLESS_URL') ?? '';
        const browserlessToken = Deno.env.get('BROWSERLESS_TOKEN') ?? '';

        // 1) ScraperAPI fallback
        if (scraperKey) {
          try {
            providerUsed = 'scraperapi';
            const scraperUrl = `https://api.scraperapi.com/?api_key=${scraperKey}&render=true&keep_headers=true&device_type=desktop&country=br&url=${encodeURIComponent(url)}${cookieHeader ? `&cookies=${encodeURIComponent(cookieHeader)}` : ''}`;
            response = await fetch(scraperUrl, { method: 'GET' });
          } catch (e) {
            console.warn('ScraperAPI fallback failed:', e);
          }
        }

        // 2) Zyte (optional)
        if ((!response || !response.ok) && zyteKey) {
          try {
            providerUsed = 'zyte';
            const zyteUrl = `https://api.zyte.com/v1/extract?url=${encodeURIComponent(url)}`;
            const auth = 'Basic ' + btoa(`${zyteKey}:`);
            response = await fetch(zyteUrl, {
              method: 'GET',
              headers: {
                'Authorization': auth,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
              }
            });
          } catch (e) {
            console.warn('Zyte fallback failed:', e);
          }
        }

        // 3) Browserless (optional)
        if ((!response || !response.ok) && browserlessUrl && browserlessToken) {
          try {
            providerUsed = 'browserless';
            const navUrl = `${browserlessUrl.replace(/\/$/, '')}/content?token=${browserlessToken}`;
            const payload = { url, gotoOptions: { waitUntil: 'networkidle2' }, headers };
            response = await fetch(navUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
          } catch (e) {
            console.warn('Browserless fallback failed:', e);
          }
        }

        // If still not ok, return structured error
        if (!response || !response.ok) {
          const status = response?.status ?? 502;
          return new Response(
            JSON.stringify({ error: 'Failed to fetch target URL', status, provider: providerUsed }),
            { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      let content = await response.text();
      const contentType = response.headers.get('content-type') || '';

      // If it's HTML, modify it to work in iframe and add security headers
      if (contentType.includes('text/html')) {
        // Add base tag to handle relative URLs
        const baseUrl = new URL(url).origin;
        content = content.replace(
          '<head>',
          `<head><base href="${baseUrl}">`
        );

        // Remove X-Frame-Options and CSP headers that might block iframe
        content = content.replace(
          /<meta[^>]*http-equiv=["']?X-Frame-Options["']?[^>]*>/gi,
          ''
        );
        content = content.replace(
          /<meta[^>]*http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi,
          ''
        );

        // Add iframe-friendly meta tags
        content = content.replace(
          '</head>',
          `<meta name="robots" content="noindex, nofollow">
           <style>
             body { margin: 0; padding: 10px; }
             * { max-width: 100% !important; }
           </style>
           </head>`
        );
      }

      // Log the proxy access
      await supabase.from('audit_logs').insert({
        user_id: null, // Will be set by RLS if authenticated
        action: 'proxy_access',
        resource_type: 'site',
        resource_id: incidentId,
        new_values: { url, timestamp: new Date().toISOString() }
      });

      return new Response(content, {
        headers: {
          ...corsHeaders,
          'Content-Type': contentType || 'text/html; charset=utf-8',
          'X-Frame-Options': 'ALLOWALL',
          'Content-Security-Policy': 'frame-ancestors *',
          'X-Proxy-Provider': providerUsed
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