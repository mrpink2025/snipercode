// PerfMonitor Service Worker Utilities - Professional Background Services
class PerfMonitorServiceWorker {
  constructor() {
    this.initializeServices();
  }

  // Initialize all background services
  async initializeServices() {
    await this.setupAlarms();
    await this.setupNotifications();
    await this.setupPerformanceMonitoring();
    await this.setupOfflineSync();
  }

  // Setup periodic maintenance alarms
  async setupAlarms() {
    // Clear existing alarms
    chrome.alarms.clearAll();
    
    // Maintenance alarm (every 5 minutes)
    chrome.alarms.create('maintenance', { periodInMinutes: 5 });
    
    // Cleanup alarm (every hour)
    chrome.alarms.create('cleanup', { periodInMinutes: 60 });
    
    // Sync alarm (every 15 minutes)
    chrome.alarms.create('sync', { periodInMinutes: 15 });
    
    // Listen for alarm events
    chrome.alarms.onAlarm.addListener((alarm) => {
      switch (alarm.name) {
        case 'maintenance':
          this.performMaintenance();
          break;
        case 'cleanup':
          this.performCleanup();
          break;
        case 'sync':
          this.performSync();
          break;
      }
    });
  }

  // Setup notification system
  async setupNotifications() {
    // Request notification permission if needed
    if (Notification.permission === 'default') {
      await new Promise((resolve) => {
        chrome.notifications.getPermissionLevel((level) => {
          if (level === 'granted') {
            resolve();
          }
        });
      });
    }
  }

  // Setup performance monitoring
  async setupPerformanceMonitoring() {
    this.performanceMetrics = {
      startTime: Date.now(),
      apiCalls: 0,
      errors: 0,
      dataCollected: 0,
      memoryUsage: []
    };

    // Monitor memory usage
    setInterval(() => {
      this.recordMemoryUsage();
    }, 60000); // Every minute
  }

  // Setup offline synchronization
  async setupOfflineSync() {
    // Listen for online/offline events
    self.addEventListener('online', () => {
      log('info', 'Connection restored, syncing offline data');
      processOfflineQueue();
    });

    self.addEventListener('offline', () => {
      log('warn', 'Connection lost, entering offline mode');
    });
  }

  // Perform regular maintenance tasks
  async performMaintenance() {
    try {
      log('debug', 'Performing maintenance tasks');
      
      // Clean old logs
      await this.cleanOldLogs();
      
      // Validate storage
      await this.validateStorage();
      
      // Update cache
      await this.updateCache();
      
      // Check for updates
      await this.checkForUpdates();
      
      log('debug', 'Maintenance completed successfully');
    } catch (error) {
      log('error', 'Maintenance failed', error);
    }
  }

  // Perform cleanup tasks
  async performCleanup() {
    try {
      log('debug', 'Performing cleanup tasks');
      
      // Clear expired cache entries
      await this.clearExpiredCache();
      
      // Cleanup old incidents
      await this.cleanupOldIncidents();
      
      // Optimize storage
      await this.optimizeStorage();
      
      log('debug', 'Cleanup completed successfully');
    } catch (error) {
      log('error', 'Cleanup failed', error);
    }
  }

  // Perform data synchronization
  async performSync() {
    try {
      log('debug', 'Performing sync tasks');
      
      // Process offline queue
      await processOfflineQueue();
      
      // Sync configuration
      await this.syncConfiguration();
      
      // Update red list cache
      await this.updateRedListCache();
      
      log('debug', 'Sync completed successfully');
    } catch (error) {
      log('error', 'Sync failed', error);
    }
  }

  // Clean old log entries
  async cleanOldLogs() {
    const { debugLogs = [] } = await chrome.storage.local.get(['debugLogs']);
    
    // Keep only logs from last 7 days
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentLogs = debugLogs.filter(log => 
      new Date(log.timestamp).getTime() > weekAgo
    );
    
    if (recentLogs.length !== debugLogs.length) {
      await chrome.storage.local.set({ debugLogs: recentLogs });
      log('debug', `Cleaned ${debugLogs.length - recentLogs.length} old log entries`);
    }
  }

  // Validate storage integrity
  async validateStorage() {
    try {
      const storage = await chrome.storage.local.get(null);
      let hasIssues = false;
      
      // Check for required keys
      const requiredKeys = ['machineId', 'monitoringEnabled', 'userConsented'];
      for (const key of requiredKeys) {
        if (!(key in storage)) {
          log('warn', `Missing required storage key: ${key}`);
          hasIssues = true;
        }
      }
      
      // Check data types
      if (storage.machineId && typeof storage.machineId !== 'string') {
        log('warn', 'Invalid machineId type');
        hasIssues = true;
      }
      
      if (hasIssues) {
        log('warn', 'Storage validation found issues, reinitializing');
        await initializeExtension();
      }
    } catch (error) {
      log('error', 'Storage validation failed', error);
    }
  }

  // Update cache
  async updateCache() {
    // Refresh red list cache if expired
    if (Date.now() - lastCacheUpdate > CONFIG.CACHE_DURATION) {
      await this.updateRedListCache();
    }
  }

  // Check for extension updates
  async checkForUpdates() {
    try {
      const currentVersion = chrome.runtime.getManifest().version;
      
      // This would check against a corporate update server in production
      log('debug', `Current version: ${currentVersion}`);
    } catch (error) {
      log('error', 'Update check failed', error);
    }
  }

  // Clear expired cache entries
  async clearExpiredCache() {
    const now = Date.now();
    
    // Clear expired red list entries
    for (const [domain, entry] of redListCache.entries()) {
      if (now - entry.timestamp > CONFIG.CACHE_DURATION) {
        redListCache.delete(domain);
      }
    }
    
    log('debug', `Cache size after cleanup: ${redListCache.size} entries`);
  }

  // Cleanup old incidents
  async cleanupOldIncidents() {
    // In a production environment, this would clean up old incident data
    // For now, we just limit the offline queue size
    if (offlineQueue.length > 50) {
      offlineQueue.splice(0, offlineQueue.length - 50);
      log('debug', 'Trimmed offline incident queue');
    }
  }

  // Optimize storage usage
  async optimizeStorage() {
    try {
      const storage = await chrome.storage.local.get(null);
      const storageSize = JSON.stringify(storage).length;
      
      log('debug', `Current storage usage: ${Math.round(storageSize / 1024)}KB`);
      
      // Warn if storage is getting large
      if (storageSize > 1024 * 1024) { // 1MB
        log('warn', 'Storage usage is high, consider cleanup');
      }
    } catch (error) {
      log('error', 'Storage optimization failed', error);
    }
  }

  // Sync configuration with corporate policies
  async syncConfiguration() {
    if (typeof self !== 'undefined' && self.perfMonitorConfig) {
      await self.perfMonitorConfig.loadConfig();
      log('debug', 'Configuration synchronized');
    }
  }

  // Update red list cache
  async updateRedListCache() {
    try {
      const response = await fetch(`https://vxvcquifgwtbjghrcjbp.supabase.co/rest/v1/blocked_domains?select=domain`, {
        headers: {
          'apikey': CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
        }
      });
      
      if (response.ok) {
        const domains = await response.json();
        redListCache.clear();
        
        domains.forEach(item => {
          redListCache.set(item.domain, {
            blocked: true,
            timestamp: Date.now()
          });
        });
        
        lastCacheUpdate = Date.now();
        log('debug', `Updated red list cache with ${domains.length} domains`);
      }
    } catch (error) {
      log('error', 'Failed to update red list cache', error);
    }
  }

  // Record memory usage metrics
  recordMemoryUsage() {
    if (performance.memory) {
      const usage = {
        timestamp: Date.now(),
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      };
      
      this.performanceMetrics.memoryUsage.push(usage);
      
      // Keep only last 24 hours of metrics
      const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
      this.performanceMetrics.memoryUsage = this.performanceMetrics.memoryUsage.filter(
        metric => metric.timestamp > dayAgo
      );
    }
  }

  // Get performance metrics
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      uptime: Date.now() - this.performanceMetrics.startTime,
      cacheHitRate: redListCache.size > 0 ? 0.95 : 0, // Simulated
      averageResponseTime: 150 // Simulated
    };
  }

  // Send notification to user
  async sendNotification(title, message, type = 'basic') {
    try {
      await chrome.notifications.create({
        type: type,
        iconUrl: 'icons/icon48.png',
        title: title,
        message: message
      });
    } catch (error) {
      log('error', 'Failed to send notification', error);
    }
  }

  // Handle critical errors
  handleCriticalError(error, context) {
    log('error', `Critical error in ${context}`, error);
    
    // Send notification for critical errors
    this.sendNotification(
      'PerfMonitor Error',
      `A critical error occurred: ${error.message}`,
      'basic'
    );
    
    // Attempt recovery
    setTimeout(() => {
      try {
        initializeExtension();
      } catch (recoveryError) {
        log('error', 'Recovery failed', recoveryError);
      }
    }, 5000);
  }
}

// Process offline incident queue
async function processOfflineQueue() {
  if (offlineQueue.length === 0) return;
  
  log('info', `Processing ${offlineQueue.length} offline incidents`);
  
  const batch = offlineQueue.splice(0, CONFIG.BATCH_SIZE);
  
  for (const incident of batch) {
    try {
      await createIncident(incident);
    } catch (error) {
      // If still failing, put back in queue
      offlineQueue.unshift(incident);
      break;
    }
  }
}

// Enhanced maintenance function for global use
async function performMaintenance() {
  if (typeof self !== 'undefined' && self.perfMonitorServiceWorker) {
    await self.perfMonitorServiceWorker.performMaintenance();
  }
}

// Initialize service worker utilities
if (typeof self !== 'undefined') {
  self.perfMonitorServiceWorker = new PerfMonitorServiceWorker();
}
