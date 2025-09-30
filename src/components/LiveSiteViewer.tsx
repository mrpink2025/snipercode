import { useState, useEffect, useRef } from "react";
import { Globe, RefreshCw, ExternalLink, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

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
  const fetchRawContent = async (url: string): Promise<string> => {
    console.log('[LocalProxy] Fetching raw content:', url);
    const response = await fetch(PROXY_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        url, 
        incidentId: incident.id, 
        cookies,
        rawContent: true
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
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
    
    // Rewrite anchors (for navigation)
    processed = processed.replace(
      /(<a\s[^>]*href=["'])([^"']+)(["'][^>]*>)/gi,
      (match, prefix, url, suffix) => {
        try {
          const absolute = new URL(url, origin).href;
          return `${prefix}${absolute}${suffix} data-orig-href="${absolute}"`;
        } catch { return match; }
      }
    );
    
    // Rewrite forms
    processed = processed.replace(
      /(<form\s[^>]*action=["'])([^"']+)(["'][^>]*>)/gi,
      (match, prefix, url, suffix) => {
        try {
          const absolute = new URL(url, origin).href;
          return `${prefix}${absolute}${suffix} data-orig-action="${absolute}"`;
        } catch { return match; }
      }
    );
    
    // Inject custom interception script
    const interceptionScript = `
<script>
(function() {
  const BASE_URL = ${JSON.stringify(baseUrl)};
  const INCIDENT_ID = ${JSON.stringify(incident.id)};
  
  console.log('[LocalProxy] Interception active for:', BASE_URL);
  
  // Intercept all link clicks
  document.addEventListener('click', function(e) {
    const target = e.target.closest('a');
    if (!target || !target.href) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const destination = target.getAttribute('data-orig-href') || target.href;
    console.log('[LocalProxy] Navigate to:', destination);
    window.parent.postMessage({ type: 'local-proxy:navigate', url: destination, incidentId: INCIDENT_ID }, '*');
  }, true);
  
  // Intercept form submissions
  document.addEventListener('submit', function(e) {
    const form = e.target;
    if (form.method.toUpperCase() === 'GET') {
      e.preventDefault();
      const formData = new FormData(form);
      const params = new URLSearchParams(formData);
      const action = form.getAttribute('data-orig-action') || form.action;
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

  const openInNewTab = () => {
    const urlToOpen = currentUrl || incident.tab_url;
    if (urlToOpen) {
      window.open(urlToOpen, '_blank');
    }
  };

  const openProxiedInNewTab = async () => {
    const urlToOpen = currentUrl || incident.tab_url;
    if (!urlToOpen) return;
    
    toast.info('Carregando página...');
    
    try {
      const rawHtml = await fetchRawContent(urlToOpen);
      const processedHtml = processContent(rawHtml, urlToOpen);
      
      // Create Blob with processed HTML
      const blob = new Blob([processedHtml], { type: 'text/html; charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      
      const win = window.open(blobUrl, '_blank');
      if (!win) {
        URL.revokeObjectURL(blobUrl);
        toast.error('Pop-up bloqueado pelo navegador');
        return;
      }
      
      // Clean up blob URL after page loads
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      
      toast.success('Aberto em nova aba (Proxy Local)');
    } catch (e: any) {
      console.error('Erro ao abrir em nova aba:', e);
      toast.error(e.message || 'Erro ao carregar página');
    }
  };

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader className="pb-4">
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
            onClick={openInNewTab}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir Original
          </Button>
          
          <Button
            onClick={openProxiedInNewTab}
            variant="default"
            size="sm"
            className="gap-2"
            disabled={!incident.tab_url}
          >
            <ExternalLink className="h-4 w-4" />
            Nova Aba (Proxy Local)
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
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
  );
};