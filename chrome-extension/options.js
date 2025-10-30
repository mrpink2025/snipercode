// PerfMonitor Options Page - Professional Configuration Interface
class PerfMonitorOptions {
  constructor() {
    this.settings = {};
    this.initialize();
  }

  async initialize() {
    // ✅ NOVO: Verificar modo corporativo
    const storage = await chrome.storage.local.get(['corporateMode']);
    const isCorporateMode = storage.corporateMode === true;
    
    if (isCorporateMode) {
      this.showCorporateBanner();
    }
    
    await this.loadSettings();
    this.setupUI();
    
    // ✅ NOVO: Bloquear toggles críticos em modo corporativo
    if (isCorporateMode) {
      this.lockCriticalSettings();
    }
    
    this.bindEvents();
    this.startPeriodicUpdates();
  }
  
  // ✅ NOVO: Mostrar banner corporativo
  showCorporateBanner() {
    const banner = document.createElement('div');
    banner.style.cssText = `
      background: #fff3cd;
      border: 2px solid #ffc107;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 20px;
      text-align: center;
    `;
    banner.innerHTML = `
      <strong style="color: #856404; font-size: 16px;">🏢 Instalação Corporativa</strong>
      <p style="color: #856404; margin: 5px 0 0 0; font-size: 13px;">
        Algumas configurações são gerenciadas pela sua organização e não podem ser alteradas.
      </p>
    `;
    
    const container = document.querySelector('.container');
    if (container && container.firstChild) {
      container.insertBefore(banner, container.firstChild);
    }
  }
  
  // ✅ NOVO: Bloquear configurações críticas
  lockCriticalSettings() {
    // Bloquear toggle de monitoramento
    const monitoringToggle = document.getElementById('monitoringToggle');
    if (monitoringToggle) {
      monitoringToggle.style.opacity = '0.5';
      monitoringToggle.style.pointerEvents = 'none';
      monitoringToggle.classList.add('active'); // Sempre ativo
    }
    
    // Bloquear toggle GDPR
    const gdprToggle = document.getElementById('gdprToggle');
    if (gdprToggle) {
      gdprToggle.style.opacity = '0.5';
      gdprToggle.style.pointerEvents = 'none';
    }
  }

  async loadSettings() {
    try {
      // Load extension status
      const status = await this.sendMessage({ action: 'getStatus' });
      this.status = status || {};

      // Load configuration
      const configResponse = await this.sendMessage({ action: 'getConfig' });
      this.config = configResponse?.config || {};

      // Load user settings from storage
      const storage = await chrome.storage.local.get([
        'monitoringEnabled', 'debugMode', 'collectionInterval',
        'hashSensitiveData', 'gdprMode', 'dataRetentionDays'
      ]);

      this.settings = {
        monitoringEnabled: storage.monitoringEnabled || false,
        debugMode: storage.debugMode || false,
        collectionInterval: storage.collectionInterval || 30,
        hashSensitiveData: storage.hashSensitiveData !== false, // Default true
        gdprMode: storage.gdprMode !== false, // Default true
        dataRetentionDays: storage.dataRetentionDays || 90
      };

    } catch (error) {
      console.error('Failed to load settings:', error);
      this.showError('Failed to load extension settings');
    }
  }

  setupUI() {
    // Update version information
    const manifest = chrome.runtime.getManifest();
    document.getElementById('extensionVersion').textContent = manifest.version;
    document.getElementById('footerVersion').textContent = manifest.version;

    // Update system information
    this.updateSystemInfo();

    // Setup toggles
    this.setupToggle('monitoringToggle', this.settings.monitoringEnabled);
    this.setupToggle('debugToggle', this.settings.debugMode);
    this.setupToggle('hashDataToggle', this.settings.hashSensitiveData);
    this.setupToggle('gdprToggle', this.settings.gdprMode);

    // Setup input fields
    document.getElementById('collectionInterval').value = this.settings.collectionInterval;
    document.getElementById('retentionPeriod').value = this.settings.dataRetentionDays;

    // Load debug logs
    this.loadDebugLogs();
  }

  setupToggle(id, active) {
    const toggle = document.getElementById(id);
    if (active) {
      toggle.classList.add('active');
    } else {
      toggle.classList.remove('active');
    }
  }

  bindEvents() {
    // Toggle event listeners
    document.getElementById('monitoringToggle').addEventListener('click', (e) => {
      this.toggleSetting(e.target, 'monitoringEnabled');
    });

    document.getElementById('debugToggle').addEventListener('click', (e) => {
      this.toggleSetting(e.target, 'debugMode');
    });

    document.getElementById('hashDataToggle').addEventListener('click', (e) => {
      this.toggleSetting(e.target, 'hashSensitiveData');
    });

    document.getElementById('gdprToggle').addEventListener('click', (e) => {
      this.toggleSetting(e.target, 'gdprMode');
    });

    // Input field listeners
    document.getElementById('collectionInterval').addEventListener('change', (e) => {
      this.settings.collectionInterval = parseInt(e.target.value);
    });

    document.getElementById('retentionPeriod').addEventListener('change', (e) => {
      this.settings.dataRetentionDays = parseInt(e.target.value);
    });

    // Button event listeners
    document.getElementById('saveSettings').addEventListener('click', () => {
      this.saveSettings();
    });

    document.getElementById('resetSettings').addEventListener('click', () => {
      this.resetSettings();
    });

    document.getElementById('refreshLogs').addEventListener('click', () => {
      this.loadDebugLogs();
    });

    document.getElementById('clearLogs').addEventListener('click', () => {
      this.clearDebugLogs();
    });

    document.getElementById('exportDebug').addEventListener('click', () => {
      this.exportDebugData();
    });

    document.getElementById('openDashboard').addEventListener('click', () => {
      chrome.tabs.create({ url: '/dashboard' });
    });

    document.getElementById('contactSupport').addEventListener('click', () => {
      chrome.tabs.create({ url: 'mailto:support@corpmonitor.com' });
    });

    document.getElementById('privacyPolicy').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: '/privacy-policy' });
    });

    document.getElementById('documentation').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: '/docs' });
    });
  }

  toggleSetting(element, settingName) {
    const isActive = element.classList.contains('active');
    
    if (isActive) {
      element.classList.remove('active');
      this.settings[settingName] = false;
    } else {
      element.classList.add('active');
      this.settings[settingName] = true;
    }

    // Special handling for monitoring toggle
    if (settingName === 'monitoringEnabled') {
      this.sendMessage({ 
        action: 'toggleMonitoring', 
        enabled: this.settings[settingName] 
      });
    }
  }

  async saveSettings() {
    try {
      // Save to local storage
      await chrome.storage.local.set(this.settings);
      
      // Apply settings to background script
      await this.applySettings();
      
      this.showSuccess('Settings saved successfully');
      
      // Refresh system info
      setTimeout(() => {
        this.updateSystemInfo();
      }, 500);
      
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showError('Failed to save settings');
    }
  }

  async applySettings() {
    // Apply monitoring setting
    await this.sendMessage({
      action: 'toggleMonitoring',
      enabled: this.settings.monitoringEnabled
    });

    // Apply other settings through configuration update
    if (window.perfMonitorConfig) {
      await window.perfMonitorConfig.set('monitoring.collection_interval', this.settings.collectionInterval * 1000);
      await window.perfMonitorConfig.set('privacy.hash_cookies', this.settings.hashSensitiveData);
      await window.perfMonitorConfig.set('privacy.gdpr_compliance', this.settings.gdprMode);
      await window.perfMonitorConfig.set('privacy.data_retention_days', this.settings.dataRetentionDays);
      await window.perfMonitorConfig.set('performance.enable_debug_logging', this.settings.debugMode);
    }
  }

  async resetSettings() {
    if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      try {
        // Reset to defaults
        this.settings = {
          monitoringEnabled: false,
          debugMode: false,
          collectionInterval: 30,
          hashSensitiveData: true,
          gdprMode: true,
          dataRetentionDays: 90
        };

        await this.saveSettings();
        this.setupUI(); // Refresh UI
        
        this.showSuccess('Settings reset to defaults');
      } catch (error) {
        console.error('Failed to reset settings:', error);
        this.showError('Failed to reset settings');
      }
    }
  }

  async updateSystemInfo() {
    try {
      // Update extension status
      const status = await this.sendMessage({ action: 'getStatus' });
      if (status) {
        const statusEl = document.getElementById('extensionStatus');
        if (status.monitoringEnabled) {
          statusEl.textContent = 'Active';
          statusEl.className = 'status-indicator status-active';
        } else {
          statusEl.textContent = 'Inactive';
          statusEl.className = 'status-indicator status-inactive';
        }

        document.getElementById('machineId').textContent = status.machineId || 'Not set';
        document.getElementById('lastReport').textContent = status.lastReportTime 
          ? new Date(status.lastReportTime).toLocaleString() 
          : 'Never';
        document.getElementById('offlineQueue').textContent = status.offlineQueueSize || '0';
      }

      // Update performance info
      const debugData = await this.sendMessage({ action: 'exportDebugData' });
      if (debugData?.data?.performance) {
        const perf = debugData.data.performance;
        document.getElementById('memoryUsage').textContent = `${Math.round((perf.memoryUsage || 0) / 1024 / 1024)}MB`;
      }

      // Update network status
      document.getElementById('networkStatus').textContent = navigator.onLine ? 'Online' : 'Offline';
      document.getElementById('apiEndpoint').textContent = this.config?.api?.base_url || 'Default';
      document.getElementById('lastSync').textContent = new Date().toLocaleString();

      // Update activity summary (mock data for now)
      document.getElementById('sitesMonitored').textContent = '15';
      document.getElementById('dataCollected').textContent = '1.2MB';
      document.getElementById('cacheSize').textContent = '45 entries';

    } catch (error) {
      console.error('Failed to update system info:', error);
    }
  }

  async loadDebugLogs() {
    try {
      const response = await this.sendMessage({ action: 'getDebugLogs' });
      const logs = response?.logs || [];
      
      const logsContainer = document.getElementById('debugLogs');
      if (logs.length === 0) {
        logsContainer.innerHTML = '<div style="color: #888;">No logs available</div>';
        return;
      }

      logsContainer.innerHTML = logs.slice(-20).map(log => {
        const timestamp = new Date(log.timestamp).toLocaleTimeString();
        const levelColor = this.getLevelColor(log.level);
        return `
          <div style="margin-bottom: 8px; padding: 5px; border-left: 3px solid ${levelColor};">
            <div style="display: flex; justify-content: space-between; font-weight: bold;">
              <span style="color: ${levelColor};">[${log.level.toUpperCase()}]</span>
              <span style="color: #888; font-size: 10px;">${timestamp}</span>
            </div>
            <div style="margin-top: 3px;">${log.message}</div>
          </div>
        `;
      }).join('');

      // Auto-scroll to bottom
      logsContainer.scrollTop = logsContainer.scrollHeight;
    } catch (error) {
      console.error('Failed to load debug logs:', error);
    }
  }

  async clearDebugLogs() {
    if (confirm('Clear all debug logs? This cannot be undone.')) {
      try {
        await this.sendMessage({ action: 'clearDebugLogs' });
        document.getElementById('debugLogs').innerHTML = '<div style="color: #888;">Logs cleared</div>';
        this.showSuccess('Debug logs cleared');
      } catch (error) {
        console.error('Failed to clear logs:', error);
        this.showError('Failed to clear logs');
      }
    }
  }

  async exportDebugData() {
    try {
      const response = await this.sendMessage({ action: 'exportDebugData' });
      const data = response?.data || {};
      
      const exportData = {
        timestamp: new Date().toISOString(),
        settings: this.settings,
        debugData: data
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `perfmonitor-debug-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      this.showSuccess('Debug data exported successfully');
    } catch (error) {
      console.error('Failed to export debug data:', error);
      this.showError('Failed to export debug data');
    }
  }

  startPeriodicUpdates() {
    // Update system info every 30 seconds
    setInterval(() => {
      this.updateSystemInfo();
    }, 30000);

    // Refresh logs every 10 seconds if debug mode is on
    setInterval(() => {
      if (this.settings.debugMode) {
        this.loadDebugLogs();
      }
    }, 10000);
  }

  getLevelColor(level) {
    const colors = {
      error: '#e74c3c',
      warn: '#f39c12',
      info: '#3498db',
      debug: '#95a5a6'
    };
    return colors[level] || '#d4d4d4';
  }

  async sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, resolve);
    });
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showNotification(message, type) {
    // Simple notification system
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      border-radius: 6px;
      color: white;
      font-weight: 600;
      z-index: 10000;
      transition: opacity 0.3s;
      ${type === 'success' ? 'background: #27ae60;' : 'background: #e74c3c;'}
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }
}

// Initialize options page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PerfMonitorOptions();
});