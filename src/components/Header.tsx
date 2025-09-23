import { Bell, Settings, User, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ThemeToggle";

const Header = () => {
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
            <p className="text-sm font-medium text-foreground">Operador: João Silva</p>
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
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm">
              <User className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;