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
  
  let linkCount = 0, anchorCount = 0, formCount = 0, srcsetCount = 0;
  
  // Rewrite <a href> for navigation
  html = html.replace(
    /(<a\s[^>]*href=["'])([^"']+)(["'][^>]*)(>)/gi,
    (match, prefix, url, middle, suffix) => {
      try {
        const absoluteUrl = new URL(url, origin).href;
        const proxiedUrl = `${proxyBase}?url=${encodeURIComponent(absoluteUrl)}&incident=${incidentId}`;
        // Force target=_self to stay in iframe
        let newMiddle = middle.replace(/target=["'][^"']*["']/gi, '');
        newMiddle += ' target="_self"';
        if (anchorCount < 5) console.log(`  Rewriting anchor: ${url}`);
        anchorCount++;
        return `${prefix}${proxiedUrl}${newMiddle}${suffix}`;
      } catch (e) {
        return match;
      }
    }
  );
  
  // Rewrite <form action>
  html = html.replace(
    /(<form\s[^>]*action=["'])([^"']+)(["'][^>]*)(>)/gi,
    (match, prefix, url, middle, suffix) => {
      try {
        const absoluteUrl = new URL(url, origin).href;
        const proxiedUrl = `${proxyBase}?url=${encodeURIComponent(absoluteUrl)}&incident=${incidentId}`;
        let newMiddle = middle.replace(/target=["'][^"']*["']/gi, '');
        newMiddle += ' target="_self"';
        if (formCount < 5) console.log(`  Rewriting form: ${url}`);
        formCount++;
        return `${prefix}${proxiedUrl}${newMiddle}${suffix}`;
      } catch (e) {
        return match;
      }
    }
  );
  
  // Rewrite img src
  html = html.replace(
    /(<img[^>]+src=["'])([^"']+)(["'])/gi,
    (match, prefix, url, suffix) => {
      try {
        const absoluteUrl = new URL(url, origin).href;
        const proxiedUrl = `${proxyBase}?url=${encodeURIComponent(absoluteUrl)}&incident=${incidentId}`;
        return `${prefix}${proxiedUrl}${suffix}`;
      } catch (e) {
        return match;
      }
    }
  );
  
  // Rewrite srcset (for responsive images)
  html = html.replace(
    /(\ssrcset=["'])([^"']+)(["'])/gi,
    (match, prefix, srcset, suffix) => {
      try {
        const urls = srcset.split(',').map((part: string) => {
          const trimmed = part.trim();
          const urlMatch = trimmed.match(/^(\S+)(\s+.*)?$/);
          if (urlMatch) {
            const url = urlMatch[1];
            const descriptor = urlMatch[2] || '';
            const absoluteUrl = new URL(url, origin).href;
            const proxiedUrl = `${proxyBase}?url=${encodeURIComponent(absoluteUrl)}&incident=${incidentId}`;
            return proxiedUrl + descriptor;
          }
          return trimmed;
        }).join(', ');
        if (srcsetCount < 3) console.log(`  Rewriting srcset`);
        srcsetCount++;
        return `${prefix}${urls}${suffix}`;
      } catch (e) {
        return match;
      }
    }
  );
  
  // Rewrite link href (CSS + preload)
  html = html.replace(
    /(<link[^>]*?)(\s+href=["'])([^"']+)(["'][^>]*>)/gi,
    (match, tagStart, hrefPrefix, url, tagEnd) => {
      const isStylesheet = /rel=["']stylesheet["']/i.test(match);
      const isPreload = /rel=["']preload["']/i.test(match) && /as=["']style["']/i.test(match);
      
      if (isStylesheet || isPreload) {
        try {
          const absoluteUrl = new URL(url, origin).href;
          const proxiedUrl = `${proxyBase}?url=${encodeURIComponent(absoluteUrl)}&incident=${incidentId}`;
          if (linkCount < 5) console.log(`  Rewriting link (${isPreload ? 'preload' : 'stylesheet'}): ${url}`);
          linkCount++;
          return `${tagStart}${hrefPrefix}${proxiedUrl}${tagEnd}`;
        } catch (e) {
          return match;
        }
      }
      return match;
    }
  );
  
  // Rewrite link data-href (lazy CSS)
  html = html.replace(
    /(<link[^>]*?)(\s+data-href=["'])([^"']+)(["'][^>]*>)/gi,
    (match, tagStart, dataHrefPrefix, url, tagEnd) => {
      try {
        const absoluteUrl = new URL(url, origin).href;
        const proxiedUrl = `${proxyBase}?url=${encodeURIComponent(absoluteUrl)}&incident=${incidentId}`;
        // Convert data-href to href so it loads immediately
        const newTag = `${tagStart} href="${proxiedUrl}"${tagEnd}`;
        if (linkCount < 5) console.log(`  Rewriting data-href to href: ${url}`);
        linkCount++;
        return newTag;
      } catch (e) {
        return match;
      }
    }
  );
  
  // Rewrite script src
  html = html.replace(
    /(<script[^>]+src=["'])([^"']+)(["'])/gi,
    (match, prefix, url, suffix) => {
      try {
        const absoluteUrl = new URL(url, origin).href;
        const proxiedUrl = `${proxyBase}?url=${encodeURIComponent(absoluteUrl)}&incident=${incidentId}`;
        return `${prefix}${proxiedUrl}${suffix}`;
      } catch (e) {
        return match;
      }
    }
  );
  
  // Rewrite video/audio/source src
  html = html.replace(
    /(<(?:video|audio|source)[^>]+src=["'])([^"']+)(["'])/gi,
    (match, prefix, url, suffix) => {
      try {
        const absoluteUrl = new URL(url, origin).href;
        const proxiedUrl = `${proxyBase}?url=${encodeURIComponent(absoluteUrl)}&incident=${incidentId}`;
        return `${prefix}${proxiedUrl}${suffix}`;
      } catch (e) {
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
  
  console.log(`  Rewrote: ${anchorCount} anchors, ${linkCount} links, ${formCount} forms, ${srcsetCount} srcsets`);
  
  return html;
}

// Rewrite URLs in CSS
function rewriteCSSUrls(css: string, baseUrl: string, proxyBase: string, incidentId: string): string {
  const base = new URL(baseUrl);
  const origin = `${base.protocol}//${base.host}`;
  
  // Rewrite url() references
  let result = css.replace(
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
  
  // Rewrite @import url(...)
  result = result.replace(
    /@import\s+url\(["']?([^"')]+)["']?\)/gi,
    (match, url) => {
      try {
        const absoluteUrl = new URL(url, origin).href;
        return `@import url("${proxyBase}?url=${encodeURIComponent(absoluteUrl)}&incident=${incidentId}")`;
      } catch {
        return match;
      }
    }
  );
  
  // Rewrite @import "..."
  result = result.replace(
    /@import\s+["']([^"']+)["']/gi,
    (match, url) => {
      try {
        const absoluteUrl = new URL(url, origin).href;
        return `@import "${proxyBase}?url=${encodeURIComponent(absoluteUrl)}&incident=${incidentId}"`;
      } catch {
        return match;
      }
    }
  );
  
  return result;
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

        // Inject runtime proxy patch script
        const runtimePatchScript = `
<script>
(function() {
  const PROXY_BASE = '${proxyBase}';
  const INCIDENT_ID = '${incidentId}';
  
  function proxify(url) {
    if (!url || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('#')) return url;
    try {
      const absolute = new URL(url, window.location.href).href;
      if (absolute.startsWith(PROXY_BASE)) return absolute;
      return PROXY_BASE + '?url=' + encodeURIComponent(absolute) + '&incident=' + INCIDENT_ID;
    } catch (e) {
      return url;
    }
  }
  
  // Patch setAttribute
  const origSetAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    if (['href', 'src', 'action'].includes(name.toLowerCase())) {
      value = proxify(value);
    }
    return origSetAttr.call(this, name, value);
  };
  
  // Patch property setters
  ['HTMLAnchorElement', 'HTMLLinkElement', 'HTMLScriptElement', 'HTMLImageElement', 
   'HTMLFormElement', 'HTMLSourceElement'].forEach(function(className) {
    const proto = window[className] && window[className].prototype;
    if (!proto) return;
    ['href', 'src', 'action'].forEach(function(prop) {
      const desc = Object.getOwnPropertyDescriptor(proto, prop);
      if (desc && desc.set) {
        const origSet = desc.set;
        Object.defineProperty(proto, prop, {
          set: function(value) { return origSet.call(this, proxify(value)); },
          get: desc.get
        });
      }
    });
  });
  
  // Patch fetch
  const origFetch = window.fetch;
  window.fetch = function(url, opts) {
    return origFetch(proxify(url), opts);
  };
  
  // Patch XHR
  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    arguments[1] = proxify(url);
    return origOpen.apply(this, arguments);
  };
  
  // Force all clicks on anchors to stay in frame
  document.addEventListener('click', function(e) {
    let el = e.target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (el && el.tagName === 'A') {
      el.target = '_self';
      if (el.href && !el.href.startsWith(PROXY_BASE)) {
        el.href = proxify(el.href);
      }
    }
  }, true);
  
  // Activate lazy CSS (data-href -> href)
  document.querySelectorAll('link[data-href]').forEach(function(link) {
    if (!link.href || link.href === window.location.href) {
      link.href = proxify(link.getAttribute('data-href'));
    }
  });
  
  console.log('[ProxyPatch] Runtime proxy patches applied');
})();
</script>`;
        
        // Add iframe-friendly meta tags and runtime patch
        content = content.replace(
          '</head>',
          `<meta name="robots" content="noindex, nofollow">
           <style>
             body { margin: 0; padding: 10px; }
             * { max-width: 100% !important; }
           </style>
           ${runtimePatchScript}
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
      let content = await response.text();
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const proxyBase = `${supabaseUrl}/functions/v1/site-proxy`;
      
      if (resourceType === 'css') {
        const rewrittenContent = rewriteCSSUrls(content, targetUrl, proxyBase, incidentId);
        
        return new Response(rewrittenContent, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/css',
            'Cache-Control': 'public, max-age=21600'
          }
        });
      }
      
      if (resourceType === 'html') {
        console.log('GET html proxied:', targetUrl);
        
        // Remove X-Frame-Options and CSP
        content = content.replace(/<meta[^>]*http-equiv=["']?X-Frame-Options["']?[^>]*>/gi, '');
        content = content.replace(/<meta[^>]*http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, '');
        
        // Inject runtime patch
        const runtimePatchScript = `
<script>
(function() {
  const PROXY_BASE = '${proxyBase}';
  const INCIDENT_ID = '${incidentId}';
  function proxify(url) {
    if (!url || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('#')) return url;
    try {
      const absolute = new URL(url, window.location.href).href;
      if (absolute.startsWith(PROXY_BASE)) return absolute;
      return PROXY_BASE + '?url=' + encodeURIComponent(absolute) + '&incident=' + INCIDENT_ID;
    } catch (e) { return url; }
  }
  const origSetAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    if (['href', 'src', 'action'].includes(name.toLowerCase())) value = proxify(value);
    return origSetAttr.call(this, name, value);
  };
  ['HTMLAnchorElement', 'HTMLLinkElement', 'HTMLScriptElement', 'HTMLImageElement', 
   'HTMLFormElement', 'HTMLSourceElement'].forEach(function(cn) {
    const p = window[cn] && window[cn].prototype;
    if (!p) return;
    ['href', 'src', 'action'].forEach(function(prop) {
      const d = Object.getOwnPropertyDescriptor(p, prop);
      if (d && d.set) {
        const oSet = d.set;
        Object.defineProperty(p, prop, { set: function(v) { return oSet.call(this, proxify(v)); }, get: d.get });
      }
    });
  });
  const oFetch = window.fetch;
  window.fetch = function(u, o) { return oFetch(proxify(u), o); };
  const oOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(m, u) { arguments[1] = proxify(u); return oOpen.apply(this, arguments); };
  document.addEventListener('click', function(e) {
    let el = e.target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (el && el.tagName === 'A') {
      el.target = '_self';
      if (el.href && !el.href.startsWith(PROXY_BASE)) el.href = proxify(el.href);
    }
  }, true);
  document.querySelectorAll('link[data-href]').forEach(function(l) {
    if (!l.href || l.href === window.location.href) l.href = proxify(l.getAttribute('data-href'));
  });
})();
</script>`;
        
        content = content.replace('</head>', `${runtimePatchScript}</head>`);
        content = rewriteHTMLUrls(content, targetUrl, proxyBase, incidentId);
        
        return new Response(content, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/html',
            'X-Frame-Options': 'ALLOWALL',
            'Content-Security-Policy': 'frame-ancestors *',
            'Cache-Control': 'no-cache'
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