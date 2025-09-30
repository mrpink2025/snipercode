import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, History as HistoryIcon, RefreshCw, Download, Eye, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";

interface HistoryItem {
  id: string;
  type: 'domain_block';
  description: string;
  status: string;
  user_name: string;
  user_email: string;
  created_at: string;
  updated_at: string;
  details: any;
}

const History = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const { toast } = useToast();

  const fetchHistory = async () => {
    try {
      setLoading(true);

      // Fetch blocked domains
      const { data: blockedDomains, error: domainsError } = await supabase
        .from('blocked_domains')
        .select(`
          *,
          profiles!blocked_domains_blocked_by_fkey(full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (domainsError) throw domainsError;

      // Format data
      const formattedHistory: HistoryItem[] = [
        ...(blockedDomains || []).map(item => ({
          id: item.id,
          type: 'domain_block' as const,
          description: `Bloqueio de domínio: ${item.domain}`,
          status: item.is_active ? 'active' : 'inactive',
          user_name: item.profiles?.full_name || 'Usuário',
          user_email: item.profiles?.email || '',
          created_at: item.created_at,
          updated_at: item.updated_at,
          details: {
            domain: item.domain,
            reason: item.reason,
            expires_at: item.expires_at
          }
        }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setHistoryItems(formattedHistory);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar histórico",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const csvContent = historyItems.map(item => 
      `${item.created_at},${item.type},${item.description},${item.status},${item.user_name}`
    ).join('\n');
    
    const blob = new Blob(['Data,Tipo,Descrição,Status,Usuário\n' + csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historico-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'domain_block': return 'Bloqueio Domínio';
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'domain_block': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'approved': return 'Aprovado';
      case 'rejected': return 'Rejeitado';
      case 'active': return 'Ativo';
      case 'inactive': return 'Inativo';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': case 'active': return 'bg-green-100 text-green-800';
      case 'rejected': case 'inactive': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const filteredItems = historyItems.filter(item => {
    const matchesSearch = item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.user_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const totalItems = historyItems.length;
  const domainBlocks = historyItems.filter(i => i.type === 'domain_block').length;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold">Histórico de Atividades</h1>
              <div className="flex gap-2">
                <Button onClick={fetchHistory} variant="outline" size="sm">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <Clock className="h-8 w-8 text-blue-600" />
                    <div>
                      <div className="text-2xl font-bold">{totalItems}</div>
                      <div className="text-sm text-muted-foreground">Total de Ações</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{domainBlocks}</div>
                    <div className="text-sm text-muted-foreground">Bloqueios de Domínio</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filtros */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HistoryIcon className="h-5 w-5" />
                  Filtros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por descrição ou usuário..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      <SelectItem value="domain_block">Bloqueio Domínio</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="approved">Aprovado</SelectItem>
                      <SelectItem value="rejected">Rejeitado</SelectItem>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Lista de Histórico */}
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Atividades</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma atividade encontrada
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            {new Date(item.created_at).toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell>
                            <Badge className={getTypeColor(item.type)}>
                              {getTypeLabel(item.type)}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-md truncate">
                            {item.description}
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(item.status)}>
                              {getStatusLabel(item.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{item.user_name}</div>
                              {item.user_email && (
                                <div className="text-sm text-muted-foreground">
                                  {item.user_email}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedItem(item)}
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
            {selectedItem && (
              <Card className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-background border rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Detalhes da Atividade</CardTitle>
                      <Button variant="outline" onClick={() => setSelectedItem(null)}>
                        ✕
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Tipo:</label>
                        <p>{getTypeLabel(selectedItem.type)}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Status:</label>
                        <p>{getStatusLabel(selectedItem.status)}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Usuário:</label>
                        <p>{selectedItem.user_name}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Data de Criação:</label>
                        <p>{new Date(selectedItem.created_at).toLocaleString('pt-BR')}</p>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Descrição:</label>
                      <p>{selectedItem.description}</p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Detalhes:</label>
                      <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
                        {JSON.stringify(selectedItem.details, null, 2)}
                      </pre>
                    </div>
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

export default History;