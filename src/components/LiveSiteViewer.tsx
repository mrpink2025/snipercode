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
  };
  onClose: () => void;
}

export const LiveSiteViewer = ({ incident, onClose }: LiveSiteViewerProps) => {
  const [loading, setLoading] = useState(false);
  const [proxyUrl, setProxyUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cookies, setCookies] = useState<any[]>([]);

  useEffect(() => {
    // Parse cookie data from incident
    if (incident.cookie_data?.cookies) {
      setCookies(incident.cookie_data.cookies);
    }
  }, [incident]);

  const loadSiteWithCookies = async () => {
    if (!incident.tab_url) {
      setError('URL do site não disponível');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('Loading site with cookies:', incident.tab_url, cookies);

      const { data, error: functionError } = await supabase.functions.invoke('site-proxy', {
        body: {
          url: incident.tab_url,
          incidentId: incident.id,
          cookies: cookies
        }
      });

      if (functionError) {
        throw new Error(functionError.message);
      }

      // Create blob URL for the response
      const blob = new Blob([data], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setProxyUrl(url);

      toast.success('Site carregado com cookies do usuário');

    } catch (err: any) {
      console.error('Error loading site:', err);
      setError(err.message || 'Erro ao carregar site');
      toast.error('Falha ao carregar site com cookies');
    } finally {
      setLoading(false);
    }
  };

  const refreshSite = () => {
    if (proxyUrl) {
      URL.revokeObjectURL(proxyUrl);
      setProxyUrl(null);
    }
    loadSiteWithCookies();
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
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium">Host:</span>
          <span>{incident.host}</span>
          {cookies.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {cookies.length} cookies
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 mt-2">
          <Button
            onClick={loadSiteWithCookies}
            disabled={loading || !incident.tab_url}
            size="sm"
            className="gap-2"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Globe className="h-4 w-4" />
            )}
            {loading ? 'Carregando...' : 'Carregar com Cookies'}
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

        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
              <p className="text-muted-foreground">Carregando site com cookies...</p>
            </div>
          </div>
        )}

        {proxyUrl && !loading && (
          <iframe
            src={proxyUrl}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            title={`Site: ${incident.host}`}
          />
        )}

        {!proxyUrl && !loading && !error && (
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