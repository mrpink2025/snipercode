import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Download, Chrome, AlertCircle, ExternalLink, Zap, Shield, Settings, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function InstallExtension() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [environment, setEnvironment] = useState<'corporate' | 'personal' | 'detecting'>('detecting');
  const [installationMethod, setInstallationMethod] = useState<'auto' | 'manual' | 'powershell'>('auto');
  const [autoInstallProgress, setAutoInstallProgress] = useState('');
  const [showPowerShellScript, setShowPowerShellScript] = useState(false);

  // Environment detection
  useEffect(() => {
    const detectEnvironment = async () => {
      try {
        // Check if running in corporate environment
        const isCorporate = await checkCorporateEnvironment();
        setEnvironment(isCorporate ? 'corporate' : 'personal');
      } catch (error) {
        console.log('Environment detection failed, defaulting to personal');
        setEnvironment('personal');
      }
    };

    detectEnvironment();
  }, []);

  // Extension detection
  useEffect(() => {
    const checkExtensionInstalled = () => {
      try {
        // Listen for extension messages
        const handleMessage = (event: MessageEvent) => {
          if (event.data.type === 'CORPMONITOR_EXTENSION_DETECTED') {
            setIsInstalled(true);
            localStorage.setItem('corpmonitor-extension-installed', 'true');
            localStorage.setItem('corpmonitor-extension-version', event.data.version || '1.0.0');
          }
        };

        window.addEventListener('message', handleMessage);
        
        // Check existing localStorage state
        const installed = localStorage.getItem('corpmonitor-extension-installed') === 'true';
        if (installed) {
          setIsInstalled(true);
        }

        // Periodically check for extension
        const checkInterval = setInterval(() => {
          window.postMessage({ type: 'CHECK_CORPMONITOR_EXTENSION' }, '*');
        }, 2000);

        return () => {
          window.removeEventListener('message', handleMessage);
          clearInterval(checkInterval);
        };
      } catch (error) {
        console.log('Extension detection method not available');
      }
    };

    checkExtensionInstalled();
  }, []);

  // Environment detection functions
  const checkCorporateEnvironment = async (): Promise<boolean> => {
    try {
      // Check for corporate indicators
      const checks = [
        // Check for domain policies
        () => navigator.userAgent.includes('corporate') || navigator.userAgent.includes('managed'),
        // Check for enterprise Chrome policies
        () => 'chrome' in window && 'enterprise' in (window as any).chrome,
        // Check for common corporate domains in referrer
        () => document.referrer.includes('.corp') || document.referrer.includes('.local'),
        // Check if running on intranet
        () => location.hostname.includes('.local') || location.hostname.includes('.corp')
      ];
      
      return checks.some(check => {
        try {
          return check();
        } catch {
          return false;
        }
      });
    } catch {
      return false;
    }
  };

  // Intelligent automatic installation
  const handleAutomaticInstall = async () => {
    setAutoInstallProgress('Iniciando instalação inteligente...');
    
    if (environment === 'corporate') {
      // Corporate environment - use PowerShell script
      setInstallationMethod('powershell');
      setShowPowerShellScript(true);
      toast.info('Ambiente corporativo detectado! Use o script PowerShell para instalação automática.');
      return;
    }

    // Personal environment - try Chrome Web Store automation
    try {
      setAutoInstallProgress('Detectando login do Google...');
      
      // Check if user is logged into Google
      const isLoggedIn = await checkGoogleLogin();
      
      if (!isLoggedIn) {
        toast.error('Faça login no Google primeiro para instalação automática');
        setInstallationMethod('manual');
        return;
      }

      setAutoInstallProgress('Abrindo Chrome Web Store...');
      
      // Open Chrome Web Store in new window with focus
      const webStoreUrl = `https://chrome.google.com/webstore/detail/corpmonitor/placeholder-id?utm_source=auto-install`;
      const webStoreWindow = window.open(webStoreUrl, '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
      
      if (webStoreWindow) {
        setAutoInstallProgress('Tentando instalação automática...');
        
        // Try to send auto-click message to the new window
        setTimeout(() => {
          try {
            webStoreWindow.postMessage({
              type: 'CORPMONITOR_AUTO_INSTALL',
              action: 'click-install-button'
            }, '*');
          } catch (error) {
            console.log('Could not send auto-install message');
          }
        }, 2000);
        
        // Monitor for installation completion
        const checkInstallation = setInterval(() => {
          if (isInstalled) {
            clearInterval(checkInstallation);
            webStoreWindow.close();
            setAutoInstallProgress('Instalação concluída com sucesso!');
            toast.success('Extensão instalada automaticamente!');
          }
        }, 1000);
        
        // Fallback after 30 seconds
        setTimeout(() => {
          clearInterval(checkInstallation);
          if (!isInstalled) {
            setAutoInstallProgress('Instalação automática não disponível. Use o método manual.');
            toast.info('Clique em "Usar no Chrome" na página que abriu');
          }
        }, 30000);
      } else {
        throw new Error('Popup bloqueado');
      }
    } catch (error) {
      console.error('Auto-install failed:', error);
      setAutoInstallProgress('Falha na instalação automática. Usando método manual...');
      setInstallationMethod('manual');
      handleDownloadExtension();
    }
  };

  const checkGoogleLogin = async (): Promise<boolean> => {
    try {
      // Check for Google session cookies (basic check)
      return document.cookie.includes('accounts.google.com') || 
             document.cookie.includes('SAPISID') ||
             document.cookie.includes('SSID');
    } catch {
      return false;
    }
  };

  const handleDownloadExtension = async () => {
    setDownloadStarted(true);
    setCurrentStep(2);
    
    try {
      const response = await fetch('/chrome-extension/corpmonitor-extension.crx');
      
      if (response.ok) {
        const link = document.createElement('a');
        link.href = '/chrome-extension/corpmonitor-extension.crx';
        link.download = 'corpmonitor-extension.crx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.success('Download iniciado! Siga as instruções abaixo.');
      } else {
        const link = document.createElement('a');
        link.href = '/chrome-extension/corpmonitor-extension.zip';
        link.download = 'corpmonitor-extension.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.info('Baixando arquivo ZIP. Extraia e carregue como extensão sem compactação.');
      }
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Erro no download. Tente o método de instalação manual.');
    }
  };

  const handleManualInstall = () => {
    window.open('chrome://extensions/', '_blank');
    setCurrentStep(3);
  };

  const generatePowerShellScript = () => {
    const extensionId = 'corpmonitor-extension-id'; // Replace with actual ID
    return `# CorpMonitor Extension - Instalação Automática Corporativa
# Execute este script como Administrador

Write-Host "=== Instalação Automática CorpMonitor Extension ===" -ForegroundColor Green
Write-Host "Configurando políticas do Chrome..." -ForegroundColor Yellow

# Criar chaves de registro necessárias
$ChromePolicyPath = "HKLM:\\SOFTWARE\\Policies\\Google\\Chrome"
$ExtensionPath = "$ChromePolicyPath\\ExtensionInstallForcelist"

# Verificar e criar chaves
if (!(Test-Path $ChromePolicyPath)) {
    New-Item -Path $ChromePolicyPath -Force
    Write-Host "Criada chave de políticas do Chrome" -ForegroundColor Green
}

if (!(Test-Path $ExtensionPath)) {
    New-Item -Path $ExtensionPath -Force
    Write-Host "Criada chave de lista de extensões" -ForegroundColor Green
}

# Adicionar extensão à lista de instalação forçada
$extensionEntry = "${extensionId};https://clients2.google.com/service/update2/crx"
Set-ItemProperty -Path $ExtensionPath -Name "1" -Value $extensionEntry

Write-Host "Extensão configurada para instalação automática" -ForegroundColor Green
Write-Host "A extensão será instalada automaticamente na próxima inicialização do Chrome" -ForegroundColor Cyan

# Verificar instalação existente
$installedExtensions = Get-ItemProperty -Path "HKLM:\\SOFTWARE\\Google\\Chrome\\Extensions\\*" -ErrorAction SilentlyContinue
if ($installedExtensions) {
    Write-Host "Extensões Chrome detectadas no sistema" -ForegroundColor Green
} else {
    Write-Host "Primeira instalação de extensão Chrome" -ForegroundColor Yellow
}

Write-Host "=== Instalação Concluída ===" -ForegroundColor Green
Write-Host "Reinicie o Chrome para ativar a extensão" -ForegroundColor Cyan
`;
  };

  const copyPowerShellScript = () => {
    navigator.clipboard.writeText(generatePowerShellScript());
    toast.success('Script PowerShell copiado para a área de transferência!');
  };

  const steps = [
    {
      number: 1,
      title: 'Download da Extensão',
      description: 'Baixe o arquivo da extensão CorpMonitor',
      completed: downloadStarted
    },
    {
      number: 2,
      title: 'Abrir Configurações do Chrome',
      description: 'Acesse chrome://extensions/ no seu navegador',
      completed: currentStep >= 3
    },
    {
      number: 3,
      title: 'Ativar Modo Desenvolvedor',
      description: 'Ative o "Modo do desenvolvedor" no canto superior direito',
      completed: false
    },
    {
      number: 4,
      title: 'Instalar Extensão',
      description: 'Arraste o arquivo .crx baixado para a página de extensões',
      completed: isInstalled
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">
            Instalação Inteligente CorpMonitor
          </h1>
          <p className="text-muted-foreground text-lg">
            Sistema de instalação automática que detecta seu ambiente e escolhe o melhor método
          </p>
          
          {environment === 'detecting' ? (
            <Badge variant="outline" className="mt-2">
              <Settings className="w-3 h-3 mr-1 animate-spin" />
              Detectando ambiente...
            </Badge>
          ) : (
            <Badge variant={environment === 'corporate' ? 'default' : 'secondary'} className="mt-2">
              {environment === 'corporate' ? (
                <><Shield className="w-3 h-3 mr-1" /> Ambiente Corporativo</>
              ) : (
                <><Chrome className="w-3 h-3 mr-1" /> Ambiente Pessoal</>
              )}
            </Badge>
          )}
        </div>

        {isInstalled ? (
          <Alert className="mb-8 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              ✅ Extensão CorpMonitor instalada com sucesso! Você pode encontrá-la na barra de ferramentas do Chrome.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="mb-8">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              A instalação automática via web não é possível devido às políticas de segurança do Chrome. 
              Siga os passos abaixo para instalar manualmente.
            </AlertDescription>
          </Alert>
        )}

        {/* Intelligent Installation Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Instalação Automática Inteligente
            </CardTitle>
            <CardDescription>
              O sistema detectou seu ambiente e selecionou o melhor método de instalação
            </CardDescription>
          </CardHeader>
          <CardContent>
            {environment === 'detecting' ? (
              <div className="flex items-center justify-center p-8">
                <Settings className="w-6 h-6 mr-2 animate-spin" />
                <span>Detectando ambiente de instalação...</span>
              </div>
            ) : (
              <Tabs defaultValue={environment} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="corporate" disabled={environment !== 'corporate'}>
                    <Shield className="w-4 h-4 mr-2" />
                    Corporativo
                  </TabsTrigger>
                  <TabsTrigger value="personal" disabled={environment !== 'personal'}>
                    <Chrome className="w-4 h-4 mr-2" />
                    Pessoal
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="corporate" className="mt-4">
                  <div className="space-y-4">
                    <Alert>
                      <Shield className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Ambiente corporativo detectado!</strong> Use o script PowerShell para instalação automática em toda a rede.
                      </AlertDescription>
                    </Alert>
                    
                    <div className="grid gap-4">
                      <Button 
                        onClick={() => setShowPowerShellScript(!showPowerShellScript)}
                        variant="default"
                        size="lg"
                        className="w-full"
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        {showPowerShellScript ? 'Ocultar Script' : 'Gerar Script PowerShell'}
                      </Button>
                      
                      {showPowerShellScript && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">Script PowerShell (Execute como Administrador)</span>
                            <Button 
                              onClick={copyPowerShellScript}
                              variant="outline"
                              size="sm"
                            >
                              <Copy className="w-3 h-3 mr-1" />
                              Copiar
                            </Button>
                          </div>
                          <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto max-h-64">
                            {generatePowerShellScript()}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="personal" className="mt-4">
                  <div className="space-y-4">
                    <Alert>
                      <Chrome className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Ambiente pessoal detectado!</strong> Tentaremos instalação automática via Chrome Web Store com fallback manual.
                      </AlertDescription>
                    </Alert>
                    
                    <Button 
                      onClick={handleAutomaticInstall}
                      disabled={isInstalled}
                      variant="default"
                      size="lg"
                      className="w-full"
                    >
                      {isInstalled ? (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Já Instalado
                        </>
                      ) : (
                        <>
                          <Zap className="mr-2 h-4 w-4" />
                          Instalação em 1 Clique
                        </>
                      )}
                    </Button>
                    
                    {autoInstallProgress && (
                      <div className="p-3 bg-muted rounded-md">
                        <p className="text-sm">{autoInstallProgress}</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        {/* Fallback Manual Installation */}
        {(installationMethod === 'manual' || downloadStarted) && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Download Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Download Manual
                </CardTitle>
                <CardDescription>
                  Baixe a extensão empacotada pronta para instalação
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button 
                    onClick={handleDownloadExtension}
                    disabled={downloadStarted}
                    className="w-full"
                    size="lg"
                  >
                    {downloadStarted ? (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Download Iniciado
                      </>
                    ) : (
                      <>
                        <Download className="mr-2 h-4 w-4" />
                        Baixar Extensão (.crx)
                      </>
                    )}
                  </Button>
                  
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>• Arquivo: corpmonitor-extension.crx</p>
                    <p>• Tamanho: ~50KB</p>
                    <p>• Versão: 1.0.0</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* System Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Chrome className="h-5 w-5" />
                  Informações do Sistema
                </CardTitle>
                <CardDescription>
                  Verificação de compatibilidade
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span>Navegador:</span>
                    <Badge variant="outline">
                      {navigator.userAgent.includes('Chrome') ? 'Chrome ✓' : 'Não Chrome ⚠️'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Ambiente:</span>
                    <Badge variant={environment === 'corporate' ? 'default' : 'secondary'}>
                      {environment === 'corporate' ? 'Corporativo' : 'Pessoal'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Suporte:</span>
                    <Badge variant="outline">
                      Manifest V3 ✓
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Installation Steps */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Passos de Instalação</CardTitle>
            <CardDescription>
              Siga as instruções na ordem para instalar a extensão
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {steps.map((step) => (
                <div
                  key={step.number}
                  className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                    step.completed 
                      ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' 
                      : currentStep === step.number 
                        ? 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800'
                        : 'bg-muted/50'
                  }`}
                >
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    step.completed 
                      ? 'bg-green-600 text-white' 
                      : currentStep === step.number
                        ? 'bg-blue-600 text-white'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {step.completed ? <CheckCircle2 className="h-4 w-4" /> : step.number}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{step.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                    
                    {step.number === 2 && currentStep >= 2 && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2"
                        onClick={handleManualInstall}
                      >
                        <ExternalLink className="mr-2 h-3 w-3" />
                        Abrir chrome://extensions/
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alternative Methods */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Métodos Alternativos</CardTitle>
            <CardDescription>
              Outras formas de instalar a extensão
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Modo Desenvolvedor</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Instale diretamente da pasta de desenvolvimento
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  Ver Instruções Detalhadas
                </Button>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold mb-2">Instalação Corporativa</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Para administradores de TI via GPO
                </p>
                <Button variant="outline" size="sm" className="w-full">
                  Guia para Admins
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}