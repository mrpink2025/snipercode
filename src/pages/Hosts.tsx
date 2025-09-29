import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Shield, ShieldOff, RefreshCw, Plus, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import BlockDomainModal from "@/components/modals/BlockDomainModal";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";

interface BlockedDomain {
  id: string;
  domain: string;
  reason: string;
  blocked_by: string;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
  profiles?: { full_name: string };
}

const Hosts = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [blockedDomains, setBlockedDomains] = useState<BlockedDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const { toast } = useToast();

  const fetchBlockedDomains = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('blocked_domains')
        .select(`
          *,
          profiles!blocked_domains_blocked_by_fkey(full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBlockedDomains(data || []);
    } catch (error) {
      console.error('Erro ao carregar domínios bloqueados:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar domínios bloqueados",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleDomainBlock = async (domainId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('blocked_domains')
        .update({ is_active: !currentStatus })
        .eq('id', domainId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Domínio ${!currentStatus ? 'ativado' : 'desativado'} com sucesso`
      });
      
      fetchBlockedDomains();
    } catch (error) {
      console.error('Erro ao alterar status do domínio:', error);
      toast({
        title: "Erro",
        description: "Erro ao alterar status do domínio",
        variant: "destructive"
      });
    }
  };

  const handleExport = () => {
    const csvContent = blockedDomains.map(domain => 
      `${domain.domain},${domain.reason},${domain.is_active ? 'Ativo' : 'Inativo'},${domain.created_at}`
    ).join('\n');
    
    const blob = new Blob(['Domínio,Motivo,Status,Data\n' + csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hosts-bloqueados-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchBlockedDomains();
  }, []);

  const filteredDomains = blockedDomains.filter(domain =>
    domain.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
    domain.reason.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeBlocks = blockedDomains.filter(d => d.is_active).length;
  const totalBlocks = blockedDomains.length;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold">Hosts Monitorados</h1>
              <div className="flex gap-2">
                <Button onClick={fetchBlockedDomains} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar
                </Button>
                <Button onClick={handleExport} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
                <Button onClick={() => setShowBlockModal(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Bloquear Domínio
                </Button>
              </div>
            </div>

            {/* Estatísticas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <Shield className="h-8 w-8 text-green-600" />
                    <div>
                      <div className="text-2xl font-bold">{activeBlocks}</div>
                      <div className="text-sm text-muted-foreground">Bloqueios Ativos</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <ShieldOff className="h-8 w-8 text-gray-600" />
                    <div>
                      <div className="text-2xl font-bold">{totalBlocks - activeBlocks}</div>
                      <div className="text-sm text-muted-foreground">Bloqueios Inativos</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold">
                      {totalBlocks}
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{totalBlocks}</div>
                      <div className="text-sm text-muted-foreground">Total de Domínios</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filtros */}
            <Card>
              <CardContent className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por domínio ou motivo..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Lista de Domínios */}
            <Card>
              <CardHeader>
                <CardTitle>Domínios Bloqueados</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : filteredDomains.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum domínio encontrado
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Domínio</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Bloqueado por</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDomains.map((domain) => (
                        <TableRow key={domain.id}>
                          <TableCell className="font-medium">{domain.domain}</TableCell>
                          <TableCell>{domain.reason}</TableCell>
                          <TableCell>
                            <Badge variant={domain.is_active ? "destructive" : "secondary"}>
                              {domain.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell>{domain.profiles?.full_name || "Usuário"}</TableCell>
                          <TableCell>{new Date(domain.created_at).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleDomainBlock(domain.id, domain.is_active)}
                            >
                              {domain.is_active ? (
                                <>
                                  <ShieldOff className="h-4 w-4 mr-2" />
                                  Desativar
                                </>
                              ) : (
                                <>
                                  <Shield className="h-4 w-4 mr-2" />
                                  Ativar
                                </>
                              )}
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

      {showBlockModal && (
        <BlockDomainModal
          isOpen={showBlockModal}
          onClose={() => setShowBlockModal(false)}
          domain=""
          incidentId=""
        />
      )}
    </div>
  );
};

export default Hosts;