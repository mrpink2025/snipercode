import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Shield, 
  AlertTriangle, 
  Ban, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Minus
} from 'lucide-react';
import type { KPIData } from '@/lib/supabase-helpers';

interface KPICardsProps {
  data: KPIData | null;
  loading: boolean;
}

export const KPICards = ({ data, loading }: KPICardsProps) => {
  if (loading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Calculate trends (mock calculation for demo)
  const todayIncidents = data.recentActivity[data.recentActivity.length - 1]?.incidents || 0;
  const yesterdayIncidents = data.recentActivity[data.recentActivity.length - 2]?.incidents || 0;
  const incidentTrend = todayIncidents - yesterdayIncidents;

  const getTrendIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="h-4 w-4 text-red-500" />;
    if (value < 0) return <TrendingDown className="h-4 w-4 text-green-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getTrendText = (value: number) => {
    if (value === 0) return 'Sem mudança hoje';
    const direction = value > 0 ? 'aumento' : 'diminuição';
    return `${direction} de ${Math.abs(value)} hoje`;
  };

  const criticalPercentage = data.totalIncidents > 0 
    ? Math.round((data.severityBreakdown.critical / data.totalIncidents) * 100) 
    : 0;

  const activePercentage = data.totalIncidents > 0 
    ? Math.round((data.activeIncidents / data.totalIncidents) * 100) 
    : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Incidents */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de Incidentes</CardTitle>
          <Shield className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.totalIncidents.toLocaleString()}</div>
          <div className="flex items-center text-xs text-muted-foreground mt-1">
            {getTrendIcon(incidentTrend)}
            <span className="ml-1">{getTrendText(incidentTrend)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Active Incidents */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Incidentes Ativos</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">
            {data.activeIncidents.toLocaleString()}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
            <span>{activePercentage}% do total</span>
            {data.activeIncidents > 0 && (
              <Badge variant="destructive" className="text-xs">
                Requer atenção
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Blocked Domains */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Domínios Bloqueados</CardTitle>
          <Ban className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {data.blockedDomains.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Proteção ativa
          </p>
        </CardContent>
      </Card>

      {/* Pending Approvals */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pendentes de Aprovação</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">
            {data.pendingApprovals.toLocaleString()}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
            <span>Aguardando revisão</span>
            {data.pendingApprovals > 0 && (
              <Badge variant="secondary" className="text-xs">
                Ação necessária
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Severity Breakdown - Full width card */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Distribuição por Severidade</CardTitle>
          <CardDescription>Classificação dos incidentes por nível de risco</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">
                {data.severityBreakdown.low}
              </div>
              <div className="text-xs text-muted-foreground">Baixa</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-yellow-600">
                {data.severityBreakdown.medium}
              </div>
              <div className="text-xs text-muted-foreground">Média</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-orange-600">
                {data.severityBreakdown.high}
              </div>
              <div className="text-xs text-muted-foreground">Alta</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-red-600">
                {data.severityBreakdown.critical}
              </div>
              <div className="text-xs text-muted-foreground">Crítica</div>
              {data.severityBreakdown.critical > 0 && (
                <Badge variant="destructive" className="text-xs mt-1">
                  {criticalPercentage}%
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Breakdown - Full width card */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Status dos Incidentes</CardTitle>
          <CardDescription>Distribuição dos incidentes por status atual</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-3">
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">
                {data.statusBreakdown.new}
              </div>
              <div className="text-xs text-muted-foreground">Novos</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-yellow-600">
                {data.statusBreakdown.inProgress}
              </div>
              <div className="text-xs text-muted-foreground">Em Progresso</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-red-600">
                {data.statusBreakdown.blocked}
              </div>
              <div className="text-xs text-muted-foreground">Bloqueados</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">
                {data.statusBreakdown.approved}
              </div>
              <div className="text-xs text-muted-foreground">Aprovados</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-600">
                {data.statusBreakdown.resolved}
              </div>
              <div className="text-xs text-muted-foreground">Resolvidos</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default KPICards;