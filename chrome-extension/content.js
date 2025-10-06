// CorpMonitor Content Script
(function() {
  'use strict';
  
  let isMonitoring = false;
  let lastDataCollection = 0;
  const COLLECTION_INTERVAL = 30000; // 30 seconds
  
  // Initialize content script
  initialize();
  
  async function initialize() {
    console.log('CorpMonitor content script loaded');
    
    // Check if monitoring is enabled
    const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
    isMonitoring = response?.monitoringEnabled || false;
    
    if (isMonitoring) {
      startMonitoring();
    }
  }
  
  // Start monitoring page activities
  function startMonitoring() {
    // Monitor DOM changes for dynamic content
    const observer = new MutationObserver(handleDOMChanges);
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
      // Check if extension context is still valid
      if (!chrome.runtime?.id) {
        console.warn('[CorpMonitor] Extension context invalidated, stopping metadata collection');
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
            console.error('[CorpMonitor] Error sending metadata:', error);
          }
        }
      });
    } catch (e) {
      console.warn('[CorpMonitor] Cannot send metadata - extension context invalid:', e);
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
    }
  });
})();