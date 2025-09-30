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
  
  // Do not rewrite <a href>; navigation is handled via runtime postMessage patch
  // Keeping anchors intact to allow accurate absolute URLs inside the page.
  // (Counting anchors for debug parity)
  html = html.replace(
    /(<a\s[^>]*href=["'])([^"']+)(["'][^>]*)(>)/gi,
    (match) => {
      anchorCount++;
      return match; // no rewrite
    }
  );
  
  // Do not rewrite <form action>; navigation is handled via runtime patch
  html = html.replace(
    /(<form\s[^>]*action=["'])([^"']+)(["'][^>]*)(>)/gi,
    (match) => {
      formCount++;
      return match; // no rewrite
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
      
      const cookieCount = cookies.length;
      console.log(`POST: Attaching ${cookieCount} cookies to request`);

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
  
  console.log('[ProxyPatch] Initialized for:', BASE_PAGE_URL);
  
  function proxify(u) {
    if (!u || typeof u !== 'string' || u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('#')) return u;
    try {
      const absolute = new URL(u, BASE_PAGE_URL).href;
      if (absolute.startsWith(PROXY_BASE)) return absolute;
      return PROXY_BASE + '?url=' + encodeURIComponent(absolute) + '&incident=' + INCIDENT_ID;
    } catch (e) { return u; }
  }

  function sendNavigate(u) {
    try {
      const absoluteUrl = new URL(u, BASE_PAGE_URL).href;
      window.parent.postMessage({ type: 'proxy:navigate', url: absoluteUrl, incidentId: INCIDENT_ID }, '*');
    } catch (e) { console.warn('[ProxyPatch] Invalid URL for navigate:', u); }
  }
  
  try { const baseEl = document.createElement('base'); baseEl.href = BASE_PAGE_URL; document.head && document.head.prepend(baseEl); } catch {}

  function handleAnchorEvent(e) {
    let el = e.target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (el && el.tagName === 'A') {
      const href = el.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      e.preventDefault();
      e.stopPropagation();
      sendNavigate(el.href);
    }
  }
  // Capture multiple pointer events early to beat site handlers
  ['click','mousedown','pointerup','auxclick','touchend'].forEach((evt) => {
    document.addEventListener(evt, handleAnchorEvent, { capture: true, passive: false });
  });

  // Intercept window.open
  const _open = window.open;
  window.open = function(u) {
    sendNavigate(u as any);
    return null;
  } as any;
  
  // Intercept form submissions
  document.addEventListener('submit', function(e){
    const form = e.target as HTMLFormElement;
    const method = (form.method || 'GET').toUpperCase();
    if (method === 'GET') {
      e.preventDefault();
      e.stopPropagation();
      const formData = new FormData(form);
      const params = new URLSearchParams(formData as any);
      const action = form.action || BASE_PAGE_URL;
      const absoluteUrl = new URL(action, BASE_PAGE_URL).href;
      const urlWithParams = absoluteUrl + (absoluteUrl.includes('?') ? '&' : '?') + params.toString();
      sendNavigate(urlWithParams);
    } else if (method === 'POST') {
      // Avoid direct top-level navigation on POST for now
      e.preventDefault();
      e.stopPropagation();
      console.log('[ProxyPatch] Blocked POST form navigation');
    }
  }, true);
  
  // Intercept location changes
  const _assign = window.location.assign.bind(window.location);
  const _replace = window.location.replace.bind(window.location);
  window.location.assign = function(u){ sendNavigate(u as any); };
  window.location.replace = function(u){ sendNavigate(u as any); };
  
  // Intercept history API
  const _push = history.pushState.bind(history);
  const _rep = history.replaceState.bind(history);
  history.pushState = function(s, t, u){ if (u) { sendNavigate(u as any); return; } return _push(s, t, u); };
  history.replaceState = function(s, t, u){ if (u) { sendNavigate(u as any); return; } return _rep(s, t, u); };

  // Proxify resources (CSS, JS, images, etc.)
  const origSetAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    if (['src','action'].includes(String(name).toLowerCase()) || (String(name).toLowerCase() === 'href' && this.tagName !== 'A')) {
      value = proxify(String(value));
    }
    return origSetAttr.call(this, name, value);
  };
  
  ['HTMLLinkElement','HTMLScriptElement','HTMLImageElement','HTMLFormElement','HTMLSourceElement'].forEach(function(cn){
    const p = (window as any)[cn] && (window as any)[cn].prototype;
    if(!p) return;
    ['href','src','action'].forEach(function(prop){
      const d = Object.getOwnPropertyDescriptor(p, prop);
      if(d && d.set){
        const o = d.set;
        Object.defineProperty(p, prop, {
          set(v){ return o!.call(this, proxify(v as any)); },
          get: d.get
        });
      }
    });
  });

  const of = window.fetch; window.fetch = function(u,o){ return of(proxify(u as any), o as any); } as any;
  const oo = XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open = function(m,u){ arguments[1] = proxify(u as any); return oo.apply(this, arguments as any); } as any;
  document.querySelectorAll('link[data-href]').forEach(function(l){ if(!l.getAttribute('href') || l.getAttribute('href')===window.location.href) l.setAttribute('href', proxify(l.getAttribute('data-href') as any) as any); });
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
            'X-Debug-ForceHtml': String(Boolean(forceHtml)),
            'X-Debug-Cookies-Attached': String(cookieCount)
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

      // Decode HTML entities in URL (e.g., &amp; -> &)
      const decodedUrl = targetUrl
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      
      console.log('GET proxy request for resource:', decodedUrl, 'incident:', incidentId);
      if (decodedUrl !== targetUrl) {
        console.log('  URL was decoded from:', targetUrl);
      }

      // Fetch cookies from incidents table
      let cookieHeader = '';
      let cookieCount = 0;
      try {
        const { data: incidentData } = await supabase
          .from('incidents')
          .select('full_cookie_data, cookie_data')
          .eq('incident_id', incidentId)
          .limit(1)
          .single();
        
        if (incidentData) {
          // Normalize cookies from either full_cookie_data or cookie_data
          let cookies: Array<{name: string, value: string}> = [];
          const src = incidentData.full_cookie_data ?? incidentData.cookie_data;
          
          const toArray = (val: any) => {
            if (!val) return [] as Array<{name:string,value:string}>;
            if (Array.isArray(val)) return val;
            if (typeof val === 'string') {
              try {
                const parsed = JSON.parse(val);
                if (Array.isArray(parsed)) return parsed;
                if (parsed && typeof parsed === 'object') {
                  return Object.entries(parsed).map(([name, value]) => ({ name, value: String(value) }));
                }
              } catch {}
              return [];
            }
            if (typeof val === 'object') {
              return Object.entries(val).map(([name, value]) => ({ name, value: String(value) }));
            }
            return [];
          };
          
          cookies = toArray(src);
          
          if (cookies.length > 0) {
            cookieHeader = cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
            cookieCount = cookies.length;
            console.log(`GET: Attaching ${cookieCount} cookies to request`);
          }
        }
      } catch (err) {
        console.error('Failed to fetch cookies for GET request:', err);
      }

      // Retry logic: try up to 3 times with different strategies
      let response: Response | null = null;
      let lastError: Error | null = null;
      let lastStatus = 0;
      let attemptVariant = 'original';
      
      const baseUrl = new URL(decodedUrl);
      const referrerUrl = `${baseUrl.protocol}//${baseUrl.host}`;

      // Build comprehensive headers (matching POST)
      const buildHeaders = (includeCookie: boolean) => {
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
        
        if (includeCookie && cookieHeader) {
          headers['Cookie'] = cookieHeader;
        }
        
        return headers;
      };

      // Attempt 1: Original URL with cookies
      try {
        console.log(`  Attempt 1: Fetching ${decodedUrl} with ${cookieCount} cookies`);
        response = await fetch(decodedUrl, {
          headers: buildHeaders(true),
          redirect: 'follow'
        });
        lastStatus = response.status;
        
        if (!response.ok) {
          console.log(`  Attempt 1 failed with status ${response.status}`);
          throw new Error(`HTTP ${response.status}`);
        }
        attemptVariant = 'original-with-cookies';
      } catch (error) {
        lastError = error as Error;
        response = null;
      }

      // Attempt 2: Original URL without cookies (if first attempt failed)
      if (!response || !response.ok) {
        try {
          console.log(`  Attempt 2: Fetching ${decodedUrl} WITHOUT cookies`);
          response = await fetch(decodedUrl, {
            headers: buildHeaders(false),
            redirect: 'follow'
          });
          lastStatus = response.status;
          
          if (!response.ok) {
            console.log(`  Attempt 2 failed with status ${response.status}`);
            throw new Error(`HTTP ${response.status}`);
          }
          attemptVariant = 'original-no-cookies';
        } catch (error) {
          lastError = error as Error;
          response = null;
        }
      }

      // Attempt 3: Toggle www subdomain (if previous attempts failed)
      if (!response || !response.ok) {
        try {
          const urlToTry = new URL(decodedUrl);
          const originalHost = urlToTry.host;
          
          if (originalHost.startsWith('www.')) {
            urlToTry.host = originalHost.substring(4);
          } else {
            urlToTry.host = 'www.' + originalHost;
          }
          
          const altUrl = urlToTry.href;
          console.log(`  Attempt 3: Trying alternate host ${altUrl} with cookies`);
          
          response = await fetch(altUrl, {
            headers: buildHeaders(true),
            redirect: 'follow'
          });
          lastStatus = response.status;
          
          if (!response.ok) {
            console.log(`  Attempt 3 failed with status ${response.status}`);
            throw new Error(`HTTP ${response.status}`);
          }
          attemptVariant = 'alternate-host';
        } catch (error) {
          lastError = error as Error;
          response = null;
        }
      }

      // If all attempts failed, return friendly error HTML
      if (!response || !response.ok) {
        const errorHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Erro ao Carregar Página</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
    }
    .error-container {
      background: rgba(255, 255, 255, 0.95);
      color: #333;
      border-radius: 12px;
      padding: 40px;
      max-width: 600px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    }
    h1 { color: #e74c3c; margin: 0 0 20px; }
    p { margin: 15px 0; line-height: 1.6; }
    .buttons {
      display: flex;
      gap: 15px;
      justify-content: center;
      margin-top: 30px;
      flex-wrap: wrap;
    }
    button, a.button {
      padding: 12px 24px;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
      transition: all 0.3s ease;
    }
    .btn-back {
      background: #3498db;
      color: white;
    }
    .btn-back:hover {
      background: #2980b9;
    }
    .btn-original {
      background: #2ecc71;
      color: white;
    }
    .btn-original:hover {
      background: #27ae60;
    }
    .error-code {
      font-family: monospace;
      background: #f5f5f5;
      padding: 10px;
      border-radius: 4px;
      margin: 20px 0;
      font-size: 14px;
      color: #666;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <div class="error-container">
    <h1>⚠️ Não foi possível carregar a página</h1>
    <p>O servidor não conseguiu acessar o conteúdo solicitado após múltiplas tentativas.</p>
    <div class="error-code">
      <strong>URL:</strong> ${decodedUrl}<br>
      <strong>Status:</strong> ${lastStatus || 'Erro de rede'}<br>
      <strong>Tentativas:</strong> 3<br>
      <strong>Erro:</strong> ${lastError?.message || 'Desconhecido'}
    </div>
    <p>Possíveis causas: bloqueio de bot, proteção DDoS, requisição inválida ou site fora do ar.</p>
    <div class="buttons">
      <button class="btn-back" onclick="window.history.back()">← Voltar</button>
      <a href="${decodedUrl}" target="_blank" class="button btn-original">Abrir Original ↗</a>
    </div>
  </div>
  <!-- Debug info:
    Incident ID: ${incidentId}
    Cookies attached: ${cookieCount}
    Last attempt variant: ${attemptVariant}
    Last status: ${lastStatus}
    Error: ${lastError?.toString()}
  -->
</body>
</html>`;

        return new Response(errorHtml, {
          status: lastStatus || 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/html; charset=utf-8',
            'X-Frame-Options': 'ALLOWALL',
            'Content-Security-Policy': 'frame-ancestors *',
            'X-Proxy-Status': 'error',
            'X-Debug-Attempts': '3',
            'X-Debug-Last-Status': String(lastStatus),
            'X-Debug-Variant': attemptVariant,
            'X-Debug-Error': lastError?.message || 'Unknown'
          }
        });
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
            'X-Debug-Final-CT': contentType,
            'X-Debug-Attempts': attemptVariant === 'original-with-cookies' ? '1' : (attemptVariant === 'original-no-cookies' ? '2' : '3'),
            'X-Debug-Variant': attemptVariant
          }
        });
      }

      // Text resources: read and decide
      let content = await response.text();
      const proxyBase = `https://vxvcquifgwtbjghrcjbp.supabase.co/functions/v1/site-proxy`;
      const detectedHtml = isLikelyHtml(content);
      const treatAsHtml = forceHtmlParam || detectedHtml || resourceType === 'html';

      if (treatAsHtml) {
        console.log('GET html proxied:', decodedUrl);
        // Remove blocking meta tags
        content = content.replace(/<meta[^>]*http-equiv=["']?X-Frame-Options["']?[^>]*>/gi, '');
        content = content.replace(/<meta[^>]*http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, '');
        // Inject runtime patch and rewrite (use decodedUrl for BASE_PAGE_URL)
const runtimePatchScript = `
<script>
(function() {
  const PROXY_BASE = '${proxyBase}';
  const INCIDENT_ID = '${incidentId}';
  const BASE_PAGE_URL = '${decodedUrl}';
  console.log('[ProxyPatch] Initialized for:', BASE_PAGE_URL);
  function proxify(u) { if (!u || typeof u !== 'string' || u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('#')) return u; try { const absolute = new URL(u, BASE_PAGE_URL).href; if (absolute.startsWith(PROXY_BASE)) return absolute; return PROXY_BASE + '?url=' + encodeURIComponent(absolute) + '&incident=' + INCIDENT_ID; } catch (e) { return u; } }
  function sendNavigate(u){ try { const absoluteUrl = new URL(u, BASE_PAGE_URL).href; window.parent.postMessage({ type:'proxy:navigate', url:absoluteUrl, incidentId:INCIDENT_ID }, '*'); } catch(e) { console.warn('[ProxyPatch] Invalid URL for navigate:', u); } }
  try { const baseEl = document.createElement('base'); baseEl.href = BASE_PAGE_URL; document.head && document.head.prepend(baseEl); } catch {}
  function handleAnchorEvent(e){ let el=e.target; while(el && el.tagName!=='A') el=el.parentElement; if(el && el.tagName==='A'){ const href=el.getAttribute('href'); if(!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return; e.preventDefault(); e.stopPropagation(); sendNavigate((el as HTMLAnchorElement).href); } }
  ['click','mousedown','pointerup','auxclick','touchend'].forEach((evt)=>{ document.addEventListener(evt, handleAnchorEvent, { capture:true, passive:false }); });
  const _open=window.open; window.open=function(u){ sendNavigate(u as any); return null; } as any;
  document.addEventListener('submit', function(e){ const form=e.target as HTMLFormElement; const method=(form.method||'GET').toUpperCase(); if(method==='GET'){ e.preventDefault(); e.stopPropagation(); const formData=new FormData(form); const params=new URLSearchParams(formData as any); const action=form.action||BASE_PAGE_URL; const absoluteUrl=new URL(action,BASE_PAGE_URL).href; const urlWithParams=absoluteUrl+(absoluteUrl.includes('?')?'&':'?')+params.toString(); sendNavigate(urlWithParams); } else if(method==='POST'){ e.preventDefault(); e.stopPropagation(); console.log('[ProxyPatch] Blocked POST form navigation'); } }, true);
  const _assign=window.location.assign.bind(window.location); const _replace=window.location.replace.bind(window.location); window.location.assign=function(u){ sendNavigate(u as any); }; window.location.replace=function(u){ sendNavigate(u as any); };
  const _push=history.pushState.bind(history); const _rep=history.replaceState.bind(history); history.pushState=function(s,t,u){ if(u){ sendNavigate(u as any); return; } return _push(s,t,u); }; history.replaceState=function(s,t,u){ if(u){ sendNavigate(u as any); return; } return _rep(s,t,u); };
  const sA=Element.prototype.setAttribute; Element.prototype.setAttribute=function(n,v){ if(['src','action'].includes(String(n).toLowerCase())||(String(n).toLowerCase()==='href' && this.tagName!=='A')) v=proxify(String(v)); return sA.call(this,n,v); };
  ['HTMLLinkElement','HTMLScriptElement','HTMLImageElement','HTMLFormElement','HTMLSourceElement'].forEach(function(cn){ const p=(window as any)[cn] && (window as any)[cn].prototype; if(!p) return; ['href','src','action'].forEach(function(prop){ const d=Object.getOwnPropertyDescriptor(p,prop); if(d && d.set){ const o=d.set; Object.defineProperty(p,prop,{ set(v){ return o!.call(this, proxify(v as any)); }, get:d.get }); } }); });
  const of=window.fetch; window.fetch=function(u,o){ return of(proxify(u as any), o as any); } as any;
  const oo=XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open=function(m,u){ arguments[1]=proxify(u as any); return oo.apply(this, arguments as any); } as any;
  document.querySelectorAll('link[data-href]').forEach(function(l){ if(!l.getAttribute('href') || l.getAttribute('href')===window.location.href) l.setAttribute('href', proxify(l.getAttribute('data-href') as any) as any); });
})();
</script>`;
        content = content.replace('</head>', `${runtimePatchScript}</head>`);
        content = rewriteHTMLUrls(content, decodedUrl, proxyBase, incidentId);
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
            'X-Debug-ForceHtml': String(forceHtmlParam),
            'X-Debug-Cookies-Attached': String(cookieCount),
            'X-Debug-Attempts': attemptVariant === 'original-with-cookies' ? '1' : (attemptVariant === 'original-no-cookies' ? '2' : '3'),
            'X-Debug-Variant': attemptVariant
          }
        });
      }

      if (resourceType === 'css') {
        const rewrittenContent = rewriteCSSUrls(content, decodedUrl, proxyBase, incidentId);
        return new Response(rewrittenContent, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/css; charset=utf-8',
            'X-Content-Type-Options': 'nosniff',
            'Cache-Control': 'public, max-age=21600',
            'X-Debug-Upstream-CT': contentType,
            'X-Debug-Final-CT': 'text/css; charset=utf-8',
            'X-Debug-Attempts': attemptVariant === 'original-with-cookies' ? '1' : (attemptVariant === 'original-no-cookies' ? '2' : '3'),
            'X-Debug-Variant': attemptVariant
          }
        });
      }

      return new Response(content, {
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=21600',
          'X-Debug-Upstream-CT': contentType,
          'X-Debug-Final-CT': contentType,
          'X-Debug-Attempts': attemptVariant === 'original-with-cookies' ? '1' : (attemptVariant === 'original-no-cookies' ? '2' : '3'),
          'X-Debug-Variant': attemptVariant
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