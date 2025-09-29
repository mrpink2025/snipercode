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

      // Fetch the target site with captured cookies
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      };

      if (cookieHeader) {
        headers['Cookie'] = cookieHeader;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: headers,
        redirect: 'follow'
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
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
          'Content-Type': contentType,
          'X-Frame-Options': 'ALLOWALL',
          'Content-Security-Policy': 'frame-ancestors *'
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