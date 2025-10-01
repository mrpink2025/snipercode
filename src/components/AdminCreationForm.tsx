import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { UserPlus, Trash2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createAdminUsers } from '@/lib/admin-management';
import { toast } from 'sonner';

interface AdminUser {
  email: string;
  password: string;
}

export const AdminCreationForm = () => {
  const [admins, setAdmins] = useState<AdminUser[]>([
    { email: '', password: '' }
  ]);
  const [loading, setLoading] = useState(false);

  const addAdminField = () => {
    setAdmins([...admins, { email: '', password: '' }]);
  };

  const removeAdminField = (index: number) => {
    setAdmins(admins.filter((_, i) => i !== index));
  };

  const updateAdmin = (index: number, field: 'email' | 'password', value: string) => {
    const newAdmins = [...admins];
    newAdmins[index][field] = value;
    setAdmins(newAdmins);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validAdmins = admins.filter(a => a.email && a.password);
    
    if (validAdmins.length === 0) {
      toast.error('Preencha ao menos um administrador');
      return;
    }

    setLoading(true);
    try {
      const results = await createAdminUsers(validAdmins);
      
      const successCount = results.results.filter((r: any) => r.success).length;
      const failCount = results.results.filter((r: any) => !r.success).length;

      if (successCount > 0) {
        toast.success(`${successCount} administrador(es) criado(s) com sucesso!`);
      }
      
      if (failCount > 0) {
        results.results
          .filter((r: any) => !r.success)
          .forEach((r: any) => {
            toast.error(`${r.email}: ${r.error}`);
          });
      }

      // Limpar campos de sucesso
      const failedEmails = results.results
        .filter((r: any) => !r.success)
        .map((r: any) => r.email);
      
      setAdmins(
        validAdmins
          .filter(a => failedEmails.includes(a.email))
          .concat([{ email: '', password: '' }])
      );
      
    } catch (error: any) {
      toast.error(`Erro ao criar administradores: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          Criar Administradores (SuperAdmin)
        </CardTitle>
        <CardDescription>
          Adicione novos usuários com permissão de administrador ao sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Esta funcionalidade está disponível apenas para SuperAdmin. Os usuários criados aqui terão permissões de administrador.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          {admins.map((admin, index) => (
            <div key={index} className="flex gap-2 items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor={`email-${index}`}>Email</Label>
                <Input
                  id={`email-${index}`}
                  type="email"
                  placeholder="admin@exemplo.com"
                  value={admin.email}
                  onChange={(e) => updateAdmin(index, 'email', e.target.value)}
                  required
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor={`password-${index}`}>Senha</Label>
                <Input
                  id={`password-${index}`}
                  type="password"
                  placeholder="Senha forte"
                  value={admin.password}
                  onChange={(e) => updateAdmin(index, 'password', e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              {admins.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removeAdminField(index)}
                  className="text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={addAdminField}
              className="flex-1"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Adicionar Mais
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Criando...' : 'Criar Administradores'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
