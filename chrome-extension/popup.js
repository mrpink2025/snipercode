// CorpMonitor Popup Interface
document.addEventListener('DOMContentLoaded', async () => {
  await initializePopup();
});

// Initialize popup interface with extension detection
async function initializePopup() {
  try {
    // Check if we can communicate with background script
    const isExtensionActive = await checkExtensionActive();
    
    if (!isExtensionActive) {
      showExtensionNotActive();
      return;
    }
    
    // Always show main interface directly
    showMainInterface();
    await loadStatus();
    updateStats();
    
    setupEventListeners();
    
    // Notify parent page (if opened from web)
    if (window.parent !== window) {
      window.parent.postMessage({ 
        type: 'CORPMONITOR_EXTENSION_DETECTED', 
        installed: true, 
        version: chrome.runtime.getManifest().version 
      }, '*');
    }
  } catch (error) {
    console.error('Failed to initialize popup:', error);
    showExtensionError(error);
  }
}

// Check if extension is properly active
async function checkExtensionActive() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'ping' });
    return response && response.pong;
  } catch (error) {
    return false;
  }
}

// Show extension not active message
function showExtensionNotActive() {
  const container = document.createElement('div');
  container.style.cssText = 'padding: 20px; text-align: center; color: #666;';
  container.innerHTML = `
    <h3>Extensão não está ativa</h3>
    <p>Por favor, recarregue a página e tente novamente.</p>
    <button id="closeBtn">Fechar</button>
  `;
  
  document.body.innerHTML = '';
  document.body.appendChild(container);
  
  // Adicionar event listener DEPOIS do botão estar no DOM
  document.getElementById('closeBtn').addEventListener('click', () => window.close());
}

// Show extension error message
function showExtensionError(error) {
  const container = document.createElement('div');
  container.style.cssText = 'padding: 20px; text-align: center; color: #d32f2f;';
  container.innerHTML = `
    <h3>Erro na Extensão</h3>
    <p>Ocorreu um erro: ${error.message}</p>
    <button id="closeErrorBtn">Fechar</button>
  `;
  
  document.body.innerHTML = '';
  document.body.appendChild(container);
  
  // Adicionar event listener DEPOIS do botão estar no DOM
  document.getElementById('closeErrorBtn').addEventListener('click', () => window.close());
}

// Show main interface - ✅ MODO CORPORATIVO
async function showMainInterface() {
  const mainInterface = document.getElementById('mainInterface');
  
  // ✅ VERIFICAÇÃO: Garantir que elemento existe
  if (!mainInterface) {
    console.error('Elemento #mainInterface não encontrado no DOM');
    return;
  }
  
  // Garantir que o elemento esteja visível
  mainInterface.classList.remove('hidden');
  mainInterface.style.display = 'block';
  
  // ✅ NOVO: Verificar modo corporativo
  const storage = await chrome.storage.local.get(['corporateMode']);
  if (storage.corporateMode === true) {
    // Esconder toggle de ativação
    const toggleContainer = document.querySelector('.status-section');
    if (toggleContainer) {
      // Substituir por badge corporativo
      toggleContainer.innerHTML = `
        <div style="text-align: center; padding: 15px; background: rgba(39, 174, 96, 0.2); border-radius: 8px;">
          <strong style="font-size: 14px;">🏢 Modo Corporativo</strong>
          <p style="font-size: 12px; margin-top: 5px; opacity: 0.9;">Monitoramento sempre ativo</p>
        </div>
      `;
    }
  }
}

// Setup event listeners
function setupEventListeners() {
  // ✅ VERIFICAÇÕES DEFENSIVAS: Garantir que elementos existem
  const toggleSwitch = document.getElementById('toggleSwitch');
  const consoleBtn = document.getElementById('consoleBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const privacyLink = document.getElementById('privacyLink');
  
  // Toggle monitoring
  if (toggleSwitch) {
    toggleSwitch.addEventListener('click', async () => {
      const status = await getStatus();
      const newState = !status.monitoringEnabled;
      
      await chrome.runtime.sendMessage({ action: 'toggleMonitoring', enabled: newState });
      await loadStatus();
    });
  }
  
  // Console button
  if (consoleBtn) {
    consoleBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: window.location.origin + '/#/dashboard' });
    });
  }
  
  // Settings button
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage?.() || chrome.tabs.create({ 
        url: chrome.runtime.getURL('options.html') 
      });
    });
  }
  
  // Privacy policy
  if (privacyLink) {
    privacyLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://monitorcorporativo.com/privacy-policy.html' });
    });
  }
}

// Get current status from background
async function getStatus() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getStatus' }, resolve);
  });
}

// Load and display current status
async function loadStatus() {
  const status = await getStatus();
  
  // Update toggle switch
  const toggleSwitch = document.getElementById('toggleSwitch');
  const statusText = document.getElementById('statusText');
  const lastReport = document.getElementById('lastReport');
  
  if (status.monitoringEnabled) {
    toggleSwitch.classList.add('active');
    statusText.textContent = 'Monitoramento Ativo';
  } else {
    toggleSwitch.classList.remove('active');
    statusText.textContent = 'Monitoramento Pausado';
  }
  
  // Update last report time
  if (status.lastReportTime) {
    const lastTime = new Date(status.lastReportTime);
    const now = new Date();
    const diff = Math.floor((now - lastTime) / 60000); // minutes
    
    if (diff < 1) {
      lastReport.textContent = 'Último relatório: Agora';
    } else if (diff < 60) {
      lastReport.textContent = `Último relatório: ${diff}min atrás`;
    } else if (diff < 1440) {
      const hours = Math.floor(diff / 60);
      lastReport.textContent = `Último relatório: ${hours}h atrás`;
    } else {
      lastReport.textContent = `Último relatório: ${Math.floor(diff / 1440)}d atrás`;
    }
  } else {
    lastReport.textContent = 'Último relatório: Nunca';
  }
}

// Update statistics
async function updateStats() {
  try {
    // Get current tab info
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab && tab.url && !tab.url.startsWith('chrome://')) {
      const url = new URL(tab.url);
      const cookies = await chrome.cookies.getAll({ domain: url.hostname });
      
      document.getElementById('cookieCount').textContent = cookies.length;
      document.getElementById('metadataCount').textContent = cookies.length * 2; // Example calculation
    } else {
      document.getElementById('cookieCount').textContent = '0';
      document.getElementById('metadataCount').textContent = '0';
    }
  } catch (error) {
    console.error('Error updating stats:', error);
    document.getElementById('cookieCount').textContent = '0';
    document.getElementById('metadataCount').textContent = '0';
  }
}

// Refresh stats every 30 seconds
setInterval(updateStats, 30000);