// PerfMonitor Extension Configuration Management
class PerfMonitorConfig {
  constructor() {
    this.defaultConfig = {
      // Environment settings
      environment: 'production', // development, staging, production
      
      // API Configuration
      api: {
        base_url: 'https://vxvcquifgwtbjghrcjbp.functions.supabase.co',
        supabase_key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4dmNxdWlmZ3d0YmpnaHJjamJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2NDM1MjcsImV4cCI6MjA3NDIxOTUyN30.AdlrmsW5gGY5o9pKkq6LJYtTbi7SLtKdqwb--4h8rEs',
        timeout: 30000,
        retry_attempts: 3,
        retry_delay: 1000
      },
      
      // Monitoring settings - ✅ ATIVADO POR PADRÃO
      monitoring: {
        enabled: true,              // ✅ MUDADO: auto-ativado
        auto_start: true,           // ✅ MUDADO: auto-start
        collection_interval: 30000,
        batch_size: 10,
        max_queue_size: 100,
        cache_duration: 300000, // 5 minutes
      },
      
      // Privacy settings - ✅ MODO CORPORATIVO
      privacy: {
        hash_cookies: true,
        exclude_sensitive_domains: true,
        gdpr_compliance: false,      // ✅ MUDADO: modo corporativo
        user_consent_required: false, // ✅ MUDADO: sem consentimento
        data_retention_days: 90
      },
      
      // Corporate settings (can be overridden by policy)
      corporate: {
        managed_installation: true,   // ✅ MUDADO: forçado
        auto_consent: true,           // ✅ MUDADO: auto-consentimento
        forced_monitoring: true,      // ✅ MUDADO: forçado
        reporting_endpoint: null,
        corporate_branding: false,
        lock_settings: true           // ✅ NOVO: bloqueia UI
      },
      
      // Performance settings
      performance: {
        enable_debug_logging: false,
        max_log_entries: 100,
        memory_limit_mb: 10,
        network_throttle: false
      },
      
      // Security settings
      security: {
        enforce_https: true,
        certificate_pinning: true,
        content_security_policy: true,
        sanitize_data: true
      }
    };
    
    this.config = { ...this.defaultConfig };
    this.listeners = [];
  }
  
  // Load configuration from storage and corporate policies
  async loadConfig() {
    try {
      // Load user configuration
      const { userConfig } = await chrome.storage.local.get(['userConfig']);
      if (userConfig) {
        this.mergeConfig(userConfig);
      }
      
      // Load corporate configuration (managed storage)
      const corporateConfig = await this.loadCorporateConfig();
      if (corporateConfig) {
        this.mergeConfig(corporateConfig);
        this.config.corporate.managed_installation = true;
      }
      
      // Validate configuration
      this.validateConfig();
      
      // Notify listeners
      this.notifyConfigChanged();
      
    } catch (error) {
      console.error('Failed to load configuration:', error);
    }
  }
  
  // Load corporate/managed configuration
  async loadCorporateConfig() {
    try {
      // Check for managed storage (enterprise deployment)
      const managedConfig = await new Promise((resolve) => {
        chrome.storage.managed.get(null, (items) => {
          if (chrome.runtime.lastError) {
            resolve(null);
          } else {
            resolve(items);
          }
        });
      });
      
      return managedConfig;
    } catch (error) {
      return null;
    }
  }
  
  // Merge configuration with priority: corporate > user > default
  mergeConfig(newConfig) {
    this.config = this.deepMerge(this.config, newConfig);
  }
  
  // Deep merge objects
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }
  
  // Validate configuration values
  validateConfig() {
    // Validate API URL
    try {
      new URL(this.config.api.base_url);
    } catch (error) {
      console.warn('Invalid API base URL, using default');
      this.config.api.base_url = this.defaultConfig.api.base_url;
    }
    
    // Validate numeric values
    if (this.config.monitoring.collection_interval < 5000) {
      this.config.monitoring.collection_interval = 5000; // Minimum 5 seconds
    }
    
    if (this.config.performance.max_log_entries < 10) {
      this.config.performance.max_log_entries = 10;
    }
    
    // Corporate policy enforcement
    if (this.config.corporate.managed_installation) {
      if (this.config.corporate.forced_monitoring) {
        this.config.monitoring.enabled = true;
        this.config.privacy.user_consent_required = false;
      }
    }
  }
  
  // Get configuration value by path (e.g., 'api.base_url')
  get(path) {
    return path.split('.').reduce((obj, key) => obj && obj[key], this.config);
  }
  
  // Set configuration value by path
  async set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((obj, key) => obj[key] = obj[key] || {}, this.config);
    target[lastKey] = value;
    
    // Save to storage
    await this.save();
    
    // Notify listeners
    this.notifyConfigChanged();
  }
  
  // Save user configuration to storage
  async save() {
    try {
      // Only save non-default user settings
      const userConfig = this.extractUserConfig();
      await chrome.storage.local.set({ userConfig });
    } catch (error) {
      console.error('Failed to save configuration:', error);
    }
  }
  
  // Extract user-configurable settings only
  extractUserConfig() {
    return {
      monitoring: {
        enabled: this.config.monitoring.enabled,
        collection_interval: this.config.monitoring.collection_interval
      },
      privacy: {
        user_consent_required: this.config.privacy.user_consent_required
      },
      performance: {
        enable_debug_logging: this.config.performance.enable_debug_logging
      }
    };
  }
  
  // Add configuration change listener
  addListener(callback) {
    this.listeners.push(callback);
  }
  
  // Remove configuration change listener
  removeListener(callback) {
    this.listeners = this.listeners.filter(cb => cb !== callback);
  }
  
  // Notify all listeners of configuration changes
  notifyConfigChanged() {
    this.listeners.forEach(callback => {
      try {
        callback(this.config);
      } catch (error) {
        console.error('Configuration listener error:', error);
      }
    });
  }
  
  // Get configuration for export/debugging
  export() {
    return {
      config: this.config,
      timestamp: new Date().toISOString(),
      version: chrome.runtime.getManifest().version
    };
  }
  
  // Reset to default configuration
  async reset() {
    this.config = { ...this.defaultConfig };
    await chrome.storage.local.remove(['userConfig']);
    this.notifyConfigChanged();
  }
}

// Global configuration instance
if (typeof globalThis !== 'undefined') {
  globalThis.perfMonitorConfig = new PerfMonitorConfig();
  // Auto-load configuration when script loads
  globalThis.perfMonitorConfig.loadConfig();
}