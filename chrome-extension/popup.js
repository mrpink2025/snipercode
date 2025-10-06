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
  document.body.innerHTML = `
    <div style="padding: 20px; text-align: center; color: #666;">
      <h3>Extensão não está ativa</h3>
      <p>Por favor, recarregue a página e tente novamente.</p>
      <button onclick="window.close()">Fechar</button>
    </div>
  `;
}

// Show extension error message
function showExtensionError(error) {
  document.body.innerHTML = `
    <div style="padding: 20px; text-align: center; color: #d32f2f;">
      <h3>Erro na Extensão</h3>
      <p>Ocorreu um erro: ${error.message}</p>
      <button onclick="window.close()">Fechar</button>
    </div>
  `;
}

// Show main interface
function showMainInterface() {
  const mainInterface = document.getElementById('mainInterface');
  if (mainInterface) {
    mainInterface.classList.remove('hidden');
  }
}

// Setup event listeners
function setupEventListeners() {
  // Toggle monitoring
  document.getElementById('toggleSwitch').addEventListener('click', async () => {
    const status = await getStatus();
    const newState = !status.monitoringEnabled;
    
    await chrome.runtime.sendMessage({ action: 'toggleMonitoring', enabled: newState });
    await loadStatus();
  });
  
  // Console button
  document.getElementById('consoleBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: window.location.origin + '/#/dashboard' });
  });
  
  // Settings button
  document.getElementById('settingsBtn').addEventListener('click', () => {
    // Open extension options page or settings
    chrome.runtime.openOptionsPage?.() || chrome.tabs.create({ 
      url: chrome.runtime.getURL('options.html') 
    });
  });
  
  // Privacy policy
  document.getElementById('privacyLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://monitorcorporativo.com/privacy-policy.html' });
  });
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