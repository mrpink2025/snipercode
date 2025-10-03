import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Globe, Package, Settings, Shield, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SystemSettings {
  id: string;
  extension_update_url: string | null;
  extension_version: string | null;
  auto_update_enabled: boolean;
  update_channel: 'stable' | 'beta' | 'dev';
  force_update_version: string | null;
  rollback_version: string | null;
  updated_by: string | null;
  updated_at: string;
}

export const ExtensionSettings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingUrl, setIsTestingUrl] = useState(false);
  const [urlTestResult, setUrlTestResult] = useState<'success' | 'error' | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('extension-config', {
        method: 'GET'
      });

      if (error) throw error;

      if (data.success) {
        setSettings(data.data);
      }
    } catch (error) {
      console.error('Error loading extension settings:', error);
      toast({
        title: 'Erro ao carregar configurações',
        description: 'Não foi possível carregar as configurações da extensão.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;

    try {
      setIsSaving(true);
      const { data, error } = await supabase.functions.invoke('extension-config', {
        method: 'POST',
        body: {
          extension_update_url: settings.extension_update_url,
          extension_version: settings.extension_version,
          auto_update_enabled: settings.auto_update_enabled,
          update_channel: settings.update_channel,
          force_update_version: settings.force_update_version,
          rollback_version: settings.rollback_version
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Configurações salvas',
          description: 'As configurações da extensão foram atualizadas com sucesso.'
        });
        loadSettings(); // Reload to get updated data
      }
    } catch (error) {
      console.error('Error saving extension settings:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const testUpdateUrl = async () => {
    if (!settings?.extension_update_url) return;

    try {
      setIsTestingUrl(true);
      setUrlTestResult(null);
      
      const response = await fetch(settings.extension_update_url, {
        method: 'HEAD',
        mode: 'no-cors'
      });
      
      setUrlTestResult('success');
      toast({
        title: 'URL testada com sucesso',
        description: 'O servidor de update está respondendo corretamente.'
      });
    } catch (error) {
      setUrlTestResult('error');
      toast({
        title: 'Erro ao testar URL',
        description: 'Não foi possível conectar ao servidor de update.',
        variant: 'destructive'
      });
    } finally {
      setIsTestingUrl(false);
    }
  };

  const incrementVersion = () => {
    if (!settings?.extension_version) return;
    
    const versionParts = settings.extension_version.split('.');
    const patch = parseInt(versionParts[2] || '0') + 1;
    const newVersion = `${versionParts[0] || '1'}.${versionParts[1] || '0'}.${patch}`;
    
    setSettings({ ...settings, extension_version: newVersion });
  };

  const generateManifestXml = () => {
    if (!settings) return '';
    
    return `<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='corpmonitor-extension'>
    <updatecheck codebase='${settings.extension_update_url}/corpmonitor-${settings.extension_version}.crx' 
                 version='${settings.extension_version}' 
                 hash_sha256='[generated-hash]' />
  </app>
</gupdate>`;
  };

  const forceUpdateNow = async () => {
    if (!settings) return;
    const desiredForce = settings.force_update_version || settings.extension_version;
    if (!desiredForce) {
      toast({
        title: 'Versão alvo necessária',
        description: 'Informe a versão a ser forçada ou defina a versão atual.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsSaving(true);
      const { data, error } = await supabase.functions.invoke('extension-config', {
        method: 'POST',
        body: {
          extension_update_url: settings.extension_update_url,
          extension_version: settings.extension_version,
          auto_update_enabled: true,
          update_channel: settings.update_channel,
          force_update_version: desiredForce,
          rollback_version: settings.rollback_version
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Atualização forçada acionada',
          description: `Clientes serão direcionados para a versão ${desiredForce}.`
        });
        loadSettings();
      }
    } catch (error) {
      console.error('Erro ao forçar atualização:', error);
      toast({
        title: 'Erro ao forçar atualização',
        description: 'Não foi possível acionar a atualização agora.',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground animate-pulse" />
            <p className="text-sm text-muted-foreground">Carregando configurações...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Configurações da Extensão
          </CardTitle>
          <CardDescription>
            Gerencie as configurações de atualização automática da extensão CorpMonitor
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* URL do Servidor de Update */}
          <div className="space-y-2">
            <Label htmlFor="update-url" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              URL do Servidor de Update
            </Label>
            <div className="flex gap-2">
              <Input
                id="update-url"
                value={settings?.extension_update_url || ''}
                onChange={(e) => setSettings(prev => prev ? { ...prev, extension_update_url: e.target.value } : null)}
                placeholder="https://seu-dominio.com/update-server"
                className="flex-1"
              />
              <Button 
                variant="outline" 
                onClick={testUpdateUrl}
                disabled={isTestingUrl || !settings?.extension_update_url}
                size="sm"
              >
                {isTestingUrl ? 'Testando...' : 'Testar'}
              </Button>
              {urlTestResult && (
                <div className="flex items-center">
                  {urlTestResult === 'success' ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              URL do servidor que fornecerá as atualizações da extensão
            </p>
          </div>

          <Separator />

          {/* Controle de Versão */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Controle de Versão
            </Label>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="current-version">Versão Atual</Label>
                <div className="flex gap-2">
                  <Input
                    id="current-version"
                    value={settings?.extension_version || ''}
                    onChange={(e) => setSettings(prev => prev ? { ...prev, extension_version: e.target.value } : null)}
                    placeholder="1.0.0"
                  />
                  <Button variant="outline" onClick={incrementVersion} size="sm">
                    Incrementar
                  </Button>
                </div>
              </div>
              
              <div>
                <Label htmlFor="update-channel">Canal de Update</Label>
                <Select 
                  value={settings?.update_channel || 'stable'} 
                  onValueChange={(value: 'stable' | 'beta' | 'dev') => 
                    setSettings(prev => prev ? { ...prev, update_channel: value } : null)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o canal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stable">
                      <div className="flex items-center gap-2">
                        <Badge variant="default">Stable</Badge>
                        <span>Produção</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="beta">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Beta</Badge>
                        <span>Teste</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="dev">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Dev</Badge>
                        <span>Desenvolvimento</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-Update Ativado</Label>
                <div className="text-sm text-muted-foreground">
                  Permitir atualizações automáticas da extensão
                </div>
              </div>
              <Switch 
                checked={settings?.auto_update_enabled || false}
                onCheckedChange={(checked) => setSettings(prev => prev ? { ...prev, auto_update_enabled: checked } : null)}
              />
            </div>
          </div>

          <Separator />

          {/* Ações Avançadas */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Ações Avançadas
            </Label>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="force-version">Forçar Update para Versão</Label>
                <Input
                  id="force-version"
                  value={settings?.force_update_version || ''}
                  onChange={(e) => setSettings(prev => prev ? { ...prev, force_update_version: e.target.value } : null)}
                  placeholder="1.0.1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Forçar todos os usuários a atualizarem para esta versão
                </p>
              </div>
              
              <div>
                <Label htmlFor="rollback-version">Versão de Rollback</Label>
                <Input
                  id="rollback-version"
                  value={settings?.rollback_version || ''}
                  onChange={(e) => setSettings(prev => prev ? { ...prev, rollback_version: e.target.value } : null)}
                  placeholder="0.9.8"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Versão para rollback em caso de problemas
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={saveSettings} disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
            <Button 
              variant="secondary" 
              onClick={forceUpdateNow}
              disabled={isSaving || !((settings?.force_update_version || settings?.extension_version))}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Forçar atualização agora
            </Button>
            <Button variant="outline" onClick={() => {
              const xml = generateManifestXml();
              navigator.clipboard.writeText(xml);
              toast({
                title: 'XML copiado',
                description: 'O manifest XML foi copiado para a área de transferência.'
              });
            }}>
              Copiar XML Manifest
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>Status do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-medium">Última alteração</p>
              <p className="text-muted-foreground">
                {settings?.updated_at ? new Date(settings.updated_at).toLocaleString('pt-BR') : 'Nunca'}
              </p>
            </div>
            <div>
              <p className="font-medium">Canal ativo</p>
              <Badge variant={settings?.update_channel === 'stable' ? 'default' : 'secondary'}>
                {settings?.update_channel || 'stable'}
              </Badge>
            </div>
            <div>
              <p className="font-medium">Auto-update</p>
              <Badge variant={settings?.auto_update_enabled ? 'default' : 'secondary'}>
                {settings?.auto_update_enabled ? 'Ativado' : 'Desativado'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};