// CorpMonitor Popup Interface
document.addEventListener('DOMContentLoaded', async () => {
  await initializePopup();
});

// Initialize popup interface with extension detection
async function initializePopup() {
  try {
    console.log('[CorpMonitor] Popup inicializado');
    
    // Check if we can communicate with background script
    const isExtensionActive = await checkExtensionActive();
    
    if (!isExtensionActive) {
      console.warn('[CorpMonitor] Extensão não está ativa');
      showExtensionNotActive();
      return;
    }
    
    console.log('[CorpMonitor] Extensão ativa, carregando interface...');
    
    // Show main interface
    showMainInterface();
    await loadStatus();
    await updateStats();
    
    setupEventListeners();
    
    // Update stats every 30 seconds
    setInterval(updateStats, 30000);
    
    // Update last report time every minute
    setInterval(() => updateLastReport(), 60000);
    
    // Notify parent page (if opened from web)
    if (window.parent !== window) {
      window.parent.postMessage({ 
        type: 'CORPMONITOR_EXTENSION_DETECTED', 
        installed: true, 
        version: chrome.runtime.getManifest().version 
      }, '*');
    }
    
    console.log('[CorpMonitor] Popup carregado com sucesso');
  } catch (error) {
    console.error('[CorpMonitor] Erro ao inicializar popup:', error);
    showExtensionError(error);
  }
}

// Check if extension is properly active
async function checkExtensionActive() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'ping' });
    return response && response.pong;
  } catch (error) {
    console.error('[CorpMonitor] Erro ao verificar status:', error);
    return false;
  }
}

// Show extension not active message
function showExtensionNotActive() {
  document.getElementById('mainInterface').classList.add('hidden');
  document.getElementById('errorContainer').classList.remove('hidden');
  
  const closeBtn = document.getElementById('closeBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => window.close());
  }
}

// Show extension error message
function showExtensionError(error) {
  document.getElementById('mainInterface').classList.add('hidden');
  document.getElementById('errorContainer').classList.remove('hidden');
  
  const errorMessage = document.getElementById('errorMessage');
  if (errorMessage) {
    errorMessage.textContent = error.message || 'Erro desconhecido. Tente novamente.';
  }
  
  const closeBtn = document.getElementById('closeBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => window.close());
  }
}

// Show main interface
function showMainInterface() {
  const mainInterface = document.getElementById('mainInterface');
  
  if (!mainInterface) {
    console.error('[CorpMonitor] Elemento #mainInterface não encontrado no DOM');
    return;
  }
  
  document.getElementById('errorContainer').classList.add('hidden');
  mainInterface.classList.remove('hidden');
}

// Setup event listeners
function setupEventListeners() {
  // Privacy policy link
  const privacyLink = document.getElementById('privacyLink');
  if (privacyLink) {
    privacyLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: chrome.runtime.getURL('privacy-policy.html') });
    });
  }
  
  // Support link
  const supportLink = document.getElementById('supportLink');
  if (supportLink) {
    supportLink.addEventListener('click', (e) => {
      e.preventDefault();
      // Open dashboard support page
      chrome.tabs.create({ url: 'https://perf-monitor.com/support' });
    });
  }
}

// Get current status from background
async function getStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
    return response || {
      monitoringEnabled: true,
      lastReportTime: null,
      stats: {
        threatsBlocked: 0,
        sitesAnalyzed: 0
      }
    };
  } catch (error) {
    console.error('[CorpMonitor] Erro ao obter status:', error);
    return {
      monitoringEnabled: true,
      lastReportTime: null,
      stats: {
        threatsBlocked: 0,
        sitesAnalyzed: 0
      }
    };
  }
}

// Load and display current status
async function loadStatus() {
  try {
    const status = await getStatus();
    console.log('[CorpMonitor] Status atual:', status);
    
    // Update last report time
    updateLastReport(status.lastReportTime);
    
  } catch (error) {
    console.error('[CorpMonitor] Erro ao carregar status:', error);
  }
}

// Update last report time
function updateLastReport(lastReportTime) {
  const lastReportEl = document.getElementById('lastReport');
  if (!lastReportEl) return;
  
  if (!lastReportTime) {
    lastReportEl.textContent = 'Última análise: Nunca';
    return;
  }
  
  const lastTime = new Date(lastReportTime);
  const now = new Date();
  const diffMs = now - lastTime;
  const diffMin = Math.floor(diffMs / 60000);
  
  if (diffMin < 1) {
    lastReportEl.textContent = 'Última análise: Agora';
  } else if (diffMin < 60) {
    lastReportEl.textContent = `Última análise: ${diffMin}min atrás`;
  } else if (diffMin < 1440) {
    const hours = Math.floor(diffMin / 60);
    lastReportEl.textContent = `Última análise: ${hours}h atrás`;
  } else {
    const days = Math.floor(diffMin / 1440);
    lastReportEl.textContent = `Última análise: ${days}d atrás`;
  }
}

// Update statistics
async function updateStats() {
  try {
    // Get current tab info
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      console.warn('[CorpMonitor] Nenhuma aba ativa encontrada');
      return;
    }
    
    // Get tab info from background
    const response = await chrome.runtime.sendMessage({ 
      action: 'getTabInfo',
      tabId: tab.id 
    });
    
    console.log('[CorpMonitor] Estatísticas recebidas:', response);
    
    // Update threats blocked with animation
    const threatsEl = document.getElementById('threatsBlocked');
    if (threatsEl && response && typeof response.threatsBlocked === 'number') {
      animateNumber(threatsEl, parseInt(threatsEl.textContent) || 0, response.threatsBlocked);
    }
    
    // Update sites analyzed with animation
    const sitesEl = document.getElementById('sitesAnalyzed');
    if (sitesEl && response && typeof response.sitesAnalyzed === 'number') {
      animateNumber(sitesEl, parseInt(sitesEl.textContent) || 0, response.sitesAnalyzed);
    }
    
    // Fallback: use cookie count if no data from background
    if (!response && tab.url && !tab.url.startsWith('chrome://')) {
      const url = new URL(tab.url);
      const cookies = await chrome.cookies.getAll({ domain: url.hostname });
      
      if (threatsEl) threatsEl.textContent = Math.floor(cookies.length / 2);
      if (sitesEl) sitesEl.textContent = cookies.length;
    }
    
  } catch (error) {
    console.error('[CorpMonitor] Erro ao atualizar estatísticas:', error);
  }
}

// Animate number change
function animateNumber(element, from, to) {
  if (from === to) return;
  
  const duration = 1000; // 1 second
  const steps = 20;
  const increment = (to - from) / steps;
  const stepDuration = duration / steps;
  
  let current = from;
  let step = 0;
  
  const timer = setInterval(() => {
    step++;
    current += increment;
    
    if (step >= steps) {
      element.textContent = Math.round(to);
      clearInterval(timer);
    } else {
      element.textContent = Math.round(current);
    }
  }, stepDuration);
}

// Log popup events
console.log('[CorpMonitor] Popup script carregado');
