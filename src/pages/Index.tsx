import { useState } from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/components/Dashboard";
import ExtensionPopup from "@/components/ExtensionPopup";
import BlockDomainModal from "@/components/modals/BlockDomainModal";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { Button } from "@/components/ui/button";
import { Chrome } from "lucide-react";

const Index = () => {
  const [showExtensionDemo, setShowExtensionDemo] = useState(false);
  const [blockModal, setBlockModal] = useState<{isOpen: boolean, domain: string, incidentId: string}>({isOpen: false, domain: '', incidentId: ''});

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-6">
          {/* Connection Status Indicator */}
          <div className="mb-4">
            <ConnectionStatus />
          </div>
          {/* Demo Extension Button */}
          <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
              <h3 className="font-medium text-primary flex items-center gap-2">
                🛡️ Sistema de Proteção Ativo
              </h3>
              <p className="text-sm text-primary/80 mt-1">
                Extensão Chrome protegendo contra phishing, malware e vazamento de dados em tempo real
              </p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => setShowExtensionDemo(true)}
                className="border-primary/20 text-primary hover:bg-primary/10"
              >
                <Chrome className="w-4 h-4 mr-2" />
                Ver Extensão
              </Button>
            </div>
          </div>

          {/* Demo Actions */}
          <div className="mb-6 p-4 bg-muted/50 rounded-lg">
            <h3 className="font-medium mb-3">Demonstrações dos Fluxos</h3>
            <div className="flex space-x-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setBlockModal({isOpen: true, domain: 'facebook.com', incidentId: 'INC-169001'})}
                className="text-danger hover:bg-danger/10 hover:border-danger/20"
              >
                Demo: Bloquear Domínio
              </Button>
            </div>
          </div>

          {/* Main Dashboard */}
          <Dashboard />
        </main>
      </div>

      {/* Extension Demo Modal */}
      {showExtensionDemo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowExtensionDemo(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <ExtensionPopup />
          </div>
        </div>
      )}

      {/* Modals */}
      <BlockDomainModal 
        isOpen={blockModal.isOpen}
        onClose={() => setBlockModal({isOpen: false, domain: '', incidentId: ''})}
        domain={blockModal.domain}
        incidentId={blockModal.incidentId}
      />
    </div>
  );
};

export default Index;
