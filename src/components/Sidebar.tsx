import { 
  LayoutDashboard, 
  AlertTriangle, 
  Shield, 
  FileText, 
  Settings,
  Database,
  Clock,
  MonitorSpeaker
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, current: true },
  { name: "Incidentes", href: "/incidents", icon: AlertTriangle, badge: "12" },
  { name: "Hosts Monitorados", href: "/hosts", icon: Shield },
  { name: "Controle Remoto", href: "/remote-control", icon: MonitorSpeaker, adminOnly: true },
  { name: "Auditoria", href: "/audit", icon: FileText },
  { name: "Logs do Sistema", href: "/logs", icon: Database },
  { name: "Histórico", href: "/history", icon: Clock },
  { name: "Configurações", href: "/settings", icon: Settings },
];

const Sidebar = () => {
  const location = useLocation();
  const { isAdmin, isDemoAdmin } = useAuth();

  return (
    <div className="flex flex-col w-sidebar bg-sidebar border-r h-screen sticky top-0">
      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          
          // Hide admin-only items for non-admin users
          if (item.adminOnly && !isAdmin) {
            return null;
          }
          
          // Hide Remote Control for demo admin
          if (item.href === '/remote-control' && isDemoAdmin) {
            return null;
          }
          
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={cn(
                "group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "mr-3 h-5 w-5 flex-shrink-0",
                  isActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground"
                )}
              />
              <span className="flex-1">{item.name}</span>
              {item.badge && (
                <Badge 
                  className={cn(
                    "ml-auto",
                    item.name === "Incidentes" ? "bg-danger text-danger-foreground" : "bg-primary text-primary-foreground"
                  )}
                >
                  {item.badge}
                </Badge>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="text-xs text-sidebar-foreground/60">
          <p>Versão 1.0.0-PoC</p>
          <p>Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;