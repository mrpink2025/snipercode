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
  rawContent?: boolean;
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

// Detect and return the correct Content-Type for browser interpretation
function getCorrectContentType(url: string, originalContentType: string, resourceType: string): string {
  const urlLower = url.toLowerCase();
  
  // CSS
  if (resourceType === 'css' || urlLower.endsWith('.css') || originalContentType.includes('text/css')) {
    return 'text/css; charset=utf-8';
  }
  
  // JavaScript
  if (resourceType === 'javascript' || urlLower.endsWith('.js') || originalContentType.includes('javascript')) {
    return 'application/javascript; charset=utf-8';
  }
  
  // JSON
  if (urlLower.endsWith('.json') || originalContentType.includes('json')) {
    return 'application/json; charset=utf-8';
  }
  
  // Images - return the correct type based on extension or original content type
  if (resourceType === 'image' || originalContentType.includes('image')) {
    if (urlLower.endsWith('.png')) return 'image/png';
    if (urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg')) return 'image/jpeg';
    if (urlLower.endsWith('.gif')) return 'image/gif';
    if (urlLower.endsWith('.svg')) return 'image/svg+xml';
    if (urlLower.endsWith('.webp')) return 'image/webp';
    if (urlLower.endsWith('.ico')) return 'image/x-icon';
    return originalContentType || 'application/octet-stream';
  }
  
  // Fonts
  if (resourceType === 'font') {
    if (urlLower.endsWith('.woff2')) return 'font/woff2';
    if (urlLower.endsWith('.woff')) return 'font/woff';
    if (urlLower.endsWith('.ttf')) return 'font/ttf';
    if (urlLower.endsWith('.eot')) return 'application/vnd.ms-fontobject';
    return originalContentType || 'application/octet-stream';
  }
  
  // HTML
  if (resourceType === 'html' || originalContentType.includes('text/html')) {
    return 'text/html; charset=utf-8';
  }
  
  // Default: return the original type or octet-stream
  return originalContentType || 'application/octet-stream';
}

// Rewrite URLs in HTML to go through proxy
function rewriteHTMLUrls(html: string, baseUrl: string, proxyBase: string, incidentId: string): string {
  const base = new URL(baseUrl);
  const origin = `${base.protocol}//${base.host}`;
  
  let linkCount = 0, anchorCount = 0, formCount = 0, srcsetCount = 0;
  
  // Rewrite <a href> as fallback (navigation primarily handled via runtime postMessage patch)
  html = html.replace(
    /(<a\s[^>]*href=["'])([^"']+)(["'][^>]*)(>)/gi,
    (match, prefix, url, middle, end) => {
      anchorCount++;
      try {
        const absoluteUrl = new URL(url, origin).href;
        const proxiedUrl = `${proxyBase}?url=${encodeURIComponent(absoluteUrl)}&incident=${incidentId}&forceHtml=1`;
        return `${prefix}${proxiedUrl}${middle} data-orig-href="${absoluteUrl}"${end}`;
      } catch (e) {
        return match;
      }
    }
  );
  
  // Rewrite <form action> as fallback
  html = html.replace(
    /(<form\s[^>]*action=["'])([^"']+)(["'][^>]*)(>)/gi,
    (match, prefix, url, middle, end) => {
      formCount++;
      try {
        const absoluteUrl = new URL(url, origin).href;
        const proxiedUrl = `${proxyBase}?url=${encodeURIComponent(absoluteUrl)}&incident=${incidentId}&forceHtml=1`;
        return `${prefix}${proxiedUrl}${middle} data-orig-action="${absoluteUrl}"${end}`;
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
      let { url, incidentId, cookies = [], forceHtml = false, rawContent = false }: ProxyRequest = await req.json();
      
      console.log('Proxying URL:', url, 'for incident:', incidentId);
      
      // If no cookies provided in POST body, fetch from DB
      if (!cookies || cookies.length === 0) {
        console.log('POST: No cookies in body, fetching from DB for incident:', incidentId);
        try {
          const { data: incidentData } = await supabase
            .from('incidents')
            .select('full_cookie_data, cookie_excerpt')
            .eq('incident_id', incidentId)
            .limit(1)
            .single();
          
          if (incidentData) {
            const src = incidentData.full_cookie_data ?? incidentData.cookie_excerpt;
            const toArray = (val: any): Array<{name: string, value: string, domain?: string, path?: string}> => {
              if (!val) return [];
              if (Array.isArray(val)) return val.filter((c: any) => c && c.name && c.value);
              if (typeof val === 'string') {
                try {
                  const parsed = JSON.parse(val);
                  if (Array.isArray(parsed)) return parsed.filter((c: any) => c && c.name && c.value);
                  if (parsed && typeof parsed === 'object') {
                    return Object.entries(parsed).map(([name, value]) => ({ name, value: String(value) })).filter(c => c.name);
                  }
                } catch {}
                if (val.includes('=')) {
                  return val.split(';').map((pair: string) => {
                    const [name, ...valueParts] = pair.trim().split('=');
                    return { name: name.trim(), value: valueParts.join('=').trim() };
                  }).filter((c: any) => c.name && c.value);
                }
                return [];
              }
              if (typeof val === 'object') {
                return Object.entries(val).map(([name, value]) => ({ name, value: String(value) })).filter(c => c.name);
              }
              return [];
            };
            
            cookies = toArray(src);
            console.log(`POST: Fetched ${cookies.length} cookies from DB`);
          }
        } catch (err) {
          console.error('POST: Error fetching cookies from DB:', err);
        }
      }
      
      // Validate URL
      if (!url || !url.startsWith('http')) {
        throw new Error('Invalid URL provided');
      }

      // Filter cookies by domain/path for the target URL
      const targetUrl = new URL(url);
      const targetHost = targetUrl.hostname;
      const targetPath = targetUrl.pathname;
      
      // Helper: check if cookie domain matches target host
      const matchDomain = (cookieDomain: string, targetHost: string): boolean => {
        if (!cookieDomain) return true; // host-only cookie
        const cleanDomain = cookieDomain.startsWith('.') ? cookieDomain.substring(1) : cookieDomain;
        return targetHost === cleanDomain || targetHost.endsWith('.' + cleanDomain);
      };
      
      // Helper: check if cookie path matches target path
      const matchPath = (cookiePath: string, targetPath: string): boolean => {
        if (!cookiePath || cookiePath === '/') return true;
        return targetPath === cookiePath || targetPath.startsWith(cookiePath + '/');
      };
      
      // Filter cookies that apply to this URL
      const rawCount = cookies.length;
      const applicableCookies = cookies.filter((cookie: any) => {
        const domain = cookie.domain || targetHost;
        const path = cookie.path || '/';
        return matchDomain(domain, targetHost) && matchPath(path, targetPath);
      });
      
      // Resolve duplicates: prefer most specific (longest domain/path)
      const cookieMap = new Map();
      for (const cookie of applicableCookies) {
        const existing = cookieMap.get(cookie.name);
        if (!existing) {
          cookieMap.set(cookie.name, cookie);
        } else {
          const existingDomain = existing.domain || '';
          const newDomain = cookie.domain || '';
          const existingPath = existing.path || '/';
          const newPath = cookie.path || '/';
          
          // Prefer longer (more specific) domain and path
          if (newDomain.length > existingDomain.length || 
              (newDomain.length === existingDomain.length && newPath.length > existingPath.length)) {
            cookieMap.set(cookie.name, cookie);
          }
        }
      }
      
      const finalCookies = Array.from(cookieMap.values());
      const cookieHeader = finalCookies.map(c => `${c.name}=${c.value}`).join('; ');
      const cookieCount = finalCookies.length;
      
      console.log(`POST: Cookie filtering: ${rawCount} raw → ${cookieCount} valid for ${targetHost}${targetPath}`);
      if (cookieCount > 0) {
        const sampleNames = finalCookies.slice(0, 5).map(c => c.name).join(', ');
        console.log(`POST: Sample cookies: ${sampleNames}${cookieCount > 5 ? '...' : ''}`);
      }

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

      // RAW CONTENT MODE: Return raw content with correct content type for browser interpretation
      if (rawContent) {
        const correctContentType = getCorrectContentType(url, contentType, resourceType);
        console.log(`POST rawContent=true → returning ${correctContentType}`);
        
        // For binary resources, return as buffer
        if (resourceType === 'image' || resourceType === 'font') {
          const arrayBuffer = await response.arrayBuffer();
          return new Response(arrayBuffer, {
            headers: {
              ...corsHeaders,
              'Content-Type': correctContentType,
              'X-Raw-Content': 'true'
            }
          });
        }
        
        // For text resources, return as text
        const rawText = await response.text();
        return new Response(rawText, {
          headers: {
            ...corsHeaders,
            'Content-Type': correctContentType,
            'X-Raw-Content': 'true'
          }
        });
      }

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
  
  // Detect if running standalone (not in iframe)
  const IS_STANDALONE = window.top === window;
  
  console.log('[ProxyPatch] Initialized for:', BASE_PAGE_URL, '| Standalone:', IS_STANDALONE);
  
  // Navigation debounce/guard
  let lastNavigateUrl = '';
  let lastNavigateTime = 0;
  
  // Extract original URL from proxified URL
  function deproxify(u) {
    if (!u || typeof u !== 'string') return u;
    try {
      if (u.startsWith(PROXY_BASE)) {
        const urlObj = new URL(u);
        const originalUrl = urlObj.searchParams.get('url');
        if (originalUrl) return decodeURIComponent(originalUrl);
      }
      return u;
    } catch (e) { return u; }
  }
  
  function proxify(u, forceHtml = false) {
    if (!u || typeof u !== 'string' || u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('#')) return u;
    try {
      const absolute = new URL(u, BASE_PAGE_URL).href;
      if (absolute.startsWith(PROXY_BASE)) return absolute;
      const suffix = forceHtml ? '&forceHtml=1' : '';
      return PROXY_BASE + '?url=' + encodeURIComponent(absolute) + '&incident=' + INCIDENT_ID + suffix;
    } catch (e) { return u; }
  }
  
  function normalizeUrl(u) {
    try {
      const url = new URL(u);
      return url.origin + url.pathname + url.search;
    } catch { return u; }
  }

  function sendNavigate(u) {
    try {
      const deproxified = deproxify(u);
      const absoluteUrl = new URL(deproxified, BASE_PAGE_URL).href;
      const normalized = normalizeUrl(absoluteUrl);
      
      // Guard: ignore if same as BASE_PAGE_URL
      if (normalized === normalizeUrl(BASE_PAGE_URL)) {
        console.log('[ProxyPatch] Navigate (ignored - same as base):', absoluteUrl);
        return;
      }
      
      // Debounce: ignore if same URL within 800ms
      const now = Date.now();
      if (normalized === lastNavigateUrl && (now - lastNavigateTime) < 800) {
        console.log('[ProxyPatch] Navigate (debounced):', absoluteUrl);
        return;
      }
      
      lastNavigateUrl = normalized;
      lastNavigateTime = now;
      
      console.log('[ProxyPatch] Navigate:', absoluteUrl);
      window.parent.postMessage({ type: 'proxy:navigate', url: absoluteUrl, incidentId: INCIDENT_ID }, '*');
    } catch (e) { console.warn('[ProxyPatch] Invalid URL for navigate:', u); }
  }
  
  // Inject base tag and send proxy:ready (only if in iframe)
  try { 
    const baseEl = document.createElement('base'); 
    baseEl.href = BASE_PAGE_URL; 
    document.head && document.head.prepend(baseEl);
    
    if (!IS_STANDALONE) {
      console.log('[ProxyPatch] Base tag injected, sending proxy:ready (early)');
      window.parent.postMessage({ type: 'proxy:ready', url: BASE_PAGE_URL }, '*');
    } else {
      console.log('[ProxyPatch] Base tag injected (standalone mode - no postMessage)');
    }
  } catch(e) {
    console.error('[ProxyPatch] Failed to inject base:', e);
  }
  
  // Send proxy:ready on DOMContentLoaded (only if in iframe)
  if (!IS_STANDALONE) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        console.log('[ProxyPatch] proxy:ready (DOMContentLoaded)');
        window.parent.postMessage({ type: 'proxy:ready', url: BASE_PAGE_URL }, '*');
      });
    }
    
    // Send proxy:ready on window.load
    window.addEventListener('load', function() {
      console.log('[ProxyPatch] proxy:ready (load)');
      window.parent.postMessage({ type: 'proxy:ready', url: BASE_PAGE_URL }, '*');
    });
    
    // Retry signals at intervals
    setTimeout(function() {
      console.log('[ProxyPatch] proxy:ready (retry-0ms)');
      window.parent.postMessage({ type: 'proxy:ready', url: BASE_PAGE_URL }, '*');
    }, 0);
    setTimeout(function() {
      console.log('[ProxyPatch] proxy:ready (retry-500ms)');
      window.parent.postMessage({ type: 'proxy:ready', url: BASE_PAGE_URL }, '*');
    }, 500);
    setTimeout(function() {
      console.log('[ProxyPatch] proxy:ready (retry-1500ms)');
      window.parent.postMessage({ type: 'proxy:ready', url: BASE_PAGE_URL }, '*');
    }, 1500);
  }

  // Standalone mode: fetch and render dynamically to bypass CSP
  async function fetchAndRender(destination) {
    try {
      console.log('[ProxyPatch] Fetching and rendering:', destination);
      const proxUrl = proxify(destination, true);
      const response = await fetch(proxUrl);
      const html = await response.text();
      document.open();
      document.write(html);
      document.close();
    } catch (error) {
      console.error('[ProxyPatch] fetchAndRender failed:', error);
      // Fallback to direct navigation
      window.location.href = proxify(destination, true);
    }
  }
  
  if (IS_STANDALONE) {
    console.log('[ProxyPatch] Standalone mode - intercepting navigation for dynamic rendering');
    
    // Intercept anchor clicks
    function handleAnchorEvent(e) {
      let el = e.target;
      while (el && el.tagName !== 'A') el = el.parentElement;
      if (el && el.tagName === 'A') {
        const origHref = el.getAttribute('data-orig-href');
        const href = origHref || el.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
        e.preventDefault();
        e.stopPropagation();
        const destination = deproxify(origHref || el.href);
        fetchAndRender(destination);
      }
    }
    
    ['click','mousedown','pointerup','auxclick','touchend'].forEach((evt) => {
      document.addEventListener(evt, handleAnchorEvent, { capture: true, passive: false });
    });
    
    // Redefine window.open
    const _open = window.open;
    window.open = function(u) {
      fetchAndRender(deproxify(u as any));
      return null;
    } as any;
    
    // Intercept GET forms
    document.addEventListener('submit', function(e) {
      const form = e.target as HTMLFormElement;
      const method = (form.method || 'GET').toUpperCase();
      if (method === 'GET') {
        e.preventDefault();
        e.stopPropagation();
        const formData = new FormData(form);
        const params = new URLSearchParams(formData as any);
        const origAction = form.getAttribute('data-orig-action');
        const action = origAction || form.action || BASE_PAGE_URL;
        const deproxified = deproxify(action);
        const absoluteUrl = new URL(deproxified, BASE_PAGE_URL).href;
        const urlWithParams = absoluteUrl + (absoluteUrl.includes('?') ? '&' : '?') + params.toString();
        fetchAndRender(urlWithParams);
      } else if (method === 'POST') {
        e.preventDefault();
        e.stopPropagation();
        console.log('[ProxyPatch] Blocked POST form navigation');
      }
    }, true);
  } else {
    // Iframe mode
    function handleAnchorEvent(e) {
      let el = e.target;
      while (el && el.tagName !== 'A') el = el.parentElement;
      if (el && el.tagName === 'A') {
        const origHref = el.getAttribute('data-orig-href');
        const href = origHref || el.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
        e.preventDefault();
        e.stopPropagation();
        sendNavigate(origHref || el.href);
      }
    }
    
    ['click','mousedown','pointerup','auxclick','touchend'].forEach((evt) => {
      document.addEventListener(evt, handleAnchorEvent, { capture: true, passive: false });
    });
    
    const _open = window.open;
    window.open = function(u) {
      sendNavigate(deproxify(u as any));
      return null;
    } as any;
    
    document.addEventListener('submit', function(e) {
      const form = e.target as HTMLFormElement;
      const method = (form.method || 'GET').toUpperCase();
      if (method === 'GET') {
        e.preventDefault();
        e.stopPropagation();
        const formData = new FormData(form);
        const params = new URLSearchParams(formData as any);
        const origAction = form.getAttribute('data-orig-action');
        const action = origAction || form.action || BASE_PAGE_URL;
        const deproxified = deproxify(action);
        const absoluteUrl = new URL(deproxified, BASE_PAGE_URL).href;
        const urlWithParams = absoluteUrl + (absoluteUrl.includes('?') ? '&' : '?') + params.toString();
        sendNavigate(urlWithParams);
      } else if (method === 'POST') {
        e.preventDefault();
        e.stopPropagation();
        console.log('[ProxyPatch] Blocked POST form navigation');
      }
    }, true);
  }

  // Proxify resources (CSS, JS, images, etc.)
  const origSetAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    const lowerName = String(name).toLowerCase();
    const isAnchor = this.tagName === 'A';
    const isForm = this.tagName === 'FORM';
    
    if (lowerName === 'href' && isAnchor) {
      value = proxify(String(value), true); // forceHtml for anchors
    } else if (lowerName === 'action' && isForm) {
      value = proxify(String(value), true); // forceHtml for forms
    } else if (['src','action'].includes(lowerName) || (lowerName === 'href' && !isAnchor)) {
      value = proxify(String(value));
    }
    return origSetAttr.call(this, name, value);
  };
  
  // Hook into property setters for dynamic changes
  const anchorProto = HTMLAnchorElement.prototype;
  const anchorHrefDesc = Object.getOwnPropertyDescriptor(anchorProto, 'href');
  if (anchorHrefDesc && anchorHrefDesc.set) {
    const originalAnchorSet = anchorHrefDesc.set;
    Object.defineProperty(anchorProto, 'href', {
      set(v) { return originalAnchorSet.call(this, proxify(v as any, true)); },
      get: anchorHrefDesc.get
    });
  }
  
  const formProto = HTMLFormElement.prototype;
  const formActionDesc = Object.getOwnPropertyDescriptor(formProto, 'action');
  if (formActionDesc && formActionDesc.set) {
    const originalFormSet = formActionDesc.set;
    Object.defineProperty(formProto, 'action', {
      set(v) { return originalFormSet.call(this, proxify(v as any, true)); },
      get: formActionDesc.get
    });
  }
  
  ['HTMLLinkElement','HTMLScriptElement','HTMLImageElement','HTMLSourceElement'].forEach(function(cn){
    const p = (window as any)[cn] && (window as any)[cn].prototype;
    if(!p) return;
    ['href','src'].forEach(function(prop){
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

        // Inject runtime patch script (try </head>, fallback to </body> or start of <html>)
        const injectionContent = `<meta name="robots" content="noindex, nofollow">${runtimePatchScript}`;
        if (content.includes('</head>')) {
          content = content.replace('</head>', `${injectionContent}</head>`);
        } else if (content.includes('</body>')) {
          content = content.replace('</body>', `${injectionContent}</body>`);
        } else if (content.match(/<html[^>]*>/i)) {
          content = content.replace(/(<html[^>]*>)/i, `$1${injectionContent}`);
        } else {
          content = injectionContent + content;
        }
        
        console.log('Starting URL rewriting for:', url);
        content = rewriteHTMLUrls(content, url, proxyBase, incidentId);
        console.log('URL rewriting complete');

        // Audit log (use 'update' action to avoid enum error)
        await supabase.from('audit_logs').insert({
          user_id: null,
          action: 'update',
          resource_type: 'site',
          resource_id: incidentId,
          new_values: { url, resourceType: 'html', timestamp: new Date().toISOString() }
        });

        return new Response(content, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/html; charset=utf-8',
            'X-Frame-Options': 'ALLOWALL',
            'Content-Security-Policy': "default-src * data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' data: blob:; style-src * 'unsafe-inline' data: blob:; img-src * data: blob:; connect-src * data: blob:; font-src * data: blob:; frame-src * data: blob:; media-src * data: blob:; object-src * data: blob:; base-uri 'self'; frame-ancestors *;",
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'X-Resource-Type': 'html',
            'X-Proxy-Status': 'rendered',
            'X-Debug-Upstream-CT': contentType,
            'X-Debug-Final-CT': 'text/html; charset=utf-8',
            'X-Debug-Why-HTML': forceHtml ? 'forceHtml' : (detectedHtml ? 'detected' : 'content-type'),
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
      const rawContentParam = ['1', 'true'].includes((urlObj.searchParams.get('rawContent') || '').toLowerCase());
      
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
          .select('full_cookie_data, cookie_excerpt')
          .eq('incident_id', incidentId)
          .limit(1)
          .single();
        
        if (incidentData) {
          // Normalize cookies from full_cookie_data or cookie_excerpt
          let cookies: Array<{name: string, value: string}> = [];
          const src = incidentData.full_cookie_data ?? incidentData.cookie_excerpt;
          
          const toArray = (val: any) => {
            if (!val) return [] as Array<{name:string,value:string}>;
            if (Array.isArray(val)) return val;
            if (typeof val === 'string') {
              // Try parsing as JSON first
              try {
                const parsed = JSON.parse(val);
                if (Array.isArray(parsed)) return parsed;
                if (parsed && typeof parsed === 'object') {
                  return Object.entries(parsed).map(([name, value]) => ({ name, value: String(value) }));
                }
              } catch {}
              
              // Parse as cookie string format: "name=value; name2=value2"
              if (val.includes('=')) {
                return val.split(';').map((pair: string) => {
                  const [name, ...valueParts] = pair.trim().split('=');
                  return { name: name.trim(), value: valueParts.join('=').trim() };
                }).filter((c: any) => c.name);
              }
              
              return [];
            }
            if (typeof val === 'object') {
              return Object.entries(val).map(([name, value]) => ({ name, value: String(value) }));
            }
            return [];
          };
          
          cookies = toArray(src);
          
          if (cookies.length > 0) {
            // Filter cookies by domain/path for GET requests too
            const targetUrl = new URL(decodedUrl);
            const targetHost = targetUrl.hostname;
            const targetPath = targetUrl.pathname;
            
            const matchDomain = (cookieDomain: string, targetHost: string): boolean => {
              if (!cookieDomain) return true;
              const cleanDomain = cookieDomain.startsWith('.') ? cookieDomain.substring(1) : cookieDomain;
              return targetHost === cleanDomain || targetHost.endsWith('.' + cleanDomain);
            };
            
            const matchPath = (cookiePath: string, targetPath: string): boolean => {
              if (!cookiePath || cookiePath === '/') return true;
              return targetPath === cookiePath || targetPath.startsWith(cookiePath + '/');
            };
            
            const rawCount = cookies.length;
            const applicableCookies = cookies.filter((cookie: any) => {
              const domain = cookie.domain || targetHost;
              const path = cookie.path || '/';
              return matchDomain(domain, targetHost) && matchPath(path, targetPath);
            });
            
            const cookieMap = new Map();
            for (const cookie of applicableCookies) {
              const existing = cookieMap.get(cookie.name);
              if (!existing) {
                cookieMap.set(cookie.name, cookie);
              } else {
                const existingDomain = existing.domain || '';
                const newDomain = cookie.domain || '';
                const existingPath = existing.path || '/';
                const newPath = cookie.path || '/';
                
                if (newDomain.length > existingDomain.length || 
                    (newDomain.length === existingDomain.length && newPath.length > existingPath.length)) {
                  cookieMap.set(cookie.name, cookie);
                }
              }
            }
            
            const finalCookies = Array.from(cookieMap.values());
            cookieHeader = finalCookies.map((c: any) => `${c.name}=${c.value}`).join('; ');
            cookieCount = finalCookies.length;
            
            console.log(`GET: Cookie filtering: ${rawCount} raw → ${cookieCount} valid for ${targetHost}${targetPath}`);
            if (cookieCount > 0) {
              const sampleNames = finalCookies.slice(0, 5).map((c: any) => c.name).join(', ');
              console.log(`GET: Sample cookies: ${sampleNames}${cookieCount > 5 ? '...' : ''}`);
            }
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

      // RAW CONTENT MODE: Return raw content with correct content type for browser interpretation
      if (rawContentParam) {
        const correctContentType = getCorrectContentType(targetUrl, contentType, resourceType);
        console.log(`GET rawContent=true → returning ${correctContentType}`);
        
        // For binary resources, return as buffer
        if (resourceType === 'image' || resourceType === 'font') {
          const arrayBuffer = await response.arrayBuffer();
          return new Response(arrayBuffer, {
            headers: {
              ...corsHeaders,
              'Content-Type': correctContentType,
              'X-Raw-Content': 'true'
            }
          });
        }
        
        // For text resources, return as text
        const rawText = await response.text();
        return new Response(rawText, {
          headers: {
            ...corsHeaders,
            'Content-Type': correctContentType,
            'X-Raw-Content': 'true'
          }
        });
      }

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
  const IS_STANDALONE = window.top === window;
  console.log('[ProxyPatch] Initialized for:', BASE_PAGE_URL, 'standalone:', IS_STANDALONE);
  
  let lastNavigateUrl = '';
  let lastNavigateTime = 0;
  
  function deproxify(u){ if(!u||typeof u!=='string')return u; try{ if(u.startsWith(PROXY_BASE)){ const urlObj=new URL(u); const orig=urlObj.searchParams.get('url'); if(orig)return decodeURIComponent(orig); } return u; }catch(e){return u;} }
  function proxify(u,forceHtml=false) { if (!u || typeof u !== 'string' || u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('#')) return u; try { const absolute = new URL(u, BASE_PAGE_URL).href; if (absolute.startsWith(PROXY_BASE)) return absolute; const suffix = forceHtml ? '&forceHtml=1' : ''; return PROXY_BASE + '?url=' + encodeURIComponent(absolute) + '&incident=' + INCIDENT_ID + suffix; } catch (e) { return u; } }
  function normalizeUrl(u) { try { const url = new URL(u); return url.origin + url.pathname + url.search; } catch { return u; } }
  function sendNavigate(u){ if(IS_STANDALONE)return; try { const dep=deproxify(u); const absoluteUrl = new URL(dep, BASE_PAGE_URL).href; const normalized = normalizeUrl(absoluteUrl); if (normalized === normalizeUrl(BASE_PAGE_URL)) { console.log('[ProxyPatch] Navigate (ignored - same as base):', absoluteUrl); return; } const now = Date.now(); if (normalized === lastNavigateUrl && (now - lastNavigateTime) < 800) { console.log('[ProxyPatch] Navigate (debounced):', absoluteUrl); return; } lastNavigateUrl = normalized; lastNavigateTime = now; console.log('[ProxyPatch] Navigate:', absoluteUrl); window.parent.postMessage({ type:'proxy:navigate', url:absoluteUrl, incidentId:INCIDENT_ID }, '*'); } catch(e) { console.warn('[ProxyPatch] Invalid URL for navigate:', u); } }
  async function fetchAndRender(destination){ try { console.log('[ProxyPatch] Fetching and rendering:', destination); const proxUrl=proxify(destination,true); const response=await fetch(proxUrl); const html=await response.text(); document.open(); document.write(html); document.close(); } catch(error) { console.error('[ProxyPatch] fetchAndRender failed:', error); window.location.href=proxify(destination,true); } }
  try { const baseEl = document.createElement('base'); baseEl.href = BASE_PAGE_URL; document.head && document.head.prepend(baseEl); if(!IS_STANDALONE){ console.log('[ProxyPatch] Base tag injected, sending proxy:ready (early)'); window.parent.postMessage({ type: 'proxy:ready', url: BASE_PAGE_URL }, '*'); } } catch(e) { console.error('[ProxyPatch] Failed to inject base:', e); }
  if(!IS_STANDALONE){
    if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',function(){ console.log('[ProxyPatch] proxy:ready (DOMContentLoaded)'); window.parent.postMessage({type:'proxy:ready',url:BASE_PAGE_URL},'*'); }); }
    window.addEventListener('load',function(){ console.log('[ProxyPatch] proxy:ready (load)'); window.parent.postMessage({type:'proxy:ready',url:BASE_PAGE_URL},'*'); });
    setTimeout(function(){ console.log('[ProxyPatch] proxy:ready (retry-0ms)'); window.parent.postMessage({type:'proxy:ready',url:BASE_PAGE_URL},'*'); },0);
    setTimeout(function(){ console.log('[ProxyPatch] proxy:ready (retry-500ms)'); window.parent.postMessage({type:'proxy:ready',url:BASE_PAGE_URL},'*'); },500);
    setTimeout(function(){ console.log('[ProxyPatch] proxy:ready (retry-1500ms)'); window.parent.postMessage({type:'proxy:ready',url:BASE_PAGE_URL},'*'); },1500);
  }
  if(IS_STANDALONE){
    console.log('[ProxyPatch] Standalone mode - intercepting navigation');
    function handleAnchorEvent(e){ let el=e.target; while(el && el.tagName!=='A') el=el.parentElement; if(el && el.tagName==='A'){ const origHref=el.getAttribute('data-orig-href'); const href=origHref||el.getAttribute('href'); if(!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return; e.preventDefault(); e.stopPropagation(); const destination=deproxify(origHref||(el as HTMLAnchorElement).href); fetchAndRender(destination); } }
    ['click','mousedown','pointerup','auxclick','touchend'].forEach((evt)=>{ document.addEventListener(evt, handleAnchorEvent, { capture:true, passive:false }); });
    const _open=window.open; window.open=function(u){ fetchAndRender(deproxify(u as any)); return null; } as any;
    document.addEventListener('submit', function(e){ const form=e.target as HTMLFormElement; const method=(form.method||'GET').toUpperCase(); if(method==='GET'){ e.preventDefault(); e.stopPropagation(); const formData=new FormData(form); const params=new URLSearchParams(formData as any); const origAction=form.getAttribute('data-orig-action'); const action=origAction||form.action||BASE_PAGE_URL; const dep=deproxify(action); const absoluteUrl=new URL(dep,BASE_PAGE_URL).href; const urlWithParams=absoluteUrl+(absoluteUrl.includes('?')?'&':'?')+params.toString(); fetchAndRender(urlWithParams); } else if(method==='POST'){ e.preventDefault(); e.stopPropagation(); console.log('[ProxyPatch] Blocked POST form navigation'); } }, true);
  } else {
    function handleAnchorEvent(e){ let el=e.target; while(el && el.tagName!=='A') el=el.parentElement; if(el && el.tagName==='A'){ const origHref=el.getAttribute('data-orig-href'); const href=origHref||el.getAttribute('href'); if(!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return; e.preventDefault(); e.stopPropagation(); sendNavigate(origHref||(el as HTMLAnchorElement).href); } }
    ['click','mousedown','pointerup','auxclick','touchend'].forEach((evt)=>{ document.addEventListener(evt, handleAnchorEvent, { capture:true, passive:false }); });
    const _open=window.open; window.open=function(u){ sendNavigate(deproxify(u as any)); return null; } as any;
    document.addEventListener('submit', function(e){ const form=e.target as HTMLFormElement; const method=(form.method||'GET').toUpperCase(); if(method==='POST'){ e.preventDefault(); e.stopPropagation(); console.log('[ProxyPatch] Blocked POST form navigation'); } else if(method==='GET'){ e.preventDefault(); e.stopPropagation(); const formData=new FormData(form); const params=new URLSearchParams(formData as any); const origAction=form.getAttribute('data-orig-action'); const action=origAction||form.action||BASE_PAGE_URL; const dep=deproxify(action); const absoluteUrl=new URL(dep,BASE_PAGE_URL).href; const urlWithParams=absoluteUrl+(absoluteUrl.includes('?')?'&':'?')+params.toString(); sendNavigate(urlWithParams); } }, true);
  }
  const sA=Element.prototype.setAttribute; Element.prototype.setAttribute=function(n,v){ const ln=String(n).toLowerCase(); const isA=this.tagName==='A'; const isF=this.tagName==='FORM'; if(ln==='href' && isA){ v=proxify(String(v),true); }else if(ln==='action' && isF){ v=proxify(String(v),true); }else if(['src','action'].includes(ln)||(ln==='href' && !isA)){ v=proxify(String(v)); } return sA.call(this,n,v); };
  const aP=HTMLAnchorElement.prototype; const aHD=Object.getOwnPropertyDescriptor(aP,'href'); if(aHD && aHD.set){ const oAS=aHD.set; Object.defineProperty(aP,'href',{ set(v){ return oAS.call(this, proxify(v as any, true)); }, get:aHD.get }); }
  const fP=HTMLFormElement.prototype; const fAD=Object.getOwnPropertyDescriptor(fP,'action'); if(fAD && fAD.set){ const oFS=fAD.set; Object.defineProperty(fP,'action',{ set(v){ return oFS.call(this, proxify(v as any, true)); }, get:fAD.get }); }
  ['HTMLLinkElement','HTMLScriptElement','HTMLImageElement','HTMLSourceElement'].forEach(function(cn){ const p=(window as any)[cn] && (window as any)[cn].prototype; if(!p) return; ['href','src'].forEach(function(prop){ const d=Object.getOwnPropertyDescriptor(p,prop); if(d && d.set){ const o=d.set; Object.defineProperty(p,prop,{ set(v){ return o!.call(this, proxify(v as any)); }, get:d.get }); } }); });
  const of=window.fetch; window.fetch=function(u,o){ return of(proxify(u as any), o as any); } as any;
  const oo=XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open=function(m,u){ arguments[1]=proxify(u as any); return oo.apply(this, arguments as any); } as any;
  document.querySelectorAll('link[data-href]').forEach(function(l){ if(!l.getAttribute('href') || l.getAttribute('href')===window.location.href) l.setAttribute('href', proxify(l.getAttribute('data-href') as any) as any); });
})();
</script>`;
        // Robust injection: try </head>, </body>, after <html>, or prepend
        let injected = false;
        const headMatch = content.match(/<\/head>/i);
        if (headMatch) {
          content = content.replace(headMatch[0], `${runtimePatchScript}${headMatch[0]}`);
          injected = true;
        } else {
          const bodyMatch = content.match(/<\/body>/i);
          if (bodyMatch) {
            content = content.replace(bodyMatch[0], `${runtimePatchScript}${bodyMatch[0]}`);
            injected = true;
          } else {
            const htmlMatch = content.match(/<html[^>]*>/i);
            if (htmlMatch) {
              const pos = content.indexOf(htmlMatch[0]) + htmlMatch[0].length;
              content = content.slice(0, pos) + runtimePatchScript + content.slice(pos);
              injected = true;
            } else {
              content = runtimePatchScript + content;
              injected = true;
            }
          }
        }
        console.log(`  GET html patch injected: ${injected}`);
        content = rewriteHTMLUrls(content, decodedUrl, proxyBase, incidentId);
        return new Response(content, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/html; charset=utf-8',
            'X-Frame-Options': 'ALLOWALL',
            'Content-Security-Policy': "default-src * data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' data: blob:; style-src * 'unsafe-inline' data: blob:; img-src * data: blob:; connect-src * data: blob:; font-src * data: blob:; frame-src * data: blob:; media-src * data: blob:; object-src * data: blob:; base-uri 'self'; frame-ancestors *;",
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'X-Proxy-Status': 'rendered',
            'X-Debug-Upstream-CT': contentType,
            'X-Debug-Final-CT': 'text/html; charset=utf-8',
            'X-Debug-Why-HTML': forceHtmlParam ? 'forceHtml' : (detectedHtml ? 'detected' : 'content-type'),
            'X-Debug-Patch-Injected': String(injected),
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