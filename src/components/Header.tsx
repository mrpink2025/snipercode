import { Bell, Settings, User, Shield, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

const Header = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'approver': return 'Aprovador';
      case 'operator': return 'Operador';
      default: return 'Usuário';
    }
  };

  return (
    <header className="h-header border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/95 sticky top-0 z-50">
      <div className="flex items-center justify-between px-6 h-full">
        {/* Logo & Brand */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Shield className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-foreground">CorpMonitor</h1>
              <p className="text-xs text-muted-foreground">PoC Corporativo</p>
            </div>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <Badge variant="outline" className="text-success border-success/20 bg-success/10">
            <div className="w-2 h-2 bg-success rounded-full mr-2 animate-pulse" />
            Sistema Ativo
          </Badge>
        </div>

        {/* Status & Actions */}
        <div className="flex items-center space-x-4">
          {/* Operator Status */}
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">
              {getRoleLabel(profile?.role)}: {profile?.full_name || 'Carregando...'}
            </p>
            <p className="text-xs text-muted-foreground">Online • Certificado Ativo</p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" className="relative">
              <Bell className="w-4 h-4" />
              <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 text-xs bg-danger text-danger-foreground">
                3
              </Badge>
            </Button>
            <ThemeToggle />
            
            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="relative h-8 w-8 rounded-full p-0">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.avatar_url} alt={profile?.full_name} />
                    <AvatarFallback className="text-xs">
                      {profile?.full_name
                        ? profile.full_name
                            .split(' ')
                            .map(n => n[0])
                            .join('')
                            .toUpperCase()
                        : 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuItem className="flex flex-col items-start">
                  <div className="font-medium">{profile?.full_name}</div>
                  <div className="text-xs text-muted-foreground">{profile?.email}</div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  Perfil
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;