import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range, if-modified-since, cache-control',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
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
  forceHtml?: boolean;
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

// Heuristic to detect if text content is likely HTML
function isLikelyHtml(content: string): boolean {
  if (!content) return false;
  const head = content.slice(0, 2048);
  return /<!doctype\s+html/i.test(head) || /<html[\s>]/i.test(head) || /<head[\s>]/i.test(head) || /<body[\s>]/i.test(head);
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
        const proxiedUrl = `${proxyBase}?url=${encodeURIComponent(absoluteUrl)}&incident=${incidentId}&forceHtml=1`;
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
        const proxiedUrl = `${proxyBase}?url=${encodeURIComponent(absoluteUrl)}&incident=${incidentId}&forceHtml=1`;
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
      const { url, incidentId, cookies = [], forceHtml = false }: ProxyRequest = await req.json();
      
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
      const proxyBase = `https://vxvcquifgwtbjghrcjbp.supabase.co/functions/v1/site-proxy`;

      // Handle different resource types
      // Binary resources - pass through directly
      if (resourceType === 'image' || resourceType === 'font') {
        const arrayBuffer = await response.arrayBuffer();
        return new Response(arrayBuffer, {
          headers: {
            ...corsHeaders,
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400',
            'X-Resource-Type': resourceType,
            'X-Debug-Upstream-CT': contentType,
            'X-Debug-Final-CT': contentType
          }
        });
      }

      // Non-binary: read as text and decide
      const textContent = await response.text();
      const detectedHtml = isLikelyHtml(textContent);
      const treatAsHtml = Boolean(forceHtml) || detectedHtml || resourceType === 'html';

      if (treatAsHtml) {
        let content = textContent;
        // Remove X-Frame-Options and CSP meta tags
        content = content.replace(/<meta[^>]*http-equiv=["']?X-Frame-Options["']?[^>]*>/gi, '');
        content = content.replace(/<meta[^>]*http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, '');

        // Inject runtime proxy patch script
const runtimePatchScript = `
<script>
(function() {
  const PROXY_BASE = '${proxyBase}';
  const INCIDENT_ID = '${incidentId}';
  const BASE_PAGE_URL = '${url}';
  function proxify(u) {
    if (!u || u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('#')) return u;
    try {
      const absolute = new URL(u, BASE_PAGE_URL).href;
      if (absolute.startsWith(PROXY_BASE)) return absolute;
      return PROXY_BASE + '?url=' + encodeURIComponent(absolute) + '&incident=' + INCIDENT_ID + '&forceHtml=1';
    } catch (e) { return u; }
  }
  try { const baseEl = document.createElement('base'); baseEl.href = BASE_PAGE_URL; document.head && document.head.prepend(baseEl); } catch {}

  const origSetAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    if (['href','src','action'].includes(name.toLowerCase())) value = proxify(value);
    return origSetAttr.call(this, name, value);
  };
  ['HTMLAnchorElement','HTMLLinkElement','HTMLScriptElement','HTMLImageElement','HTMLFormElement','HTMLSourceElement'].forEach(function(cn){
    const p = (window as any)[cn] && (window as any)[cn].prototype; if(!p) return;
    ['href','src','action'].forEach(function(prop){
      const d = Object.getOwnPropertyDescriptor(p, prop); if(d && d.set){ const o = d.set; Object.defineProperty(p, prop, { set(v){ return o!.call(this, proxify(v)); }, get: d.get }); }
    });
  });
  const _assign = window.location.assign.bind(window.location);
  const _replace = window.location.replace.bind(window.location);
  window.location.assign = (u) => _assign(proxify(u));
  window.location.replace = (u) => _replace(proxify(u));
  const _push = history.pushState.bind(history);
  const _rep = history.replaceState.bind(history);
  history.pushState = function(s, t, u){ return _push(s, t, u ? proxify(String(u)) : u); };
  history.replaceState = function(s, t, u){ return _rep(s, t, u ? proxify(String(u)) : u); };

  const of = window.fetch; window.fetch = function(u,o){ return of(proxify(u as any), o as any); } as any;
  const oo = XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open = function(m,u){ arguments[1] = proxify(u as any); return oo.apply(this, arguments as any); } as any;
  document.addEventListener('click', function(e){ let el: any = e.target; while(el && el.tagName !== 'A') el = el.parentElement; if(el && el.tagName === 'A'){ el.target = '_self'; if(el.href && !el.href.startsWith(PROXY_BASE)) el.href = proxify(el.href); } }, true);
  document.querySelectorAll('link[data-href]').forEach(function(l:any){ if(!l.href || l.href === window.location.href) l.href = proxify(l.getAttribute('data-href')); });
})();
</script>`;

        // Add runtime and minimal styles
        content = content.replace('</head>', `<meta name="robots" content="noindex, nofollow">${runtimePatchScript}</head>`);
        console.log('Starting URL rewriting for:', url);
        content = rewriteHTMLUrls(content, url, proxyBase, incidentId);
        console.log('URL rewriting complete');

        // Audit log
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
            'Content-Type': 'text/html; charset=utf-8',
            'X-Frame-Options': 'ALLOWALL',
            'Content-Security-Policy': 'frame-ancestors *',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Content-Disposition': 'inline; filename="index.html"',
            'X-Resource-Type': 'html',
            'X-Proxy-Status': 'rendered',
            'X-Debug-Upstream-CT': contentType,
            'X-Debug-Final-CT': 'text/html; charset=utf-8',
            'X-Debug-IsLikelyHtml': String(detectedHtml),
            'X-Debug-ForceHtml': String(Boolean(forceHtml))
          }
        });
      }

      // CSS branch
      if (resourceType === 'css') {
        const rewritten = rewriteCSSUrls(textContent, url, proxyBase, incidentId);
        return new Response(rewritten, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/css; charset=utf-8',
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'public, max-age=21600',
            'X-Resource-Type': 'css',
            'X-Debug-Upstream-CT': contentType,
            'X-Debug-Final-CT': 'text/css; charset=utf-8'
          }
        });
      }

      // JavaScript or other text - passthrough
      return new Response(textContent, {
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=21600',
          'X-Resource-Type': resourceType,
          'X-Debug-Upstream-CT': contentType,
          'X-Debug-Final-CT': contentType
        }
      });
    }

    // Handle GET requests with URL parameters (for resource proxying)
    if (req.method === 'GET') {
      const urlObj = new URL(req.url);
      const targetUrl = urlObj.searchParams.get('url');
      const incidentId = urlObj.searchParams.get('incident');
      const forceHtmlParam = ['1', 'true'].includes((urlObj.searchParams.get('forceHtml') || '').toLowerCase());
      
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
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
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
            'Cache-Control': 'public, max-age=86400',
            'X-Debug-Upstream-CT': contentType,
            'X-Debug-Final-CT': contentType
          }
        });
      }

      // Text resources: read and decide
      let content = await response.text();
      const proxyBase = `https://vxvcquifgwtbjghrcjbp.supabase.co/functions/v1/site-proxy`;
      const detectedHtml = isLikelyHtml(content);
      const treatAsHtml = forceHtmlParam || detectedHtml || resourceType === 'html';

      if (treatAsHtml) {
        console.log('GET html proxied:', targetUrl);
        // Remove blocking meta tags
        content = content.replace(/<meta[^>]*http-equiv=["']?X-Frame-Options["']?[^>]*>/gi, '');
        content = content.replace(/<meta[^>]*http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, '');
        // Inject runtime patch and rewrite
const runtimePatchScript = `
<script>
(function() {
  const PROXY_BASE = '${proxyBase}';
  const INCIDENT_ID = '${incidentId}';
  const BASE_PAGE_URL = '${targetUrl}';
  function proxify(u) {
    if (!u || u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('#')) return u;
    try { const absolute = new URL(u, BASE_PAGE_URL).href; if (absolute.startsWith(PROXY_BASE)) return absolute; return PROXY_BASE + '?url=' + encodeURIComponent(absolute) + '&incident=' + INCIDENT_ID + '&forceHtml=1'; } catch (e) { return u; }
  }
  try { const baseEl = document.createElement('base'); baseEl.href = BASE_PAGE_URL; document.head && document.head.prepend(baseEl); } catch {}
  const sA = Element.prototype.setAttribute; Element.prototype.setAttribute = function(n,v){ if(['href','src','action'].includes(n.toLowerCase())) v = proxify(v); return sA.call(this,n,v); };
  ['HTMLAnchorElement','HTMLLinkElement','HTMLScriptElement','HTMLImageElement','HTMLFormElement','HTMLSourceElement'].forEach(function(cn){ const p=(window as any)[cn] && (window as any)[cn].prototype; if(!p) return; ['href','src','action'].forEach(function(prop){ const d=Object.getOwnPropertyDescriptor(p,prop); if(d && d.set){ const o=d.set; Object.defineProperty(p,prop,{ set(v){ return o!.call(this, proxify(v)); }, get:d.get }); } }); });
  const _assign = window.location.assign.bind(window.location);
  const _replace = window.location.replace.bind(window.location);
  window.location.assign = (u) => _assign(proxify(u));
  window.location.replace = (u) => _replace(proxify(u));
  const _push = history.pushState.bind(history);
  const _rep = history.replaceState.bind(history);
  history.pushState = function(s, t, u){ return _push(s, t, u ? proxify(String(u)) : u); };
  history.replaceState = function(s, t, u){ return _rep(s, t, u ? proxify(String(u)) : u); };
  const of=window.fetch; window.fetch=function(u,o){ return of(proxify(u as any), o as any); } as any;
  const oo=XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open=function(m,u){ arguments[1]=proxify(u as any); return oo.apply(this, arguments as any); } as any;
  document.addEventListener('click', function(e){ let el:any=e.target; while(el && el.tagName!=='A') el=el.parentElement; if(el && el.tagName==='A'){ el.target='_self'; if(el.href && !el.href.startsWith(PROXY_BASE)) el.href=proxify(el.href);} }, true);
  document.querySelectorAll('link[data-href]').forEach(function(l:any){ if(!l.href || l.href===window.location.href) l.href=proxify(l.getAttribute('data-href')); });
})();
</script>`;
        content = content.replace('</head>', `${runtimePatchScript}</head>`);
        content = rewriteHTMLUrls(content, targetUrl, proxyBase, incidentId);
        return new Response(content, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/html; charset=utf-8',
            'X-Frame-Options': 'ALLOWALL',
            'Content-Security-Policy': 'frame-ancestors *',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Content-Disposition': 'inline; filename="index.html"',
            'X-Proxy-Status': 'rendered',
            'X-Debug-Upstream-CT': contentType,
            'X-Debug-Final-CT': 'text/html; charset=utf-8',
            'X-Debug-IsLikelyHtml': String(detectedHtml),
            'X-Debug-ForceHtml': String(forceHtmlParam)
          }
        });
      }

      if (resourceType === 'css') {
        const rewrittenContent = rewriteCSSUrls(content, targetUrl, proxyBase, incidentId);
        return new Response(rewrittenContent, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/css; charset=utf-8',
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'public, max-age=21600',
            'X-Debug-Upstream-CT': contentType,
            'X-Debug-Final-CT': 'text/css; charset=utf-8'
          }
        });
      }

      return new Response(content, {
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=21600',
          'X-Debug-Upstream-CT': contentType,
          'X-Debug-Final-CT': contentType
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