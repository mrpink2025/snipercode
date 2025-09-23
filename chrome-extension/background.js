// CorpMonitor Background Service Worker
const API_BASE = 'https://vxvcquifgwtbjghrcjbp.supabase.co/functions/v1';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4dmNxdWlmZ3d0YmpnaHJjamJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2NDM1MjcsImV4cCI6MjA3NDIxOTUyN30.AdlrmsW5gGY5o9pKkq6LJYtTbi7SLtKdqwb--4h8rEs';

// Global state
let monitoringEnabled = false;
let lastReportTime = null;
let machineId = null;

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('CorpMonitor extension installed');
  initializeExtension();
});

// Initialize machine ID and settings
async function initializeExtension() {
  const result = await chrome.storage.local.get(['machineId', 'monitoringEnabled', 'userConsented']);
  
  if (!result.machineId) {
    machineId = generateMachineId();
    await chrome.storage.local.set({ machineId });
  } else {
    machineId = result.machineId;
  }
  
  monitoringEnabled = result.monitoringEnabled || false;
  
  // If user hasn't consented yet, disable monitoring
  if (!result.userConsented) {
    monitoringEnabled = false;
    await chrome.storage.local.set({ monitoringEnabled: false });
  }
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
      const cookieData = {
        host: host,
        tabUrl: tab.url,
        cookies: cookies.map(cookie => ({
          name: cookie.name,
          domain: cookie.domain,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite,
          expirationDate: cookie.expirationDate
        })),
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

// Create incident via API
async function createIncident(data) {
  try {
    const response = await fetch(`${API_BASE}/create-incident`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({
        host: data.host,
        tab_url: data.tabUrl,
        machine_id: data.machineId,
        cookie_excerpt: generateCookieExcerpt(data.cookies),
        full_cookie_data: data.cookies,
        severity: determineSeverity(data.cookies),
        is_red_list: await isRedListDomain(data.host)
      })
    });
    
    if (response.ok) {
      lastReportTime = new Date();
      await chrome.storage.local.set({ lastReportTime: lastReportTime.toISOString() });
      console.log('Incident created successfully');
    }
  } catch (error) {
    console.error('Error creating incident:', error);
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

// Check if domain is in red list (blocked domains)
async function isRedListDomain(host) {
  try {
    const response = await fetch(`https://vxvcquifgwtbjghrcjbp.supabase.co/rest/v1/blocked_domains?domain=eq.${host}&select=id`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    const data = await response.json();
    return data.length > 0;
  } catch (error) {
    console.error('Error checking red list:', error);
    return false;
  }
}

// Message handling from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getStatus':
      sendResponse({
        monitoringEnabled,
        lastReportTime,
        machineId
      });
      break;
      
    case 'toggleMonitoring':
      toggleMonitoring(request.enabled);
      sendResponse({ success: true });
      break;
      
    case 'setUserConsent':
      setUserConsent(request.consented);
      sendResponse({ success: true });
      break;
  }
});

// Toggle monitoring state
async function toggleMonitoring(enabled) {
  monitoringEnabled = enabled;
  await chrome.storage.local.set({ monitoringEnabled });
}

// Set user consent
async function setUserConsent(consented) {
  await chrome.storage.local.set({ userConsented: consented });
  if (consented) {
    monitoringEnabled = true;
    await chrome.storage.local.set({ monitoringEnabled: true });
  } else {
    monitoringEnabled = false;
    await chrome.storage.local.set({ monitoringEnabled: false });
  }
}