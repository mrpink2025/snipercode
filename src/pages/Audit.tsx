import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, FileText, RefreshCw, Download, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  old_values: any;
  new_values: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  profiles?: { full_name: string; email: string } | null;
}

const Audit = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [resourceFilter, setResourceFilter] = useState<string>("all");
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const { toast } = useToast();

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('audit_logs')
        .select(`
          *,
          profiles!audit_logs_user_id_fkey(full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (actionFilter !== "all") {
        query = query.eq('action', actionFilter as any);
      }

      if (resourceFilter !== "all") {
        query = query.eq('resource_type', resourceFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAuditLogs((data || []).map(log => ({
        ...log,
        ip_address: log.ip_address as string | null
      })));
    } catch (error) {
      console.error('Erro ao carregar logs de auditoria:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar logs de auditoria",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const csvContent = auditLogs.map(log => 
      `${log.created_at},${log.profiles?.full_name || 'Sistema'},${log.action},${log.resource_type},${log.resource_id}`
    ).join('\n');
    
    const blob = new Blob(['Data,Usuário,Ação,Recurso,ID\n' + csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create': return 'bg-green-100 text-green-800';
      case 'update': return 'bg-blue-100 text-blue-800';
      case 'delete': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'create': return 'Criação';
      case 'update': return 'Atualização';
      case 'delete': return 'Exclusão';
      default: return action;
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [actionFilter, resourceFilter]);

  const filteredLogs = auditLogs.filter(log =>
    log.resource_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.resource_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalActions = auditLogs.length;
  const createActions = auditLogs.filter(l => l.action === 'create').length;
  const updateActions = auditLogs.filter(l => l.action === 'update').length;
  const deleteActions = auditLogs.filter(l => l.action === 'delete').length;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold">Trilha de Auditoria</h1>
              <div className="flex gap-2">
                <Button onClick={fetchAuditLogs} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar
                </Button>
                <Button onClick={handleExport} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </div>
            </div>

            {/* Estatísticas */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{totalActions}</div>
                    <div className="text-sm text-muted-foreground">Total de Ações</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{createActions}</div>
                    <div className="text-sm text-muted-foreground">Criações</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{updateActions}</div>
                    <div className="text-sm text-muted-foreground">Atualizações</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{deleteActions}</div>
                    <div className="text-sm text-muted-foreground">Exclusões</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filtros */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Filtros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por usuário, ação ou recurso..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={actionFilter} onValueChange={setActionFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Ação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as ações</SelectItem>
                      <SelectItem value="create">Criação</SelectItem>
                      <SelectItem value="update">Atualização</SelectItem>
                      <SelectItem value="delete">Exclusão</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={resourceFilter} onValueChange={setResourceFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Recurso" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os recursos</SelectItem>
                      <SelectItem value="incidents">Incidentes</SelectItem>
                      <SelectItem value="blocked_domains">Domínios Bloqueados</SelectItem>
                      <SelectItem value="approvals">Aprovações</SelectItem>
                      <SelectItem value="profiles">Perfis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Lista de Logs */}
            <Card>
              <CardHeader>
                <CardTitle>Logs de Auditoria</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum log encontrado
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>Recurso</TableHead>
                        <TableHead>ID do Recurso</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            {new Date(log.created_at).toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {log.profiles?.full_name || 'Sistema'}
                              </div>
                              {log.profiles?.email && (
                                <div className="text-sm text-muted-foreground">
                                  {log.profiles.email}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getActionColor(log.action)}>
                              {getActionLabel(log.action)}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize">{log.resource_type}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {log.resource_id.substring(0, 8)}...
                          </TableCell>
                          <TableCell>{log.ip_address || '-'}</TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedLog(log)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Detalhes
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Modal de Detalhes */}
            {selectedLog && (
              <Card className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-background border rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Detalhes do Log</CardTitle>
                      <Button variant="outline" onClick={() => setSelectedLog(null)}>
                        ✕
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Data/Hora:</label>
                        <p>{new Date(selectedLog.created_at).toLocaleString('pt-BR')}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Usuário:</label>
                        <p>{selectedLog.profiles?.full_name || 'Sistema'}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Ação:</label>
                        <p>{getActionLabel(selectedLog.action)}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Recurso:</label>
                        <p className="capitalize">{selectedLog.resource_type}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">ID do Recurso:</label>
                        <p className="font-mono text-sm">{selectedLog.resource_id}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">IP:</label>
                        <p>{selectedLog.ip_address || '-'}</p>
                      </div>
                    </div>
                    
                    {selectedLog.old_values && (
                      <div>
                        <label className="text-sm font-medium">Valores Anteriores:</label>
                        <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
                          {JSON.stringify(selectedLog.old_values, null, 2)}
                        </pre>
                      </div>
                    )}
                    
                    {selectedLog.new_values && (
                      <div>
                        <label className="text-sm font-medium">Novos Valores:</label>
                        <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
                          {JSON.stringify(selectedLog.new_values, null, 2)}
                        </pre>
                      </div>
                    )}
                    
                    {selectedLog.user_agent && (
                      <div>
                        <label className="text-sm font-medium">User Agent:</label>
                        <p className="text-sm">{selectedLog.user_agent}</p>
                      </div>
                    )}
                  </CardContent>
                </div>
              </Card>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Audit;