import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'admin' | 'operator' | 'approver';
}

export const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user || !profile) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Check if user has inactive profile
  if (!profile.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 p-8">
          <div className="text-6xl">🚫</div>
          <h1 className="text-2xl font-bold">Conta Inativa</h1>
          <p className="text-muted-foreground max-w-md">
            Sua conta foi desativada. Entre em contato com o administrador do sistema.
          </p>
        </div>
      </div>
    );
  }

  // Check role requirements
  if (requiredRole) {
    const hasRequiredRole = (() => {
      switch (requiredRole) {
        case 'admin':
          return profile.role === 'admin';
        case 'approver':
          return profile.role === 'approver' || profile.role === 'admin';
        case 'operator':
          return ['operator', 'approver', 'admin'].includes(profile.role);
        default:
          return false;
      }
    })();

    if (!hasRequiredRole) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-4 p-8">
            <div className="text-6xl">🔒</div>
            <h1 className="text-2xl font-bold">Acesso Negado</h1>
            <p className="text-muted-foreground max-w-md">
              Você não tem permissão para acessar esta área. É necessário ter o perfil "{requiredRole}".
            </p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};