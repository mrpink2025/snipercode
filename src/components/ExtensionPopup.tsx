import { useState, useEffect } from "react";

const ExtensionPopup = () => {
  const [lastReport, setLastReport] = useState<string>("Nunca");
  const [threatsBlocked, setThreatsBlocked] = useState(0);
  const [sitesAnalyzed, setSitesAnalyzed] = useState(0);
  const [threatsTrend, setThreatsTrend] = useState("+12");
  const [sitesTrend, setSitesTrend] = useState("+8");

  useEffect(() => {
    // Simular última análise há 2 minutos
    const lastTime = new Date(Date.now() - 120000);
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastTime.getTime()) / 60000);
    
    if (diff < 1) {
      setLastReport('Agora');
    } else if (diff < 60) {
      setLastReport(`${diff}min atrás`);
    } else {
      const hours = Math.floor(diff / 60);
      setLastReport(`${hours}h atrás`);
    }

    // Simular estatísticas
    setThreatsBlocked(47);
    setSitesAnalyzed(234);
    setThreatsTrend("+12");
    setSitesTrend("+8");
  }, []);

  const handlePrivacyPolicy = (e: React.MouseEvent) => {
    e.preventDefault();
    window.open('https://monitorcorporativo.com/privacy-policy.html', '_blank');
  };

  const handleSupport = (e: React.MouseEvent) => {
    e.preventDefault();
    window.open('https://monitorcorporativo.com/support', '_blank');
  };

  return (
    <div
      style={{
        width: '380px',
        minHeight: '550px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #3b82f6 100%)',
        color: 'white',
        margin: 0,
        padding: 0,
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      <style>
        {`
          @keyframes pulse {
            0%, 100% { 
              opacity: 1; 
              transform: scale(1);
            }
            50% { 
              opacity: 0.8; 
              transform: scale(1.05);
            }
          }
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          .pulse-shield {
            animation: pulse 2s ease-in-out infinite;
          }
        `}
      </style>

      <div style={{ padding: '24px' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '24px' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              className="pulse-shield"
              style={{
                width: '40px',
                height: '40px',
                background: 'rgba(16, 185, 129, 0.2)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                border: '2px solid rgba(16, 185, 129, 0.4)',
              }}
            >
              🛡️
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.5px' }}>
                CorpMonitor
              </div>
              <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '2px' }}>
                Enterprise Security
              </div>
            </div>
          </div>
          <span style={{
            background: '#10b981',
            padding: '6px 12px',
            borderRadius: '14px',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.5px',
            boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)',
          }}>
            ATIVO
          </span>
        </div>

        {/* Status Section - Glassmorphism */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '20px',
          }}
        >
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            marginBottom: '12px',
            justifyContent: 'center'
          }}>
            <span style={{ fontSize: '18px' }}>✓</span>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>
              Sistema Seguro
            </div>
          </div>
          
          <div style={{ fontSize: '13px', opacity: 0.9, textAlign: 'center', marginBottom: '12px' }}>
            🔒 Conexão Criptografada SSL/TLS
          </div>

          {/* Progress Bar */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '11px',
              opacity: 0.8,
              marginBottom: '6px'
            }}>
              <span>Nível de Proteção</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>MÁXIMO</span>
            </div>
            <div style={{
              width: '100%',
              height: '6px',
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '3px',
              overflow: 'hidden',
              position: 'relative',
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, #10b981, #22c55e)',
                borderRadius: '3px',
              }}/>
            </div>
          </div>

          <div style={{ 
            fontSize: '11px', 
            opacity: 0.75, 
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}>
            <span>🕐</span>
            <span>Última análise: {lastReport}</span>
          </div>
        </div>

        {/* Stats Grid - Glassmorphism */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.1)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              boxShadow: '0 4px 16px 0 rgba(16, 185, 129, 0.1)',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '12px', marginBottom: '8px', opacity: 0.9 }}>
              🚫 Ameaças Bloqueadas
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, marginBottom: '4px', color: '#10b981' }}>
              {threatsBlocked}
            </div>
            <div style={{ fontSize: '11px', opacity: 0.7, color: '#10b981' }}>
              ↑ {threatsTrend}% hoje
            </div>
          </div>
          <div
            style={{
              background: 'rgba(59, 130, 246, 0.1)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              boxShadow: '0 4px 16px 0 rgba(59, 130, 246, 0.1)',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '12px', marginBottom: '8px', opacity: 0.9 }}>
              🔍 Sites Analisados
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, marginBottom: '4px', color: '#3b82f6' }}>
              {sitesAnalyzed}
            </div>
            <div style={{ fontSize: '11px', opacity: 0.7, color: '#3b82f6' }}>
              ↑ {sitesTrend}% hoje
            </div>
          </div>
        </div>

        {/* Additional Security Info */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '14px',
            marginBottom: '20px',
          }}
        >
          <div style={{ fontSize: '11px', opacity: 0.85, marginBottom: '8px', fontWeight: 600 }}>
            📊 Estatísticas de Hoje
          </div>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '6px',
            fontSize: '11px',
            opacity: 0.75 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>⚡ Tempo de resposta</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>&lt;1ms</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>🟢 Status dos servidores</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>Online</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>📈 Disponibilidade</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>99.9%</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.15)',
            paddingTop: '16px',
            fontSize: '11px',
            opacity: 0.7,
          }}
        >
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px'
          }}>
            <span>v1.0.0 • Atualizado hoje</span>
            <span style={{
              background: 'rgba(16, 185, 129, 0.2)',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '9px',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              fontWeight: 600
            }}>
              🔒 ISO 27001
            </span>
          </div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center',
            gap: '16px',
            fontSize: '11px'
          }}>
            <a
              href="#"
              onClick={handleSupport}
              style={{ color: 'white', textDecoration: 'none', opacity: 0.8 }}
            >
              💬 Suporte
            </a>
            <a
              href="#"
              onClick={handlePrivacyPolicy}
              style={{ color: 'white', textDecoration: 'none', opacity: 0.8 }}
            >
              🔐 Privacidade
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExtensionPopup;