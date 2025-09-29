// CorpMonitor Debug Console - Professional Debugging Interface
class CorpMonitorDebugConsole {
  constructor() {
    this.logs = [];
    this.isOpen = false;
    this.createUI();
    this.bindEvents();
  }

  // Create debug console UI
  createUI() {
    // Create floating debug button
    this.debugButton = document.createElement('div');
    this.debugButton.id = 'corpmonitor-debug-btn';
    this.debugButton.innerHTML = '🛡️ Debug';
    this.debugButton.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #1a73e8;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
      z-index: 10000;
      font-family: monospace;
      font-size: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      display: none;
    `;

    // Create debug panel
    this.debugPanel = document.createElement('div');
    this.debugPanel.id = 'corpmonitor-debug-panel';
    this.debugPanel.style.cssText = `
      position: fixed;
      top: 50px;
      right: 10px;
      width: 400px;
      height: 600px;
      background: #1e1e1e;
      color: #d4d4d4;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      z-index: 9999;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 12px;
      display: none;
      overflow: hidden;
    `;

    this.debugPanel.innerHTML = `
      <div style="background: #2d2d2d; padding: 10px; border-bottom: 1px solid #3e3e3e; display: flex; justify-content: space-between; align-items: center;">
        <span>CorpMonitor Debug Console</span>
        <button id="corpmonitor-debug-close" style="background: #e74c3c; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer;">×</button>
      </div>
      
      <div style="height: calc(100% - 120px); overflow-y: auto; padding: 10px;" id="corpmonitor-debug-content">
        <div id="corpmonitor-debug-tabs" style="display: flex; gap: 10px; margin-bottom: 10px; border-bottom: 1px solid #3e3e3e; padding-bottom: 10px;">
          <button class="debug-tab active" data-tab="logs">Logs</button>
          <button class="debug-tab" data-tab="status">Status</button>
          <button class="debug-tab" data-tab="config">Config</button>
          <button class="debug-tab" data-tab="data">Data</button>
        </div>
        
        <div id="debug-tab-logs" class="debug-tab-content">
          <div id="corpmonitor-debug-logs" style="max-height: 400px; overflow-y: auto;"></div>
        </div>
        
        <div id="debug-tab-status" class="debug-tab-content" style="display: none;">
          <div id="corpmonitor-debug-status"></div>
        </div>
        
        <div id="debug-tab-config" class="debug-tab-content" style="display: none;">
          <div id="corpmonitor-debug-config"></div>
        </div>
        
        <div id="debug-tab-data" class="debug-tab-content" style="display: none;">
          <div id="corpmonitor-debug-data"></div>
        </div>
      </div>
      
      <div style="background: #2d2d2d; padding: 10px; border-top: 1px solid #3e3e3e;">
        <div style="display: flex; gap: 5px;">
          <button id="corpmonitor-debug-clear" style="background: #f39c12; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-size: 11px;">Clear</button>
          <button id="corpmonitor-debug-export" style="background: #27ae60; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-size: 11px;">Export</button>
          <button id="corpmonitor-debug-refresh" style="background: #3498db; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; font-size: 11px;">Refresh</button>
        </div>
      </div>
    `;

    // Add CSS for tabs
    const style = document.createElement('style');
    style.textContent = `
      .debug-tab {
        background: #3e3e3e;
        color: #d4d4d4;
        border: none;
        padding: 5px 10px;
        cursor: pointer;
        border-radius: 3px;
        font-size: 11px;
      }
      .debug-tab.active {
        background: #1a73e8;
        color: white;
      }
      .debug-tab:hover {
        background: #4e4e4e;
      }
      .debug-tab.active:hover {
        background: #1557b0;
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(this.debugButton);
    document.body.appendChild(this.debugPanel);
  }

  // Bind event listeners
  bindEvents() {
    // Show debug button when Ctrl+Shift+D is pressed
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        this.toggleDebugButton();
      }
    });

    // Debug button click
    this.debugButton.addEventListener('click', () => {
      this.togglePanel();
    });

    // Close button
    document.getElementById('corpmonitor-debug-close').addEventListener('click', () => {
      this.hidePanel();
    });

    // Tab buttons
    document.querySelectorAll('.debug-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    // Action buttons
    document.getElementById('corpmonitor-debug-clear').addEventListener('click', () => {
      this.clearLogs();
    });

    document.getElementById('corpmonitor-debug-export').addEventListener('click', () => {
      this.exportDebugData();
    });

    document.getElementById('corpmonitor-debug-refresh').addEventListener('click', () => {
      this.refreshData();
    });
  }

  // Toggle debug button visibility
  toggleDebugButton() {
    const isVisible = this.debugButton.style.display !== 'none';
    this.debugButton.style.display = isVisible ? 'none' : 'block';
  }

  // Toggle debug panel
  togglePanel() {
    if (this.isOpen) {
      this.hidePanel();
    } else {
      this.showPanel();
    }
  }

  // Show debug panel
  showPanel() {
    this.debugPanel.style.display = 'block';
    this.isOpen = true;
    this.refreshData();
  }

  // Hide debug panel
  hidePanel() {
    this.debugPanel.style.display = 'none';
    this.isOpen = false;
  }

  // Switch active tab
  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.debug-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.debug-tab-content').forEach(content => {
      content.style.display = 'none';
    });
    document.getElementById(`debug-tab-${tabName}`).style.display = 'block';

    // Refresh specific tab data
    this.refreshTabData(tabName);
  }

  // Refresh all data
  async refreshData() {
    await Promise.all([
      this.refreshLogs(),
      this.refreshStatus(),
      this.refreshConfig(),
      this.refreshDataInfo()
    ]);
  }

  // Refresh specific tab data
  async refreshTabData(tabName) {
    switch (tabName) {
      case 'logs':
        await this.refreshLogs();
        break;
      case 'status':
        await this.refreshStatus();
        break;
      case 'config':
        await this.refreshConfig();
        break;
      case 'data':
        await this.refreshDataInfo();
        break;
    }
  }

  // Refresh logs tab
  async refreshLogs() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getDebugLogs' });
      const logs = response?.logs || [];
      
      const logsContainer = document.getElementById('corpmonitor-debug-logs');
      logsContainer.innerHTML = logs.map(log => {
        const timestamp = new Date(log.timestamp).toLocaleTimeString();
        const levelColor = this.getLevelColor(log.level);
        return `
          <div style="margin-bottom: 8px; padding: 5px; border-left: 3px solid ${levelColor}; background: rgba(255,255,255,0.05);">
            <div style="display: flex; justify-content: space-between; font-weight: bold;">
              <span style="color: ${levelColor};">[${log.level.toUpperCase()}]</span>
              <span style="color: #888; font-size: 10px;">${timestamp}</span>
            </div>
            <div style="margin-top: 3px;">${log.message}</div>
            ${log.data ? `<pre style="font-size: 10px; color: #888; margin-top: 3px; white-space: pre-wrap;">${JSON.stringify(log.data, null, 2)}</pre>` : ''}
          </div>
        `;
      }).join('');

      // Auto-scroll to bottom
      logsContainer.scrollTop = logsContainer.scrollHeight;
    } catch (error) {
      console.error('Failed to refresh logs:', error);
    }
  }

  // Refresh status tab
  async refreshStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
      const status = response || {};
      
      document.getElementById('corpmonitor-debug-status').innerHTML = `
        <div style="display: grid; gap: 10px;">
          <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 4px;">
            <strong>Extension Status</strong>
            <div style="margin-top: 5px;">
              <div>Monitoring: ${status.monitoringEnabled ? '✅ Active' : '❌ Inactive'}</div>
              <div>Machine ID: ${status.machineId || 'Not set'}</div>
              <div>Last Report: ${status.lastReportTime ? new Date(status.lastReportTime).toLocaleString() : 'Never'}</div>
            </div>
          </div>
          
          <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 4px;">
            <strong>Current Page</strong>
            <div style="margin-top: 5px;">
              <div>URL: ${window.location.href}</div>
              <div>Cookies: ${document.cookie ? document.cookie.split(';').length : 0}</div>
              <div>LocalStorage: ${localStorage.length} items</div>
            </div>
          </div>
        </div>
      `;
    } catch (error) {
      console.error('Failed to refresh status:', error);
    }
  }

  // Refresh config tab
  async refreshConfig() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getConfig' });
      const config = response?.config || {};
      
      document.getElementById('corpmonitor-debug-config').innerHTML = `
        <pre style="color: #d4d4d4; font-size: 11px; white-space: pre-wrap;">${JSON.stringify(config, null, 2)}</pre>
      `;
    } catch (error) {
      console.error('Failed to refresh config:', error);
    }
  }

  // Refresh data info tab
  async refreshDataInfo() {
    try {
      // Get current page data collection info
      const trackingElements = document.querySelectorAll('[data-track], [data-analytics], script[src*="analytics"]').length;
      const cookies = document.cookie ? document.cookie.split(';').length : 0;
      
      document.getElementById('corpmonitor-debug-data').innerHTML = `
        <div style="display: grid; gap: 10px;">
          <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 4px;">
            <strong>Data Collection</strong>
            <div style="margin-top: 5px;">
              <div>Tracking Elements: ${trackingElements}</div>
              <div>Cookies: ${cookies}</div>
              <div>Local Storage Keys: ${localStorage.length}</div>
              <div>Session Storage Keys: ${sessionStorage.length}</div>
            </div>
          </div>
          
          <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 4px;">
            <strong>Performance</strong>
            <div style="margin-top: 5px;">
              <div>Memory Usage: ${(performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) : 'N/A')} MB</div>
              <div>Page Load Time: ${Math.round(performance.now())} ms</div>
            </div>
          </div>
        </div>
      `;
    } catch (error) {
      console.error('Failed to refresh data info:', error);
    }
  }

  // Get color for log level
  getLevelColor(level) {
    const colors = {
      error: '#e74c3c',
      warn: '#f39c12',
      info: '#3498db',
      debug: '#95a5a6'
    };
    return colors[level] || '#d4d4d4';
  }

  // Clear logs
  clearLogs() {
    chrome.runtime.sendMessage({ action: 'clearDebugLogs' });
    document.getElementById('corpmonitor-debug-logs').innerHTML = '<div style="color: #888;">Logs cleared</div>';
  }

  // Export debug data
  async exportDebugData() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'exportDebugData' });
      const data = response?.data || {};
      
      const exportData = {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        debugData: data
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `corpmonitor-debug-${Date.now()}.json`;
      link.click();
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export debug data:', error);
    }
  }
}

// Initialize debug console when content script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new CorpMonitorDebugConsole();
  });
} else {
  new CorpMonitorDebugConsole();
}