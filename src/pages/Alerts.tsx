import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle, RefreshCw, Bell } from 'lucide-react';
import { useAlerts } from '@/hooks/useAlerts';
import { AlertCard } from '@/components/AlertCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';

const Alerts = () => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'acknowledged'>('all');
  const [domainFilter, setDomainFilter] = useState<string>('all');

  const alertsOptions = statusFilter === 'all' 
    ? {} 
    : { acknowledged: statusFilter === 'acknowledged' };

  const { 
    alerts, 
    loading, 
    unacknowledgedCount, 
    refetch, 
    acknowledgeAlert,
    acknowledgeAllAlerts 
  } = useAlerts(alertsOptions);

  const domains = Array.from(new Set(alerts.map(a => a.domain)));
  const filteredAlerts = domainFilter === 'all' 
    ? alerts 
    : alerts.filter(a => a.domain === domainFilter);

  if (loading && alerts.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="w-8 h-8" />
            Alertas de Domínios Monitorados
          </h1>
          <p className="text-muted-foreground">
            Monitore acessos a domínios específicos em tempo real
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unacknowledgedCount > 0 && statusFilter !== 'acknowledged' && (
            <Button
              onClick={acknowledgeAllAlerts}
              variant="outline"
              size="sm"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Reconhecer Todos ({unacknowledgedCount})
            </Button>
          )}
          <Button onClick={refetch} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total de Alertas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alerts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Não Reconhecidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {unacknowledgedCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Alertas Críticos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {alerts.filter(a => a.metadata?.is_critical).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Alertas Recentes</CardTitle>
              <CardDescription>
                {filteredAlerts.length} alertas encontrados
              </CardDescription>
            </div>
            {unacknowledgedCount > 0 && (
              <Badge variant="destructive">
                {unacknowledgedCount} novos
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)} className="mb-6">
            <TabsList>
              <TabsTrigger value="all">
                Todos ({alerts.length})
              </TabsTrigger>
              <TabsTrigger value="new">
                Novos ({unacknowledgedCount})
                {unacknowledgedCount > 0 && (
                  <span className="ml-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                )}
              </TabsTrigger>
              <TabsTrigger value="acknowledged">
                Reconhecidos
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {domains.length > 1 && (
            <div className="mb-6">
              <Select value={domainFilter} onValueChange={setDomainFilter}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Filtrar por domínio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os domínios</SelectItem>
                  {domains.map(domain => (
                    <SelectItem key={domain} value={domain}>
                      {domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Carregando alertas...
                </div>
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="text-center py-12">
                <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum alerta encontrado</h3>
                <p className="text-muted-foreground">
                  {statusFilter !== 'all'
                    ? 'Não há alertas nesta categoria.'
                    : 'O sistema não detectou acessos a domínios monitorados.'}
                </p>
              </div>
            ) : (
              filteredAlerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onAcknowledge={acknowledgeAlert}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Alerts;
