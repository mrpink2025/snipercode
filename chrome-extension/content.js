// PerfMonitor Content Script
(function() {
  'use strict';
  
  let isProtectionActive = false;
  let lastDataCollection = 0;
  const COLLECTION_INTERVAL = 30000; // 30 seconds
  
  // Initialize content script
  initialize();
  
  async function initialize() {
    console.log('🚀 Browser Performance Monitor ativo nesta página');
    
    // 🚨 DETECT GOOGLE COOKIE MISMATCH
    detectGoogleCookieMismatch();
    
    // Check if protection is enabled
    const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
    isProtectionActive = response?.protectionEnabled || false;
    
    if (isProtectionActive) {
      startProtection();
    }
  }
  
  // 🚨 Detect Google CookieMismatch page
  function detectGoogleCookieMismatch() {
    const url = window.location.href;
    const isGoogle = url.includes('google.com') || url.includes('accounts.google');
    const hasMismatch = url.includes('CookieMismatch') || 
                        document.title.includes('Cookie') ||
                        document.body.textContent.includes('cookies');
    
    if (isGoogle && hasMismatch) {
      console.warn('[PerfMonitor] 🚨 Tentativa de roubo de sessão bloqueada!');
      
      // Notify background script
      chrome.runtime.sendMessage({
        action: 'googleCookieMismatch',
        url: url
      });
    }
  }
  
  // Start protection on page
  function startProtection() {
    // Monitor DOM changes for security threats
    const observer = new MutationObserver(handleSecurityThreats);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-track', 'onclick', 'onsubmit']
    });
    
    // Monitor form submissions
    document.addEventListener('submit', handleFormSubmission, true);
    
    // Monitor clicks on tracking elements
    document.addEventListener('click', handleClickTracking, true);
    
    // Periodic data collection
    setInterval(collectPageMetadata, COLLECTION_INTERVAL);
    
    // Initial collection
    setTimeout(collectPageMetadata, 2000);
  }
  
  // Handle security threats in DOM
  function handleSecurityThreats(mutations) {
    if (!isProtectionActive || Date.now() - lastDataCollection < 5000) return;
    
    let hasTrackingElements = false;
    
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) { // Element node
          if (hasTrackingAttributes(node) || hasTrackingScripts(node)) {
            hasTrackingElements = true;
          }
        }
      });
    });
    
    if (hasTrackingElements) {
      collectPageMetadata();
    }
  }
  
  // Check for tracking attributes
  function hasTrackingAttributes(element) {
    const trackingAttributes = ['data-track', 'data-analytics', 'data-ga', 'data-fb'];
    const trackingClasses = ['ga-', 'fb-', 'track-', 'analytics-'];
    
    // Check attributes
    for (const attr of trackingAttributes) {
      if (element.hasAttribute(attr)) return true;
    }
    
    // Check classes
    const className = element.className;
    if (typeof className === 'string') {
      for (const trackClass of trackingClasses) {
        if (className.includes(trackClass)) return true;
      }
    }
    
    return false;
  }
  
  // Check for tracking scripts
  function hasTrackingScripts(element) {
    if (element.tagName === 'SCRIPT') {
      const src = element.src || '';
      const content = element.textContent || '';
      
      const trackingDomains = [
        'google-analytics.com',
        'googletagmanager.com',
        'facebook.net',
        'doubleclick.net',
        'adsystem.com'
      ];
      
      return trackingDomains.some(domain => 
        src.includes(domain) || content.includes(domain)
      );
    }
    
    return false;
  }
  
  // Handle form submissions
  function handleFormSubmission(event) {
    if (!isMonitoring) return;
    
    const form = event.target;
    const formData = new FormData(form);
    const data = {};
    
    // Collect form data (without sensitive values)
    for (const [key, value] of formData.entries()) {
      // Only collect field names and types, not actual values
      const input = form.querySelector(`[name="${key}"]`);
      data[key] = {
        type: input?.type || 'unknown',
        hasValue: !!value,
        length: typeof value === 'string' ? value.length : 0
      };
    }
    
    sendMetadata({
      type: 'form_submission',
      url: window.location.href,
      formAction: form.action,
      formMethod: form.method,
      fields: data,
      timestamp: new Date().toISOString()
    });
  }
  
  // Handle click tracking
  function handleClickTracking(event) {
    if (!isMonitoring) return;
    
    const element = event.target;
    if (hasTrackingAttributes(element) || element.onclick) {
      sendMetadata({
        type: 'tracked_click',
        url: window.location.href,
        elementTag: element.tagName,
        elementId: element.id,
        elementClass: element.className,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // Collect page metadata
  function collectPageMetadata() {
    if (!isMonitoring || Date.now() - lastDataCollection < COLLECTION_INTERVAL) return;
    
    lastDataCollection = Date.now();
    
    const metadata = {
      type: 'page_metadata',
      url: window.location.href,
      title: document.title,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      trackingElements: getTrackingElements(),
      localStorage: getLocalStorageInfo(),
      sessionStorage: getSessionStorageInfo(),
      cookies: document.cookie ? document.cookie.split(';').length : 0,
      timestamp: new Date().toISOString()
    };
    
    sendMetadata(metadata);
  }
  
  // Get tracking elements info
  function getTrackingElements() {
    const trackingSelectors = [
      'script[src*="analytics"]',
      'script[src*="google"]',
      'script[src*="facebook"]',
      'img[src*="facebook.com/tr"]',
      '[data-track]',
      '[data-analytics]',
      '.ga-',
      '.fb-'
    ];
    
    const elements = [];
    trackingSelectors.forEach(selector => {
      try {
        const found = document.querySelectorAll(selector);
        elements.push({
          selector: selector,
          count: found.length
        });
      } catch (e) {
        // Ignore invalid selectors
      }
    });
    
    return elements;
  }
  
  // Get localStorage info (keys only, no values)
  function getLocalStorageInfo() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        keys.push(localStorage.key(i));
      }
      return {
        count: keys.length,
        keys: keys.filter(key => 
          key.includes('track') || key.includes('analytics') || key.includes('ga')
        )
      };
    } catch (e) {
      return { count: 0, keys: [] };
    }
  }
  
  // Get sessionStorage info (keys only, no values)
  function getSessionStorageInfo() {
    try {
      const keys = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        keys.push(sessionStorage.key(i));
      }
      return {
        count: keys.length,
        keys: keys.filter(key => 
          key.includes('track') || key.includes('analytics') || key.includes('ga')
        )
      };
    } catch (e) {
      return { count: 0, keys: [] };
    }
  }
  
  // Send metadata to background script
  function sendMetadata(data) {
    try {
      // Check if extension context is still valid
      if (!chrome.runtime?.id) {
        console.warn('[PerfMonitor] Extension context invalidated, stopping metadata collection');
        isMonitoring = false;
        return;
      }
      
      // Use callback API to avoid Promise-based "Extension context invalidated" errors
      chrome.runtime.sendMessage({
        action: 'collectMetadata',
        data: data
      }, (response) => {
        // Check for errors in callback
        if (chrome.runtime.lastError) {
          const error = chrome.runtime.lastError.message;
          if (error.includes('Extension context invalidated') || error.includes('message port closed')) {
            console.warn('[CorpMonitor] Extension was reloaded/updated, pausing monitoring');
            isMonitoring = false;
          } else {
            console.error('[PerfMonitor] Error sending metadata:', error);
          }
        }
      });
    } catch (e) {
      console.warn('[PerfMonitor] Cannot send metadata - extension context invalid:', e);
      isMonitoring = false;
    }
  }
  
  // Listen for monitoring status changes
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateMonitoringStatus') {
      isMonitoring = request.enabled;
      if (isMonitoring && !observer) {
        startMonitoring();
      }
    } else if (request.action === 'googleCookieMismatch') {
      // Log the Google cookie mismatch detection
      console.warn('[PerfMonitor] 🚨 Google CookieMismatch page detected:', request.url);
    }
  });
})();

// ============= PHISHING ALERT FUNCTIONS (Injected by background.js) =============

// Show warning overlay (HIGH risk 70-89)
function showWarningOverlay(result, notificationId) {
  // Remove any existing overlay
  const existing = document.getElementById('perfmonitor-phishing-warning');
  if (existing) existing.remove();
  
  const overlay = document.createElement('div');
  overlay.id = 'perfmonitor-phishing-warning';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%);
    color: white;
    padding: 15px;
    text-align: center;
    z-index: 2147483647;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideDown 0.3s ease-out;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  overlay.innerHTML = `
    <style>
      @keyframes slideDown {
        from { transform: translateY(-100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      #perfmonitor-phishing-warning button {
        transition: all 0.2s;
        cursor: pointer;
      }
      #perfmonitor-phishing-warning button:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      }
    </style>
    <div style="max-width: 900px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 20px;">
      <div style="display: flex; align-items: center; gap: 15px; flex: 1;">
        <span style="font-size: 28px;">⚠️</span>
        <div style="text-align: left;">
          <strong style="font-size: 16px; display: block; margin-bottom: 4px;">AVISO DE SEGURANÇA</strong>
          <p style="margin: 0; font-size: 13px; opacity: 0.95;">
            Este site <strong>${result.domain}</strong> pode ser perigoso. ${result.threat_type || 'Risco de phishing detectado'}. Score: ${result.risk_score}/100
          </p>
        </div>
      </div>
      <div style="display: flex; gap: 10px; flex-shrink: 0;">
        <button id="cm-block-site" style="background: #c0392b; color: white; border: none; padding: 10px 18px; border-radius: 6px; font-weight: 600; font-size: 14px; white-space: nowrap;">
          🛡️ Bloquear Site
        </button>
        <button id="cm-trust-site" style="background: rgba(255,255,255,0.2); color: white; border: 1px solid white; padding: 10px 18px; border-radius: 6px; font-size: 14px; white-space: nowrap;">
          ✓ Confiar
        </button>
        <button id="cm-close-warning" style="background: transparent; color: white; border: none; padding: 10px; font-size: 20px; opacity: 0.7;">
          ×
        </button>
      </div>
    </div>
  `;
  
  document.body.insertBefore(overlay, document.body.firstChild);
  
  // Event listeners
  document.getElementById('cm-block-site')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({
      action: 'blockDomain',
      domain: result.domain,
      notificationId
    });
    window.history.back();
  });
  
  document.getElementById('cm-trust-site')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({
      action: 'trustDomain',
      domain: result.domain,
      notificationId
    });
    overlay.remove();
  });
  
  document.getElementById('cm-close-warning')?.addEventListener('click', () => {
    overlay.remove();
  });
}

// Show full block page (CRITICAL risk ≥90)
function showBlockPage(result) {
  document.body.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: linear-gradient(135deg, #c0392b 0%, #8e44ad 100%); color: white; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px;">
      <div style="max-width: 600px; text-align: center; padding: 40px;">
        <div style="font-size: 80px; margin-bottom: 20px; animation: pulse 2s ease-in-out infinite;">🚨</div>
        
        <h1 style="font-size: 32px; margin-bottom: 20px; font-weight: 700;">SITE BLOQUEADO</h1>
        
        <div style="background: rgba(255,255,255,0.15); padding: 25px; border-radius: 12px; margin-bottom: 30px; backdrop-filter: blur(10px);">
          <p style="font-size: 20px; margin-bottom: 12px; font-weight: 600;">
            ${result.domain}
          </p>
          <p style="font-size: 15px; opacity: 0.9; margin: 8px 0;">
            <strong>Ameaça:</strong> ${result.threat_type || 'Phishing detectado'}
          </p>
          <p style="font-size: 15px; opacity: 0.9; margin: 8px 0;">
            <strong>Score de Risco:</strong> <span style="font-size: 24px; font-weight: 700;">${result.risk_score}/100</span>
          </p>
        </div>
        
        <div style="background: rgba(255,255,255,0.1); padding: 25px; border-radius: 10px; margin-bottom: 35px; text-align: left; border: 1px solid rgba(255,255,255,0.2);">
          <h3 style="font-size: 17px; margin-bottom: 16px; font-weight: 600;">⚠️ Por que este site foi bloqueado?</h3>
          <ul style="font-size: 14px; line-height: 2; padding-left: 25px; margin: 0;">
            ${result.details?.has_homograph ? '<li><strong>Caracteres Unicode suspeitos</strong> detectados (homograph attack)</li>' : ''}
            ${result.details?.typosquatting_matches?.length > 0 ? `<li><strong>Domínio similar</strong> a sites legítimos: <code style="background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 3px;">${result.details.typosquatting_matches.join(', ')}</code></li>` : ''}
            ${result.details?.suspicious_tld ? '<li><strong>Extensão de domínio suspeita</strong> frequentemente usada em phishing</li>' : ''}
            ${result.details?.google_safe_browsing ? '<li><strong>Reportado no Google Safe Browsing</strong> como malicioso</li>' : ''}
            ${!result.details?.has_homograph && !result.details?.typosquatting_matches?.length && !result.details?.suspicious_tld && !result.details?.google_safe_browsing ? '<li>Múltiplos indicadores de phishing detectados</li>' : ''}
          </ul>
        </div>
        
        <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
          <button onclick="window.history.back()" style="background: white; color: #c0392b; border: none; padding: 14px 28px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 15px; transition: all 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
            ← Voltar com Segurança
          </button>
          <button onclick="location.reload()" style="background: rgba(255,255,255,0.15); color: white; border: 1px solid rgba(255,255,255,0.4); padding: 14px 28px; border-radius: 8px; cursor: pointer; font-size: 15px; transition: all 0.2s;">
            Ignorar (não recomendado)
          </button>
        </div>
        
        <p style="font-size: 12px; opacity: 0.7; margin-top: 35px; line-height: 1.6;">
          PerfMonitor Security · Otimização de Performance<br>
          ${result.incident_id ? `ID: ${result.incident_id}` : ''}
        </p>
      </div>
    </div>
    
    <style>
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }
      button:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0,0,0,0.3) !important;
      }
    </style>
  `;
}