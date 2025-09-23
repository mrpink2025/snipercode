import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, Settings, User, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const UserProfile = () => {
  const { user, profile, signOut } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [department, setDepartment] = useState(profile?.department || '');
  const [isUpdating, setIsUpdating] = useState(false);

  if (!user || !profile) {
    return null;
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          department: department || null,
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      toast.success('Perfil atualizado com sucesso!');
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Erro ao atualizar perfil');
    } finally {
      setIsUpdating(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-500/10 text-red-700 border-red-500/20';
      case 'approver':
        return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
      case 'operator':
        return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
      default:
        return 'bg-gray-500/10 text-gray-700 border-gray-500/20';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="h-3 w-3" />;
      case 'approver':
        return <Settings className="h-3 w-3" />;
      case 'operator':
        return <User className="h-3 w-3" />;
      default:
        return <User className="h-3 w-3" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'approver':
        return 'Aprovador';
      case 'operator':
        return 'Operador';
      default:
        return role;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Meu Perfil</h1>
        <Button variant="outline" onClick={signOut} className="gap-2">
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informações do Perfil
            </CardTitle>
            <CardDescription>
              Gerencie suas informações pessoais
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile.avatar_url} />
                <AvatarFallback className="text-lg">
                  {profile.full_name
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h3 className="font-semibold">{profile.full_name}</h3>
                <Badge 
                  variant="outline" 
                  className={`gap-1 ${getRoleBadgeColor(profile.role)}`}
                >
                  {getRoleIcon(profile.role)}
                  {getRoleLabel(profile.role)}
                </Badge>
              </div>
            </div>

            {/* Form */}
            {isEditing ? (
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome Completo</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Departamento</Label>
                  <Input
                    id="department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Ex: TI, RH, Financeiro"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating ? 'Salvando...' : 'Salvar'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsEditing(false);
                      setFullName(profile.full_name);
                      setDepartment(profile.department || '');
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Email
                  </Label>
                  <div className="text-sm">{profile.email}</div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Nome Completo
                  </Label>
                  <div className="text-sm">{profile.full_name}</div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Departamento
                  </Label>
                  <div className="text-sm">
                    {profile.department || 'Não informado'}
                  </div>
                </div>
                <Button onClick={() => setIsEditing(true)} variant="outline">
                  Editar Perfil
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Status da Conta
            </CardTitle>
            <CardDescription>
              Informações sobre sua conta e permissões
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">
                Status
              </Label>
              <Badge variant={profile.is_active ? 'default' : 'destructive'}>
                {profile.is_active ? 'Ativa' : 'Inativa'}
              </Badge>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">
                Permissões
              </Label>
              <div className="space-y-1 text-sm">
                {profile.role === 'admin' && (
                  <div className="flex items-center gap-2 text-green-600">
                    <Shield className="h-3 w-3" />
                    Acesso total ao sistema
                  </div>
                )}
                {(profile.role === 'approver' || profile.role === 'admin') && (
                  <div className="flex items-center gap-2 text-blue-600">
                    <Settings className="h-3 w-3" />
                    Aprovação de solicitações
                  </div>
                )}
                <div className="flex items-center gap-2 text-gray-600">
                  <User className="h-3 w-3" />
                  Visualização de incidentes
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">
                ID do Usuário
              </Label>
              <div className="text-xs font-mono bg-muted p-2 rounded">
                {user.id}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};