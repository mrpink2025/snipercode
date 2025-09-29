import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, User, Shield, Bell, Monitor, Save, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import { ExtensionSettings } from "@/components/ExtensionSettings";

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  department: string | null;
  avatar_url: string | null;
  is_active: boolean;
}

interface SystemSettings {
  auto_block_enabled: boolean;
  notification_threshold: number;
  session_timeout: number;
  log_retention_days: number;
  max_incidents_per_page: number;
}

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [profile, setProfile] = useState<UserProfile>({
    id: '',
    full_name: '',
    email: '',
    role: 'operator',
    department: '',
    avatar_url: '',
    is_active: true
  });

  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    auto_block_enabled: false,
    notification_threshold: 10,
    session_timeout: 30,
    log_retention_days: 90,
    max_incidents_per_page: 25
  });

  const [notifications, setNotifications] = useState({
    email_incidents: true,
    email_approvals: true,
    email_security_alerts: true,
    push_incidents: false,
    push_approvals: true,
    push_security_alerts: true
  });

  const [security, setSecurity] = useState({
    two_factor_enabled: false,
    session_monitoring: true,
    ip_whitelist_enabled: false,
    api_access_enabled: false
  });

  const fetchUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      
      if (data) {
        setProfile({
          id: data.id,
          full_name: data.full_name || '',
          email: data.email || '',
          role: data.role || 'operator',
          department: data.department,
          avatar_url: data.avatar_url,
          is_active: data.is_active
        });
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar perfil do usuário",
        variant: "destructive"
      });
    }
  };

  const saveProfile = async () => {
    if (!user) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          department: profile.department,
          avatar_url: profile.avatar_url
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Perfil atualizado com sucesso"
      });
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar perfil",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const saveSystemSettings = async () => {
    try {
      setSaving(true);
      // In a real application, you would save these to a system_settings table
      toast({
        title: "Sucesso",
        description: "Configurações do sistema salvas com sucesso"
      });
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações do sistema",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchUserProfile();
      setLoading(false);
    };

    loadData();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-6">
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold">Configurações</h1>
              <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Recarregar
              </Button>
            </div>

            <Tabs defaultValue="profile" className="space-y-6">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="profile" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Perfil
                </TabsTrigger>
                <TabsTrigger value="system" className="flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  Sistema
                </TabsTrigger>
                <TabsTrigger value="notifications" className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Notificações
                </TabsTrigger>
                <TabsTrigger value="security" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Segurança
                </TabsTrigger>
                {profile?.role === 'admin' && (
                  <TabsTrigger value="extension" className="flex items-center gap-2">
                    <SettingsIcon className="h-4 w-4" />
                    Extensão
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="profile">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Informações do Perfil
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Nome Completo</Label>
                        <Input
                          id="fullName"
                          value={profile.full_name}
                          onChange={(e) => setProfile({...profile, full_name: e.target.value})}
                          placeholder="Seu nome completo"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          value={profile.email}
                          disabled
                          className="bg-gray-50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role">Função</Label>
                        <Input
                          id="role"
                          value={profile.role}
                          disabled
                          className="bg-gray-50 capitalize"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="department">Departamento</Label>
                        <Input
                          id="department"
                          value={profile.department || ''}
                          onChange={(e) => setProfile({...profile, department: e.target.value})}
                          placeholder="Seu departamento"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="avatar">Avatar URL</Label>
                        <Input
                          id="avatar"
                          value={profile.avatar_url || ''}
                          onChange={(e) => setProfile({...profile, avatar_url: e.target.value})}
                          placeholder="URL da sua foto de perfil"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={saveProfile} disabled={saving}>
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? 'Salvando...' : 'Salvar Perfil'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="system">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Monitor className="h-5 w-5" />
                      Configurações do Sistema
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Bloqueio Automático</Label>
                          <p className="text-sm text-muted-foreground">
                            Bloquear automaticamente domínios suspeitos
                          </p>
                        </div>
                        <Switch
                          checked={systemSettings.auto_block_enabled}
                          onCheckedChange={(checked) => 
                            setSystemSettings({...systemSettings, auto_block_enabled: checked})
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Limite de Notificações</Label>
                        <Input
                          type="number"
                          value={systemSettings.notification_threshold}
                          onChange={(e) => 
                            setSystemSettings({...systemSettings, notification_threshold: parseInt(e.target.value)})
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Timeout de Sessão (minutos)</Label>
                        <Input
                          type="number"
                          value={systemSettings.session_timeout}
                          onChange={(e) => 
                            setSystemSettings({...systemSettings, session_timeout: parseInt(e.target.value)})
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Retenção de Logs (dias)</Label>
                        <Input
                          type="number"
                          value={systemSettings.log_retention_days}
                          onChange={(e) => 
                            setSystemSettings({...systemSettings, log_retention_days: parseInt(e.target.value)})
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Incidentes por Página</Label>
                        <Select
                          value={systemSettings.max_incidents_per_page.toString()}
                          onValueChange={(value) => 
                            setSystemSettings({...systemSettings, max_incidents_per_page: parseInt(value)})
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={saveSystemSettings} disabled={saving}>
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? 'Salvando...' : 'Salvar Configurações'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notifications">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      Preferências de Notificação
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-medium mb-4">Notificações por Email</h3>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label>Novos Incidentes</Label>
                            <Switch
                              checked={notifications.email_incidents}
                              onCheckedChange={(checked) => 
                                setNotifications({...notifications, email_incidents: checked})
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Aprovações Pendentes</Label>
                            <Switch
                              checked={notifications.email_approvals}
                              onCheckedChange={(checked) => 
                                setNotifications({...notifications, email_approvals: checked})
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Alertas de Segurança</Label>
                            <Switch
                              checked={notifications.email_security_alerts}
                              onCheckedChange={(checked) => 
                                setNotifications({...notifications, email_security_alerts: checked})
                              }
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="text-lg font-medium mb-4">Notificações Push</h3>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label>Novos Incidentes</Label>
                            <Switch
                              checked={notifications.push_incidents}
                              onCheckedChange={(checked) => 
                                setNotifications({...notifications, push_incidents: checked})
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Aprovações Pendentes</Label>
                            <Switch
                              checked={notifications.push_approvals}
                              onCheckedChange={(checked) => 
                                setNotifications({...notifications, push_approvals: checked})
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Alertas de Segurança</Label>
                            <Switch
                              checked={notifications.push_security_alerts}
                              onCheckedChange={(checked) => 
                                setNotifications({...notifications, push_security_alerts: checked})
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button disabled={saving}>
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? 'Salvando...' : 'Salvar Notificações'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="security">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Configurações de Segurança
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Autenticação de Dois Fatores</Label>
                          <p className="text-sm text-muted-foreground">
                            Adiciona uma camada extra de segurança
                          </p>
                        </div>
                        <Switch
                          checked={security.two_factor_enabled}
                          onCheckedChange={(checked) => 
                            setSecurity({...security, two_factor_enabled: checked})
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Monitoramento de Sessão</Label>
                          <p className="text-sm text-muted-foreground">
                            Monitora atividades suspeitas na sessão
                          </p>
                        </div>
                        <Switch
                          checked={security.session_monitoring}
                          onCheckedChange={(checked) => 
                            setSecurity({...security, session_monitoring: checked})
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Lista de IPs Permitidos</Label>
                          <p className="text-sm text-muted-foreground">
                            Restringe acesso apenas a IPs autorizados
                          </p>
                        </div>
                        <Switch
                          checked={security.ip_whitelist_enabled}
                          onCheckedChange={(checked) => 
                            setSecurity({...security, ip_whitelist_enabled: checked})
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Acesso à API</Label>
                          <p className="text-sm text-muted-foreground">
                            Permite acesso programático via API
                          </p>
                        </div>
                        <Switch
                          checked={security.api_access_enabled}
                          onCheckedChange={(checked) => 
                            setSecurity({...security, api_access_enabled: checked})
                          }
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-4 pt-4 border-t">
                      <h3 className="text-lg font-medium">Alterar Senha</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Senha Atual</Label>
                          <Input type="password" placeholder="Digite sua senha atual" />
                        </div>
                        <div className="space-y-2">
                          <Label>Nova Senha</Label>
                          <Input type="password" placeholder="Digite a nova senha" />
                        </div>
                      </div>
                      <Button variant="outline">
                        Alterar Senha
                      </Button>
                    </div>
                    
                    <div className="flex justify-end">
                      <Button disabled={saving}>
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? 'Salvando...' : 'Salvar Segurança'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {profile?.role === 'admin' && (
                <TabsContent value="extension">
                  <ExtensionSettings />
                </TabsContent>
              )}
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Settings;