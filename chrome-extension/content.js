// CorpMonitor Content Script
(function() {
  'use strict';
  
  let isMonitoring = false;
  let lastDataCollection = 0;
  let metadataInterval = null;
  let observer = null;
  const COLLECTION_INTERVAL = 30000; // 30 seconds
  
  // Initialize content script
  initialize();
  
  async function initialize() {
    // Verificar se estamos em um contexto válido
    if (window.location.protocol === 'about:' || 
        window.location.hostname.includes('lovable') ||
        window !== window.top) {
      console.log('[CorpMonitor] Skipping initialization - invalid context');
      return;
    }
    
    console.log('CorpMonitor content script loaded');
    
    // 🚨 DETECT GOOGLE COOKIE MISMATCH
    detectGoogleCookieMismatch();
    
    // Check if monitoring is enabled
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
      isMonitoring = response?.monitoringEnabled || false;
      
      if (isMonitoring) {
        startMonitoring();
      }
    } catch (error) {
      console.debug('[CorpMonitor] Could not initialize:', error.message);
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
      console.warn('[CorpMonitor] 🚨 Google CookieMismatch detected!');
      
      // Notify background script
      chrome.runtime.sendMessage({
        action: 'googleCookieMismatch',
        url: url
      });
    }
  }
  
  // Start monitoring page activities
  function startMonitoring() {
    // Monitor DOM changes for dynamic content
    observer = new MutationObserver(handleDOMChanges);
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
    metadataInterval = setInterval(collectPageMetadata, COLLECTION_INTERVAL);
    
    // Initial collection
    setTimeout(collectPageMetadata, 2000);
  }
  
  // Stop monitoring and cleanup
  function stopMonitoring() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    
    if (metadataInterval) {
      clearInterval(metadataInterval);
      metadataInterval = null;
    }
    
    isMonitoring = false;
    console.log('[CorpMonitor] Monitoring stopped and cleaned up');
  }
  
  // Handle DOM changes
  function handleDOMChanges(mutations) {
    if (!isMonitoring || Date.now() - lastDataCollection < 5000) return;
    
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
      // Verificação robusta de contexto válido
      if (!chrome?.runtime?.id) {
        console.debug('[CorpMonitor] Context invalid, stopping monitoring');
        stopMonitoring();
        return;
      }
      
      // Adicionar timeout para evitar espera infinita
      const timeoutId = setTimeout(() => {
        console.warn('[CorpMonitor] Message timeout, context may be invalid');
        stopMonitoring();
      }, 5000);
      
      chrome.runtime.sendMessage({
        action: 'collectMetadata',
        data: data
      }, (response) => {
        clearTimeout(timeoutId);
        
        if (chrome.runtime.lastError) {
          const error = chrome.runtime.lastError.message;
          if (error.includes('Extension context invalidated') || 
              error.includes('message port closed') ||
              error.includes('Receiving end does not exist')) {
            console.debug('[CorpMonitor] Extension context lost, stopping monitoring');
            stopMonitoring();
          } else {
            console.debug('[CorpMonitor] Could not send metadata:', error);
          }
        }
      });
    } catch (error) {
      console.debug('[CorpMonitor] Send failed:', error.message);
      stopMonitoring();
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
      console.warn('[CorpMonitor] 🚨 Google CookieMismatch page detected:', request.url);
    }
  });
  
  // Cleanup listeners
  window.addEventListener('beforeunload', () => {
    stopMonitoring();
  });
  
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !chrome?.runtime?.id) {
      stopMonitoring();
    }
  });
})();