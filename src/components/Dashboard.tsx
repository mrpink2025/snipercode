import { useState, useEffect } from 'react';
import { KPICards } from '@/components/KPICards';
import IncidentCard from '@/components/IncidentCard';
import { NotificationCenter } from '@/components/NotificationCenter';
import { DemoDataButton } from '@/components/DemoDataButton';
import { LiveSiteViewer } from '@/components/LiveSiteViewer';
import { AdminCreationForm } from '@/components/AdminCreationForm';
import { DemoUserCreation } from '@/components/DemoUserCreation';
import { useAuth } from '@/hooks/useAuth';
import { useAlerts } from '@/hooks/useAlerts';
import { AlertCard } from '@/components/AlertCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Filter, RefreshCw, Plus, AlertTriangle, Shield, Clock, CheckCircle } from 'lucide-react';
import { useIncidents } from '@/hooks/useIncidents';
import { useRealtime } from '@/hooks/useRealtime';
import { getKPIData } from '@/lib/supabase-helpers';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const Dashboard = () => {
  const { isSuperAdmin, isDemoAdmin } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [kpiData, setKpiData] = useState<any>(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [showSiteViewer, setShowSiteViewer] = useState(false);
  
  // Use alerts hook
  const { alerts, acknowledgeAlert } = useAlerts({ limit: 10 });

  // Use the real incidents hook
  const { 
    incidents, 
    loading: incidentsLoading, 
    error,
    totalCount,
    refetch,
    updateIncident
  } = useIncidents({
    status: statusFilter === 'all' ? undefined : statusFilter as any,
    severity: severityFilter === 'all' ? undefined : severityFilter as any,
    searchTerm: searchTerm || undefined,
    limit: 20
  });

  // Set up realtime updates
  useRealtime({
    onEvent: (event) => {
      console.log('Dashboard received realtime event:', event);
      if (event.table === 'incidents') {
        refetch(); // Refresh incidents when changes occur
        loadKPIData(); // Refresh KPI data
      }
    }
  });

  const loadKPIData = async () => {
    try {
      setKpiLoading(true);
      const data = await getKPIData();
      setKpiData(data);
    } catch (err) {
      console.error('Error loading KPI data:', err);
    } finally {
      setKpiLoading(false);
    }
  };

  useEffect(() => {
    loadKPIData();
  }, []);

  const handleRefresh = async () => {
    await Promise.all([refetch(), loadKPIData()]);
  };

  const handleBlock = async (incidentId: string) => {
    try {
      const incident = incidents.find(i => i.incident_id === incidentId);
      if (!incident) return;

      await updateIncident(incident.id, { status: 'blocked' as any });
      toast.success(`Incidente ${incidentId} bloqueado com sucesso!`);
    } catch (error) {
      toast.error('Erro ao bloquear incidente');
    }
  };


  const handleIsolate = async (incidentId: string) => {
    try {
      const incident = incidents.find(i => i.incident_id === incidentId);
      if (!incident) return;

      await updateIncident(incident.id, { status: 'blocked' as any });
      toast.success(`Host isolado para incidente ${incidentId}`);
    } catch (error) {
      toast.error('Erro ao isolar host');
    }
  };

  const handleViewDetails = (incidentId: string) => {
    toast.info(`Detalhes do incidente ${incidentId}`);
    // In a real app, you'd navigate to a details page
  };

  const handleViewSite = (incidentCard: any) => {
    // Find the full incident data from the incidents array
    const fullIncident = incidents.find(i => i.incident_id === incidentCard.id);
    if (!fullIncident) return;
    
    console.log('Viewing site for incident:', fullIncident);
    setSelectedIncident({
      id: fullIncident.id,
      incident_id: fullIncident.incident_id,
      host: fullIncident.host,
      machine_id: fullIncident.machine_id,
      tab_url: fullIncident.tab_url,
      cookie_data: fullIncident.cookie_data,
      full_cookie_data: fullIncident.full_cookie_data
    });
    setShowSiteViewer(true);
  };

  if (incidentsLoading && incidents.length === 0) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Erro ao Carregar Dashboard</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleRefresh} className="w-full">
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral do sistema de monitoramento corporativo
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleRefresh} variant="outline" size="sm" disabled={incidentsLoading || kpiLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${(incidentsLoading || kpiLoading) ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <KPICards data={kpiData} loading={kpiLoading} />

      {/* SuperAdmin: Admin Creation Form */}
      {isSuperAdmin && (
        <>
          <AdminCreationForm />
          <DemoUserCreation />
        </>
      )}

      {/* Demo Data Button - Only shows when system is empty */}
      {!kpiLoading && kpiData && kpiData.totalIncidents === 0 && (
        <DemoDataButton />
      )}

      {/* System Status Info */}
      {!kpiLoading && kpiData && kpiData.totalIncidents > 0 && (
        <Card className="mb-6 border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">
                    Sistema CorpMonitor Ativo
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Monitorando {kpiData.totalIncidents} incidentes • {kpiData.activeIncidents} ativos • 
                    {kpiData.blockedDomains} domínios bloqueados
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-green-700 border-green-300">
                Operacional
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Search */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Incidentes e Alertas Recentes</CardTitle>
              <CardDescription>
                {totalCount} itens encontrados
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-success border-success/20 bg-success/10">
              <div className="w-2 h-2 bg-success rounded-full mr-2 animate-pulse" />
              Tempo real ativo
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="incidents" className="mb-6">
            <TabsList>
              <TabsTrigger value="incidents">
                Incidentes ({totalCount})
              </TabsTrigger>
              <TabsTrigger value="alerts">
                Alertas Recentes
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="incidents" className="space-y-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por host, ID do incidente ou máquina..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filtrar por status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="new">Novo</SelectItem>
                      <SelectItem value="in-progress">Em Andamento</SelectItem>
                      <SelectItem value="blocked">Bloqueado</SelectItem>
                      <SelectItem value="approved">Aprovado</SelectItem>
                      <SelectItem value="resolved">Resolvido</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={severityFilter} onValueChange={setSeverityFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filtrar por severidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as severidades</SelectItem>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="critical">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Incidents List */}
              <div className="space-y-4">
                {incidentsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Carregando incidentes...
                    </div>
                  </div>
                ) : incidents.length === 0 ? (
                  <div className="text-center py-8">
                    <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhum incidente encontrado</h3>
                    <p className="text-muted-foreground mb-4">
                      {searchTerm || statusFilter !== 'all' || severityFilter !== 'all'
                        ? 'Tente ajustar os filtros de busca.'
                        : 'O sistema está funcionando normalmente.'}
                    </p>
                    {(searchTerm || statusFilter !== 'all' || severityFilter !== 'all') && (
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setSearchTerm('');
                          setStatusFilter('all');
                          setSeverityFilter('all');
                        }}
                      >
                        Limpar Filtros
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    {incidents
                      .filter(incident => ['new', 'in-progress', 'blocked', 'approved'].includes(incident.status))
                      .map((incident) => (
                      <IncidentCard
                        key={incident.id}
                        incident={{
                          id: incident.incident_id,
                          host: incident.host,
                          machineId: incident.machine_id,
                          user: incident.user?.full_name || 'Usuário Desconhecido',
                          timestamp: formatDistanceToNow(new Date(incident.created_at), {
                            addSuffix: true,
                            locale: ptBR
                          }),
                          tabUrl: incident.tab_url,
                          tab_url: incident.tab_url,
                          severity: incident.severity === 'critical' ? 'RED' : 'NORMAL',
                          cookieExcerpt: incident.cookie_excerpt,
                          cookie_data: incident.cookie_data,
                          status: incident.status as 'new' | 'in-progress' | 'blocked' | 'approved',
                          isRedList: incident.is_red_list
                        }}
                        onBlock={handleBlock}
                        onIsolate={handleIsolate}
                        onViewDetails={handleViewDetails}
                        onViewSite={isDemoAdmin ? undefined : handleViewSite}
                      />
                    ))}
                    
                    {totalCount > incidents.length && (
                      <div className="text-center py-4">
                        <Button variant="outline">
                          Carregar Mais ({totalCount - incidents.length} restantes)
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="alerts" className="space-y-4">
              {alerts.length === 0 ? (
                <div className="text-center py-12">
                  <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum alerta recente</h3>
                  <p className="text-muted-foreground">
                    Não há alertas de domínios monitorados nas últimas horas.
                  </p>
                </div>
              ) : (
                <>
                  {alerts.slice(0, 10).map((alert) => (
                    <AlertCard
                      key={alert.id}
                      alert={alert}
                      onAcknowledge={acknowledgeAlert}
                    />
                  ))}
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => window.location.href = '/alerts'}
                  >
                    Ver Todos os Alertas
                  </Button>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Notification Center */}
      <NotificationCenter />

      {/* Site Viewer Modal */}
      {showSiteViewer && selectedIncident && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-6xl h-[90vh] bg-background border rounded-lg shadow-lg">
            <LiveSiteViewer
              incident={selectedIncident}
              onClose={() => {
                setShowSiteViewer(false);
                setSelectedIncident(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;