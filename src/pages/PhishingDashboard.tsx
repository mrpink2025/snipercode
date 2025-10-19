import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Shield, AlertTriangle, CheckCircle, TrendingUp, Ban, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PhishingStats {
  total_analyzed: number;
  phishing_detected: number;
  false_positives: number;
  avg_risk_score: number;
  top_threat_type: string;
}

interface PhishingAnalysis {
  id: string;
  domain: string;
  risk_score: number;
  threat_type: string | null;
  details: any;
  detected_at: string;
  is_false_positive: boolean;
}

export default function PhishingDashboard() {
  const [stats, setStats] = useState<PhishingStats | null>(null);
  const [recentThreats, setRecentThreats] = useState<PhishingAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
    
    // Subscribe to real-time phishing detections
    const channel = supabase
      .channel('phishing_realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'phishing_analysis',
        },
        (payload) => {
          const newAnalysis = payload.new as PhishingAnalysis;
          
          if (newAnalysis.risk_score >= 70) {
            toast({
              title: "🚨 Phishing Detectado",
              description: `Domínio suspeito: ${newAnalysis.domain} (Risco: ${newAnalysis.risk_score})`,
              variant: "destructive",
            });
          }
          
          setRecentThreats(prev => [newAnalysis, ...prev].slice(0, 10));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load statistics
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_phishing_stats');
      
      if (statsError) throw statsError;
      if (statsData && statsData.length > 0) {
        setStats(statsData[0]);
      }
      
      // Load recent threats
      const { data: threatsData, error: threatsError } = await supabase
        .from('phishing_analysis')
        .select('*')
        .order('detected_at', { ascending: false })
        .limit(10);
      
      if (threatsError) throw threatsError;
      setRecentThreats(threatsData || []);
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os dados do dashboard",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const blockDomain = async (domain: string) => {
    try {
      const { error } = await supabase.functions.invoke('block-domain', {
        body: { domain, reason: 'Phishing detectado automaticamente' }
      });
      
      if (error) throw error;
      
      toast({
        title: "Domínio bloqueado",
        description: `${domain} foi bloqueado com sucesso`,
      });
    } catch (error) {
      toast({
        title: "Erro ao bloquear domínio",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  const getThreatTypeColor = (threatType: string | null) => {
    switch (threatType) {
      case 'homograph': return 'destructive';
      case 'typosquatting': return 'destructive';
      case 'threat_intel': return 'destructive';
      case 'suspicious_tld': return 'secondary';
      case 'ssl_invalid': return 'secondary';
      default: return 'outline';
    }
  };

  const getThreatTypeLabel = (threatType: string | null) => {
    switch (threatType) {
      case 'homograph': return 'Homógrafo';
      case 'typosquatting': return 'Typosquatting';
      case 'threat_intel': return 'Intel de Ameaças';
      case 'suspicious_tld': return 'TLD Suspeito';
      case 'ssl_invalid': return 'SSL Inválido';
      default: return 'Outro';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Anti-Phishing</h1>
          <p className="text-muted-foreground">Monitoramento e detecção de ameaças em tempo real</p>
        </div>
        <Button onClick={() => navigate('/settings')}>
          Configurações
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Analisado</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_analyzed || 0}</div>
            <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Phishing Detectado</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats?.phishing_detected || 0}</div>
            <p className="text-xs text-muted-foreground">Risco ≥ 70</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Detecção</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.total_analyzed ? 
                Math.round((stats.phishing_detected / stats.total_analyzed) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Precisão do sistema</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Score Médio</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(stats?.avg_risk_score || 0)}</div>
            <p className="text-xs text-muted-foreground">Risco médio</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Threats Table */}
      <Card>
        <CardHeader>
          <CardTitle>Ameaças Recentes</CardTitle>
          <CardDescription>Últimas detecções de phishing e domínios suspeitos</CardDescription>
        </CardHeader>
        <CardContent>
          {recentThreats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma ameaça detectada recentemente</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentThreats.map((threat) => (
                <div
                  key={threat.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold">{threat.domain}</h3>
                      <Badge variant={getThreatTypeColor(threat.threat_type)}>
                        {getThreatTypeLabel(threat.threat_type)}
                      </Badge>
                      {threat.is_false_positive && (
                        <Badge variant="outline">Falso Positivo</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Risco: {threat.risk_score}/100
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(threat.detected_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {threat.risk_score >= 70 && !threat.is_false_positive && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => blockDomain(threat.domain)}
                      >
                        <Ban className="h-4 w-4 mr-1" />
                        Bloquear
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}