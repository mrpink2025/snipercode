import { useState } from "react";
import { Search, Filter, RefreshCw, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import KPICards from "./KPICards";
import IncidentCard from "./IncidentCard";
import { toast } from "@/hooks/use-toast";

// Mock data para demonstração
const mockIncidents = [
  {
    id: "INC-169001",
    host: "facebook.com",
    machineId: "WKS-001-SP",
    user: "maria.santos",
    timestamp: new Date().toISOString(),
    tabUrl: "https://facebook.com/login",
    severity: "RED" as const,
    cookieExcerpt: "_fbp=fb.1.1234567890.1234567890",
    status: "new" as const,
    isRedList: true,
  },
  {
    id: "INC-169002", 
    host: "instagram.com",
    machineId: "WKS-002-RJ",
    user: "joao.silva",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    tabUrl: "https://instagram.com/explore",
    severity: "RED" as const,
    cookieExcerpt: "sessionid=ABC123DEF456",
    status: "in-progress" as const,
    isRedList: true,
  },
  {
    id: "INC-169003",
    host: "x.com",
    machineId: "WKS-003-SP",
    user: "ana.costa",
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    tabUrl: "https://x.com/home",
    severity: "RED" as const,
    cookieExcerpt: "auth_token=xyz789abc123",
    status: "blocked" as const,
    isRedList: true,
  },
  {
    id: "INC-169004",
    host: "linkedin.com",
    machineId: "WKS-004-SP",
    user: "carlos.lima",
    timestamp: new Date(Date.now() - 10800000).toISOString(),
    severity: "NORMAL" as const,
    cookieExcerpt: "li_at=professional_session_123",
    status: "approved" as const,
    isRedList: false,
  },
  {
    id: "INC-169005",
    host: "github.com",
    machineId: "WKS-005-RJ",
    user: "dev.team",
    timestamp: new Date(Date.now() - 14400000).toISOString(),
    tabUrl: "https://github.com/corporate/repo",
    severity: "NORMAL" as const,
    cookieExcerpt: "_gh_sess=work_session_456",
    status: "new" as const,
    isRedList: false,
  },
  {
    id: "INC-169006",
    host: "dropbox.com",
    machineId: "WKS-006-SP",
    user: "admin.user",
    timestamp: new Date(Date.now() - 18000000).toISOString(),
    severity: "NORMAL" as const,
    cookieExcerpt: "t=business_token_789",
    status: "approved" as const,
    isRedList: false,
  },
];

const Dashboard = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredIncidents = mockIncidents.filter(incident => {
    const matchesSearch = incident.host.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         incident.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         incident.user.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSeverity = severityFilter === "all" || incident.severity === severityFilter;
    const matchesStatus = statusFilter === "all" || incident.status === statusFilter;
    
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const handleBlock = (incidentId: string) => {
    toast({
      title: "Bloqueio iniciado",
      description: `Processando bloqueio para incidente ${incidentId}`,
    });
  };

  const handleRequestRaw = (incidentId: string) => {
    toast({
      title: "Solicitação de cookie raw",
      description: `Solicitação enviada para aprovação - ${incidentId}`,
    });
  };

  const handleIsolate = (incidentId: string) => {
    toast({
      title: "Isolamento de host",
      description: `Iniciando isolamento para incidente ${incidentId}`,
    });
  };

  const handleViewDetails = (incidentId: string) => {
    toast({
      title: "Detalhes do incidente",
      description: `Abrindo detalhes para ${incidentId}`,
    });
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <KPICards />

      {/* Incidents Feed */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Feed de Incidentes em Tempo Real</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Monitoramento ativo de cookies e atividades suspeitas
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className="bg-success/10 text-success border-success/20">
                <div className="w-2 h-2 bg-success rounded-full mr-2 animate-pulse" />
                Tempo Real
              </Badge>
              <Button variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar
              </Button>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center space-x-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por host, ID ou usuário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Severidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="RED">RED</SelectItem>
                <SelectItem value="NORMAL">NORMAL</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="new">Novo</SelectItem>
                <SelectItem value="in-progress">Em Progresso</SelectItem>
                <SelectItem value="blocked">Bloqueado</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Mais filtros
            </Button>
          </div>

          {/* Incidents List */}
          <div className="space-y-4">
            {filteredIncidents.length > 0 ? (
              filteredIncidents.map((incident) => (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  onBlock={handleBlock}
                  onRequestRaw={handleRequestRaw}
                  onIsolate={handleIsolate}
                  onViewDetails={handleViewDetails}
                />
              ))
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  Nenhum incidente encontrado com os filtros aplicados.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;