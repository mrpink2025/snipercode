import { useState, useEffect } from "react";

const ExtensionPopup = () => {
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [lastReport, setLastReport] = useState<string>("Nunca");
  const [threatsBlocked, setThreatsBlocked] = useState(0);
  const [sitesAnalyzed, setSitesAnalyzed] = useState(0);
  const [corporateMode, setCorporateMode] = useState(false);

  useEffect(() => {
    // Simular última análise há 5 minutos
    const lastTime = new Date(Date.now() - 300000);
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
    setThreatsBlocked(Math.floor(Math.random() * 10));
    setSitesAnalyzed(Math.floor(Math.random() * 50));
  }, []);

  const handleToggle = () => {
    if (!corporateMode) {
      setIsMonitoring(!isMonitoring);
    }
  };

  const handlePrivacyPolicy = (e: React.MouseEvent) => {
    e.preventDefault();
    window.open('https://monitorcorporativo.com/privacy-policy.html', '_blank');
  };

  return (
    <div
      style={{
        width: '350px',
        minHeight: '500px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        margin: 0,
        padding: 0,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ padding: '20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
            }}
          >
            🛡️
          </div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>CorpMonitor</div>
        </div>

        {/* Status Section */}
        {corporateMode ? (
          <div
            style={{
              textAlign: 'center',
              padding: '15px',
              background: 'rgba(39, 174, 96, 0.2)',
              borderRadius: '8px',
              marginBottom: '20px',
            }}
          >
            <strong style={{ fontSize: '14px' }}>🏢 Modo Corporativo</strong>
            <p style={{ fontSize: '12px', marginTop: '5px', opacity: 0.9 }}>
              Monitoramento sempre ativo
            </p>
          </div>
        ) : (
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
              }}
            >
              <div>
                <div style={{ fontSize: '14px', opacity: 0.9 }}>
                  {isMonitoring ? '🛡️ Proteção Ativa' : 'Proteção Pausada'}
                </div>
                <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '8px' }}>
                  Última análise: {lastReport}
                </div>
              </div>
              <div
                onClick={handleToggle}
                style={{
                  position: 'relative',
                  width: '48px',
                  height: '24px',
                  background: isMonitoring ? '#4ade80' : 'rgba(255, 255, 255, 0.3)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'background 0.3s',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '2px',
                    left: isMonitoring ? '26px' : '2px',
                    width: '20px',
                    height: '20px',
                    background: 'white',
                    borderRadius: '50%',
                    transition: 'left 0.3s',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
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
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '12px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px' }}>
              {threatsBlocked}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>Ameaças Bloqueadas</div>
          </div>
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '12px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px' }}>
              {sitesAnalyzed}
            </div>
            <div style={{ fontSize: '12px', opacity: 0.8 }}>Sites Analisados</div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.2)',
            paddingTop: '16px',
            fontSize: '12px',
            opacity: 0.7,
            textAlign: 'center',
          }}
        >
          <div>Versão 1.0.0</div>
          <div>
            <a
              href="#"
              onClick={handlePrivacyPolicy}
              style={{ color: 'white', textDecoration: 'none' }}
            >
              Política de Privacidade
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExtensionPopup;