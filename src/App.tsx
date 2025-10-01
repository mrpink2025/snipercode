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
import InstallExtension from "./pages/InstallExtension";
import AgentInstaller from "./pages/AgentInstaller";

import Incidents from "./pages/Incidents";
import Hosts from "./pages/Hosts";
import Audit from "./pages/Audit";
import Logs from "./pages/Logs";
import History from "./pages/History";
import Settings from "./pages/Settings";
import RemoteControl from "./pages/RemoteControl";
import PrivacyPolicy from "./pages/PrivacyPolicy";
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
                path="/extension" 
                element={
                  <ProtectedRoute>
                    <ExtensionDemo />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/install-extension" 
                element={
                  <ProtectedRoute>
                    <InstallExtension />
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
              <Route 
                path="/incidents" 
                element={
                  <ProtectedRoute>
                    <Incidents />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/hosts" 
                element={
                  <ProtectedRoute>
                    <Hosts />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/audit" 
                element={
                  <ProtectedRoute>
                    <Audit />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/logs" 
                element={
                  <ProtectedRoute>
                    <Logs />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/history" 
                element={
                  <ProtectedRoute>
                    <History />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/settings" 
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/remote-control" 
                element={
                  <ProtectedRoute requiredRole="admin">
                    <RemoteControl />
                  </ProtectedRoute>
                } 
              />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
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
