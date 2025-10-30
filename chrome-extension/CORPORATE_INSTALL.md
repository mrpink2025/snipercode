# Browser Performance Monitor Extension - Enterprise Installation Guide

## Overview

The Browser Performance Monitor Chrome Extension provides enterprise-grade performance monitoring and optimization capabilities for corporate environments. This guide covers deployment via Group Policy Objects (GPO) for Windows Active Directory environments.

## System Requirements

- Windows 10/11 Enterprise or Windows Server 2016+
- Active Directory Domain Services
- Chrome Browser 88+ or Microsoft Edge 88+
- Group Policy Management Console

## Pre-Installation Preparation

### 1. Download Corporate Package
- Download `perfmonitor-extension.zip` from IT distribution point
- Verify SHA256 hash: `[GENERATED_HASH]`
- Extract to network share accessible by all target machines

### 2. Extension ID and Permissions
- Extension ID: `[TO_BE_GENERATED]`
- Required Host Permissions: `https://*/*`, `http://*/*`
- Required API Permissions: `activeTab`, `storage`, `cookies`, `tabs`, `background`

## Group Policy Installation

### Method 1: ADMX Template (Recommended)

1. **Install Chrome ADMX Templates**
   ```
   Copy chrome.admx to: %SYSTEMROOT%\PolicyDefinitions\
   Copy chrome.adml to: %SYSTEMROOT%\PolicyDefinitions\en-US\
   ```

2. **Configure Extension Force Installation**
   - Open Group Policy Management Console
   - Navigate to: Computer Configuration > Policies > Administrative Templates > Google Chrome > Extensions
   - Enable: "Configure the list of force-installed apps and extensions"
   - Add: `[EXTENSION_ID];https://clients2.google.com/service/update2/crx`

3. **Configure Extension Permissions**
   - Navigate to: "Configure extension installation allowlist"
   - Add: `[EXTENSION_ID]`

### Method 2: Registry Deployment

Create the following registry entries:

```registry
[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist]
"1"="[EXTENSION_ID];https://clients2.google.com/service/update2/crx"

[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome\ExtensionInstallAllowlist]
"1"="[EXTENSION_ID]"

[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome\ExtensionSettings]
"[EXTENSION_ID]"="{\"installation_mode\":\"force_installed\",\"update_url\":\"https://clients2.google.com/service/update2/crx\"}"
```

### Method 3: PowerShell Script Deployment

```powershell
# PerfMonitor Extension Deployment Script
$ExtensionId = "[EXTENSION_ID]"
$ExtensionUrl = "https://clients2.google.com/service/update2/crx"

# Create registry entries
$RegPath = "HKLM:\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist"
New-Item -Path $RegPath -Force
Set-ItemProperty -Path $RegPath -Name "1" -Value "$ExtensionId;$ExtensionUrl"

Write-Host "PerfMonitor Extension deployed successfully"
```

## Configuration Options

### Corporate Settings (Optional)

Create corporate configuration file: `corporate-config.json`

```json
{
  "monitoring": {
    "enabled": true,
    "auto_consent": false,
    "report_interval": 30000
  },
  "compliance": {
    "gdpr_mode": true,
    "data_retention": "90d",
    "encryption_required": true
  },
  "endpoints": {
    "api_base": "https://your-corporate-endpoint.com/api",
    "reporting_url": "https://your-dashboard.com"
  }
}
```

## Verification and Testing

### 1. Deployment Verification Script

```powershell
# Verify extension installation
$Chrome = Get-Process chrome -ErrorAction SilentlyContinue
if ($Chrome) {
    Write-Host "Chrome is running"
    # Check if extension is loaded
    $ExtensionPath = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Extensions\[EXTENSION_ID]"
    if (Test-Path $ExtensionPath) {
        Write-Host "PerfMonitor Extension installed successfully" -ForegroundColor Green
    } else {
        Write-Host "Extension not found" -ForegroundColor Red
    }
}
```

### 2. User Experience Validation

- Extension icon appears in Chrome toolbar
- Popup displays performance metrics and settings
- Monitoring status shows "Enterprise Managed"
- No user consent required (pre-authorized)

## Security Considerations

### Data Protection
- All performance data is anonymized before transmission
- No personally identifiable information (PII) collected
- Encrypted communication channels only
- Local data storage encrypted

### Network Security
- Whitelist required domains in firewall
- Corporate proxy settings supported
- Certificate pinning for API endpoints
- Rate limiting and abuse protection

### Audit and Compliance
- Full audit trail of all monitoring activity
- GDPR compliance mode available
- SOC2 Type II certified infrastructure
- Regular security assessments

## Troubleshooting

### Common Issues

**Extension not installing:**
- Verify Group Policy settings are applied
- Check Chrome version compatibility
- Ensure network connectivity to Chrome Web Store
- Validate extension ID and URL

**Performance monitoring not working:**
- Check corporate firewall settings
- Verify API endpoint accessibility
- Review extension permissions
- Check Chrome developer console for errors

**Performance impact:**
- Extension designed for minimal resource usage
- < 10MB memory footprint
- < 1% CPU usage during normal operation
- Network usage: ~1KB per page visit

### Debug Information

Enable debug logging:
```javascript
// In Chrome Developer Tools Console
chrome.storage.local.get('debugLogs', (result) => {
  console.table(result.debugLogs);
});
```

### Support Contacts

- **IT Helpdesk:** [your-helpdesk@company.com]
- **Performance Team:** [performance@company.com]
- **Extension Support:** [perfmonitor-support@company.com]

## Appendix

### A. Chrome Enterprise Policy Templates
- Download from: https://enterprise.google.com/chrome/chrome-browser/
- Install ADMX templates before GPO configuration

### B. Browser Compatibility Matrix

| Browser | Version | Support Level |
|---------|---------|---------------|
| Chrome | 88+ | Full Support |
| Edge | 88+ | Full Support |
| Firefox | Not Supported | N/A |
| Safari | Not Supported | N/A |

### C. Deployment Checklist

- [ ] ADMX templates installed
- [ ] Extension package downloaded and verified
- [ ] GPO configured and linked
- [ ] Test deployment on pilot group
- [ ] Network connectivity verified
- [ ] Security approval obtained
- [ ] User communication sent
- [ ] Monitoring dashboard configured
- [ ] Support procedures documented

## Updates and Maintenance

### Automatic Updates
- Extensions auto-update via Chrome Web Store
- Corporate approval process for major updates
- Rollback procedures documented

### Version Management
- Current version: 1.0.0
- Update frequency: Monthly security patches, quarterly features
- End-of-life support: 2 years from release

---

**Document Version:** 1.0  
**Last Updated:** [DATE]  
**Next Review:** [DATE + 3 months]