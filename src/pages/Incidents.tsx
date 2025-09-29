import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, RefreshCw, Download } from "lucide-react";
import IncidentCard from "@/components/IncidentCard";
import { useIncidents } from "@/hooks/useIncidents";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";

const Incidents = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const { incidents, loading, error, refetch } = useIncidents({
    severity: severityFilter === "all" ? undefined : severityFilter as any,
    status: statusFilter === "all" ? undefined : statusFilter as any,
    limit: 50
  });

  const handleRefresh = () => {
    refetch();
  };

  const handleExport = () => {
    const csvContent = incidents.map(incident => 
      `${incident.incident_id},${incident.host},${incident.severity},${incident.status},${incident.created_at}`
    ).join('\n');
    
    const blob = new Blob(['ID,Host,Severity,Status,Created\n' + csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `incidents-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold">Gerenciamento de Incidentes</h1>
              <div className="flex gap-2">
                <Button onClick={handleRefresh} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar
                </Button>
                <Button onClick={handleExport} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </div>
            </div>

            {/* Filtros */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filtros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por host, ID ou conteúdo..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={severityFilter} onValueChange={setSeverityFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Severidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as severidades</SelectItem>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="critical">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="new">Novo</SelectItem>
                      <SelectItem value="in-progress">Em andamento</SelectItem>
                      <SelectItem value="blocked">Bloqueado</SelectItem>
                      <SelectItem value="resolved">Resolvido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Estatísticas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{incidents.length}</div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {incidents.filter(i => i.status === 'new').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Novos</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {incidents.filter(i => i.status === 'in-progress').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Em andamento</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {incidents.filter(i => i.status === 'resolved').length}
                    </div>
                    <div className="text-sm text-muted-foreground">Resolvidos</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Lista de Incidentes */}
            <Card>
              <CardHeader>
                <CardTitle>Lista de Incidentes</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : error ? (
                  <div className="text-center py-8 text-red-600">
                    Erro ao carregar incidentes: {error}
                  </div>
                ) : incidents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum incidente encontrado
                  </div>
                ) : (
                  <div className="space-y-4">
                    {incidents.map((incident) => (
                      <IncidentCard 
                        key={incident.id} 
                        incident={{
                          id: incident.incident_id,
                          host: incident.host,
                          machineId: incident.machine_id,
                          user: 'Usuário',
                          timestamp: incident.created_at,
                          severity: incident.is_red_list ? 'RED' : 'NORMAL',
                          cookieExcerpt: incident.cookie_excerpt,
                          status: incident.status as any,
                          tabUrl: incident.tab_url
                        }}
                        onBlock={() => {}}
                        onRequestRaw={() => {}}
                        onIsolate={() => {}}
                        onViewDetails={() => {}}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Incidents;