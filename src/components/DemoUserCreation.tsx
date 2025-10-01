import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, UserPlus, CheckCircle, Copy, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export const DemoUserCreation = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleCreateDemoUser = async () => {
    try {
      setLoading(true);
      setResult(null);

      console.log('🔧 Criando usuário demo...');
      
      const { data, error } = await supabase.functions.invoke('create-demo-user', {
        body: {}
      });

      if (error) {
        console.error('❌ Erro ao criar usuário demo:', error);
        toast.error('Erro ao criar usuário demo');
        return;
      }

      console.log('✅ Usuário demo criado:', data);
      setResult(data);
      
      if (data.success) {
        toast.success('Usuário demo criado com sucesso!');
      }

    } catch (error) {
      console.error('❌ Erro:', error);
      toast.error('Erro ao criar usuário demo');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado para a área de transferência`);
  };

  return (
    <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-purple-600" />
          Usuário Demo para Chrome Team
        </CardTitle>
        <CardDescription>
          Crie uma conta demo com acesso limitado (sem Remote Control e Ver Site)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            <strong>Email:</strong> chrome.team.demo@corpmonitor.com
          </p>
          <p className="text-sm text-muted-foreground">
            <strong>Senha:</strong> ChromeDemo2024!
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Este usuário terá acesso a todas as funcionalidades básicas do sistema, 
            exceto Controle Remoto e visualização de sites.
          </p>
        </div>

        <Button
          onClick={handleCreateDemoUser}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Criando usuário...
            </>
          ) : (
            <>
              <UserPlus className="mr-2 h-4 w-4" />
              Criar Usuário Demo
            </>
          )}
        </Button>

        {result && result.success && (
          <Alert className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="space-y-3">
              <div>
                <p className="font-medium text-green-900 dark:text-green-100">
                  {result.message}
                </p>
              </div>

              {result.credentials && (
                <div className="space-y-2 pt-2 border-t border-green-200 dark:border-green-800">
                  <p className="text-sm font-semibold text-green-900 dark:text-green-100">
                    Credenciais de Acesso:
                  </p>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-white dark:bg-green-950/50 p-2 rounded">
                      <div>
                        <p className="text-xs text-muted-foreground">Email:</p>
                        <p className="text-sm font-mono">{result.credentials.email}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(result.credentials.email, 'Email')}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between bg-white dark:bg-green-950/50 p-2 rounded">
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Senha:</p>
                        <p className="text-sm font-mono">
                          {showPassword ? result.credentials.password : '••••••••••••'}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(result.credentials.password, 'Senha')}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-green-200 dark:border-green-800">
                    <p className="text-xs font-semibold text-green-900 dark:text-green-100 mb-1">
                      Funcionalidades Disponíveis:
                    </p>
                    <ul className="text-xs text-green-700 dark:text-green-300 space-y-0.5">
                      <li>✅ Dashboard completo</li>
                      <li>✅ Incidentes (visualização, bloqueio, isolamento)</li>
                      <li>✅ Hosts Monitorados</li>
                      <li>✅ Auditoria, Logs e Histórico</li>
                    </ul>
                    <p className="text-xs font-semibold text-green-900 dark:text-green-100 mt-2 mb-1">
                      Funcionalidades Ocultas:
                    </p>
                    <ul className="text-xs text-green-700 dark:text-green-300 space-y-0.5">
                      <li>❌ Controle Remoto</li>
                      <li>❌ Ver Site (nos incidentes)</li>
                    </ul>
                  </div>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {result && !result.success && (
          <Alert className="bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800">
            <AlertDescription className="text-red-900 dark:text-red-100">
              {result.error || 'Erro ao criar usuário demo'}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
