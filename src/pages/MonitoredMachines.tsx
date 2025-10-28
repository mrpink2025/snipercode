import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Monitor, Eye, Users, Activity, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { useNavigate } from "react-router-dom";

interface MonitoredMachine {
  machine_id: string;
  is_online: boolean;
  active_tabs_count: number;
  last_ping: string | null;
  unique_domains: string[];
}

const MonitoredMachines = () => {
  const { isAdmin, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [machines, setMachines] = useState<MonitoredMachine[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');

  useEffect(() => {
    if (!isAdmin && !isSuperAdmin) return;
    fetchMachines();

    // Atualizar a cada 10 segundos
    const interval = setInterval(fetchMachines, 10000);
    return () => clearInterval(interval);
  }, [isAdmin, isSuperAdmin]);

  const fetchMachines = async () => {
    try {
      // Buscar todas as conexões WebSocket
      const { data: wsConnections, error: wsError } = await supabase
        .from('websocket_connections')
        .select('machine_id, is_active, last_ping_at')
        .not('machine_id', 'is', null)
        .neq('machine_id', 'unknown')
        .neq('machine_id', '');

      if (wsError) throw wsError;

      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

      // Para cada máquina, buscar contagem de abas e domínios
      const machinesData = await Promise.all(
        (wsConnections || []).map(async (ws) => {
          const { data: sessions, error: sessionsError } = await supabase
            .from('active_sessions')
            .select('domain')
            .eq('machine_id', ws.machine_id)
            .eq('is_active', true)
            .gte('last_activity', twoMinutesAgo);

          console.log(`[MonitoredMachines] Machine ${ws.machine_id}: ${sessions?.length || 0} active sessions`);

          if (sessionsError) {
            console.error('Error fetching sessions:', sessionsError);
            return {
              machine_id: ws.machine_id,
              is_online: ws.is_active ?? false,
              active_tabs_count: 0,
              last_ping: ws.last_ping_at,
              unique_domains: []
            };
          }

          const uniqueDomains = [...new Set(sessions?.map(s => s.domain) || [])];

          return {
            machine_id: ws.machine_id,
            is_online: ws.is_active ?? false,
            active_tabs_count: sessions?.length || 0,
            last_ping: ws.last_ping_at,
            unique_domains: uniqueDomains
          };
        })
      );

      setMachines(machinesData);
    } catch (error) {
      console.error('Error fetching machines:', error);
      toast.error('Erro ao carregar computadores');
    } finally {
      setLoading(false);
    }
  };

  const filteredMachines = machines.filter(machine => {
    if (filter === 'online') return machine.is_online;
    if (filter === 'offline') return !machine.is_online;
    return true;
  });

  const onlineMachines = machines.filter(m => m.is_online).length;
  const totalTabs = machines.reduce((sum, m) => sum + m.active_tabs_count, 0);

  if (!isAdmin && !isSuperAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <Header />
            <main className="flex-1 p-6">
              <div className="text-center py-12">
                <h2 className="text-2xl font-semibold mb-2">Acesso Restrito</h2>
                <p className="text-muted-foreground">
                  Esta página é restrita a administradores do sistema.
                </p>
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Computadores Monitorados</h1>
                <p className="text-muted-foreground">
                  Visualização em tempo real de todos os computadores conectados
                </p>
              </div>

              {/* KPIs */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total de Máquinas</CardTitle>
                    <Monitor className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{machines.length}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Máquinas Online</CardTitle>
                    <Activity className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{onlineMachines}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total de Abas Abertas</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalTabs}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Filtros */}
              <div className="flex gap-2">
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilter('all')}
                >
                  Todos ({machines.length})
                </Button>
                <Button
                  variant={filter === 'online' ? 'default' : 'outline'}
                  onClick={() => setFilter('online')}
                >
                  Online ({onlineMachines})
                </Button>
                <Button
                  variant={filter === 'offline' ? 'default' : 'outline'}
                  onClick={() => setFilter('offline')}
                >
                  Offline ({machines.length - onlineMachines})
                </Button>
              </div>

              {/* Tabela */}
              <Card>
                <CardHeader>
                  <CardTitle>Computadores</CardTitle>
                  <CardDescription>
                    Lista de todos os computadores e seu status de conexão
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="text-center py-8">Carregando...</div>
                  ) : filteredMachines.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum computador encontrado
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead>Machine ID</TableHead>
                          <TableHead>Abas Abertas</TableHead>
                          <TableHead>Domínios Únicos</TableHead>
                          <TableHead>Último Ping</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMachines.map((machine) => (
                          <TableRow key={machine.machine_id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Circle
                                  className={`h-3 w-3 ${
                                    machine.is_online
                                      ? 'fill-green-500 text-green-500'
                                      : 'fill-gray-400 text-gray-400'
                                  }`}
                                />
                                <Badge variant={machine.is_online ? 'default' : 'secondary'}>
                                  {machine.is_online ? 'Online' : 'Offline'}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              {machine.machine_id}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{machine.active_tabs_count}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {machine.unique_domains.slice(0, 3).map((domain) => (
                                  <Badge key={domain} variant="secondary" className="text-xs">
                                    {domain}
                                  </Badge>
                                ))}
                                {machine.unique_domains.length > 3 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{machine.unique_domains.length - 3}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {machine.last_ping
                                ? new Date(machine.last_ping).toLocaleString('pt-BR')
                                : 'N/A'}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => navigate('/remote-control')}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                Ver Detalhes
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default MonitoredMachines;
