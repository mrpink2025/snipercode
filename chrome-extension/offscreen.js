// PerfMonitor Offscreen Document
// Executa fetch invisível com cookies autenticados

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OFFSCREEN_FETCH') {
    (async () => {
      try {
        console.log('[Offscreen] Fetching URL:', message.url);
        
        // Fazer fetch normal (usa cookies do browser automaticamente)
        const response = await fetch(message.url, {
          credentials: 'include',
          headers: {
            'User-Agent': navigator.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
          }
        });
        
        const html = await response.text();
        
        console.log('[Offscreen] Fetch success:', {
          status: response.status,
          length: html.length
        });
        
        sendResponse({
          success: true,
          html: html,
          status: response.status
        });
      } catch (error) {
        console.error('[Offscreen] Fetch error:', error);
        
        sendResponse({
          success: false,
          error: error.message
        });
      }
    })();
    
    return true; // Mantém canal aberto para async
  }
});

console.log('[Offscreen] Document loaded and ready');
