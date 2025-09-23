import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ExtensionDemo from "./pages/ExtensionDemo";
import AgentInstaller from "./pages/AgentInstaller";
import Approvals from "./pages/Approvals";
import NotFound from "./pages/NotFound";
import { UserProfile } from "./components/UserProfile";
import { useAppStore } from './lib/store';
import { useEffect } from 'react';

const queryClient = new QueryClient();

function App() {
  const { darkMode } = useAppStore();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route 
                path="/" 
                element={
                  <ProtectedRoute>
                    <Index />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/approvals" 
                element={
                  <ProtectedRoute requiredRole="approver">
                    <Approvals />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/extension" 
                element={
                  <ProtectedRoute>
                    <ExtensionDemo />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/agent" 
                element={
                  <ProtectedRoute requiredRole="admin">
                    <AgentInstaller />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/profile" 
                element={
                  <ProtectedRoute>
                    <UserProfile />
                  </ProtectedRoute>
                } 
              />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
