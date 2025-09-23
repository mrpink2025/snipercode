import { useState } from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/components/Dashboard";
import ExtensionPopup from "@/components/ExtensionPopup";
import BlockDomainModal from "@/components/modals/BlockDomainModal";
import RawCookieRequestModal from "@/components/modals/RawCookieRequestModal";
import ApprovalModal from "@/components/modals/ApprovalModal";
import { Button } from "@/components/ui/button";
import { Chrome } from "lucide-react";

const Index = () => {
  const [showExtensionDemo, setShowExtensionDemo] = useState(false);
  const [blockModal, setBlockModal] = useState<{isOpen: boolean, domain: string, incidentId: string}>({isOpen: false, domain: '', incidentId: ''});
  const [rawCookieModal, setRawCookieModal] = useState<{isOpen: boolean, incidentId: string, host: string}>({isOpen: false, incidentId: '', host: ''});
  const [approvalModal, setApprovalModal] = useState<{isOpen: boolean, request: any}>({isOpen: false, request: null});

  // Mock request for approval demo
  const mockRequest = {
    id: "REQ-169001",
    incidentId: "INC-169001",
    host: "facebook.com",
    category: "Investigação de Fraude",
    justification: "Necessário analisar os cookies de autenticação para investigar possível vazamento de credenciais corporativas. Os metadados indicam acesso não autorizado durante horário comercial, e precisamos do cookie raw para rastrear a origem da sessão e determinar se houve comprometimento da conta corporativa.",
    requester: "João Silva",
    timestamp: new Date().toISOString(),
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="flex">
        <Sidebar />
        
        <main className="flex-1 p-6">
          {/* Demo Extension Button */}
          <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-primary">Demonstração da Extensão Chrome</h3>
                <p className="text-sm text-primary/80 mt-1">
                  Visualize como a extensão aparece para os usuários finais
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
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setRawCookieModal({isOpen: true, incidentId: 'INC-169001', host: 'facebook.com'})}
                className="text-warning hover:bg-warning/10 hover:border-warning/20"
              >
                Demo: Solicitar Cookie Raw
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setApprovalModal({isOpen: true, request: mockRequest})}
                className="text-success hover:bg-success/10 hover:border-success/20"
              >
                Demo: Modal de Aprovação
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

      <RawCookieRequestModal 
        isOpen={rawCookieModal.isOpen}
        onClose={() => setRawCookieModal({isOpen: false, incidentId: '', host: ''})}
        incidentId={rawCookieModal.incidentId}
        host={rawCookieModal.host}
      />

      <ApprovalModal 
        isOpen={approvalModal.isOpen}
        onClose={() => setApprovalModal({isOpen: false, request: null})}
        request={approvalModal.request || mockRequest}
      />
    </div>
  );
};

export default Index;
