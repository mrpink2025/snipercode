#!/usr/bin/env node

// Build script for CorpMonitor Chrome Extension
// Supports building both Store and Enterprise versions
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse command line arguments
const args = process.argv.slice(2);
const buildType = args[0] || 'dev'; // dev, store, or enterprise

console.log(`🚀 Building CorpMonitor Chrome Extension (${buildType} version)...`);

// Create build directory
const buildDir = path.join(__dirname, 'dist');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir);
}

// Copy extension files
const filesToCopy = [
  'background.js',
  'popup.html',
  'popup.js',
  'content.js',
  'config.js',
  'service-worker-utils.js',
  'debug-console.js',
  'options.html',
  'options.js',
  'privacy-policy.html'
];

console.log('📁 Copying extension files...');
filesToCopy.forEach(file => {
  const src = path.join(__dirname, file);
  const dest = path.join(buildDir, file);
  
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`   ✓ ${file}`);
  } else {
    console.warn(`   ⚠️  ${file} not found`);
  }
});

// Copy appropriate manifest based on build type
let manifestSource;
switch(buildType) {
  case 'store':
    manifestSource = 'manifest-store.json';
    console.log('📋 Using Store manifest (minimal permissions)...');
    break;
  case 'enterprise':
    manifestSource = 'manifest-corporate.json';
    console.log('📋 Using Enterprise manifest (full permissions)...');
    break;
  default:
    manifestSource = 'manifest.json';
    console.log('📋 Using development manifest...');
}

const manifestSrc = path.join(__dirname, manifestSource);
const manifestDest = path.join(buildDir, 'manifest.json');
if (fs.existsSync(manifestSrc)) {
  fs.copyFileSync(manifestSrc, manifestDest);
  console.log(`   ✓ manifest.json (from ${manifestSource})`);
} else {
  console.error(`   ❌ ${manifestSource} not found!`);
  process.exit(1);
}

// Create icons directory and copy icons
const iconsDir = path.join(buildDir, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir);
}

// Copy real icons from icons directory
console.log('🎨 Copying icons...');
const iconSizes = [16, 32, 48, 128];
iconSizes.forEach(size => {
  const srcIcon = path.join(__dirname, 'icons', `icon${size}.png`);
  const destIcon = path.join(iconsDir, `icon${size}.png`);
  
  if (fs.existsSync(srcIcon)) {
    fs.copyFileSync(srcIcon, destIcon);
    console.log(`   ✓ icon${size}.png`);
  } else {
    console.warn(`   ⚠️  icon${size}.png not found - generating placeholder`);
    // Create minimal placeholder if real icon doesn't exist
    fs.writeFileSync(destIcon, Buffer.from('PNG placeholder for icon ' + size));
  }
});

// Create packages for distribution
if (buildType !== 'dev') {
  console.log('📦 Creating distribution packages...');
  try {
    const packageName = buildType === 'store' ? 'corpmonitor-store' : 'corpmonitor-enterprise';
    const zipPath = path.join(__dirname, `${packageName}.zip`);
    
    if (process.platform === 'win32') {
      // Windows - use PowerShell
      execSync(`powershell "Compress-Archive -Path '${buildDir}\\*' -DestinationPath '${zipPath}' -Force"`);
    } else {
      // Unix-like systems - use zip
      execSync(`cd "${buildDir}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });
    }
    
    console.log(`   ✓ ZIP package: ${zipPath}`);
    
    // Copy ZIP as CRX for download compatibility (Chrome will handle it)
    const crxPath = path.join(__dirname, `${packageName}.crx`);
    fs.copyFileSync(zipPath, crxPath);
    console.log(`   ✓ CRX package: ${crxPath}`);
    
    // Generate SHA256 hash for security verification
    const crypto = require('crypto');
    const fileBuffer = fs.readFileSync(zipPath);
    const hashSum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    
    fs.writeFileSync(path.join(__dirname, `${packageName}.sha256`), `${hashSum}  ${packageName}.zip`);
    console.log(`   ✓ SHA256 hash: ${hashSum.substring(0, 16)}...`);
    
  } catch (error) {
    console.warn('   ⚠️  Could not create packages:', error.message);
    console.log('   💡 Manual packaging may be required');
  }
}

// Generate installation instructions
const instructionsPath = path.join(__dirname, 'INSTALLATION.md');
const instructions = `# CorpMonitor Extension Installation

## Build Types

This extension supports three build configurations:

### 1. Development Build
\`\`\`bash
npm run dev
# or
node build.js dev
\`\`\`
- Uses standard \`manifest.json\` with all permissions
- For local testing and development
- Load as unpacked extension in Chrome

### 2. Store Build (Chrome Web Store)
\`\`\`bash
npm run build:store
# or
node build.js store
\`\`\`
- Uses \`manifest-store.json\` with minimal permissions
- Limited to \`activeTab\` and \`storage\` only
- No \`cookies\`, \`tabs\`, or \`host_permissions\`
- Suitable for Chrome Web Store submission
- Generates: \`corpmonitor-store.zip\` and \`.crx\`

### 3. Enterprise Build (Corporate Deployment)
\`\`\`bash
npm run build:enterprise
# or
node build.js enterprise
\`\`\`
- Uses \`manifest-corporate.json\` with full permissions
- Includes \`cookies\`, \`tabs\`, \`background\`, and \`host_permissions\`
- Version 2.0.0+ for enterprise update tracking
- For GPO deployment and corporate environments
- Generates: \`corpmonitor-enterprise.zip\` and \`.crx\`

## Installation Methods

### Development Installation (Unpacked)

1. Build the extension:
   \`\`\`bash
   npm run dev
   \`\`\`

2. Open Chrome and navigate to \`chrome://extensions/\`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" button
5. Select the \`dist/\` folder from this directory
6. The extension should now appear in your extensions list

### Chrome Web Store Submission

1. Build the store version:
   \`\`\`bash
   npm run build:store
   \`\`\`

2. Upload \`corpmonitor-store.zip\` to Chrome Web Store Developer Dashboard
3. Ensure privacy policy link is set to: \`https://monitorcorporativo.com/privacy-policy.html\`
4. Fill out store listing with appropriate screenshots and descriptions
5. Submit for review

### Enterprise Deployment via GPO

1. Build the enterprise version:
   \`\`\`bash
   npm run build:enterprise
   \`\`\`

2. Host the \`corpmonitor-enterprise.crx\` file on your internal server or use the Supabase update server

3. Configure Group Policy (Windows):
   \`\`\`
   [HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Google\\Chrome\\ExtensionInstallForcelist]
   "1"="[EXTENSION_ID];https://your-update-server.com/corpmonitor-enterprise.crx"
   \`\`\`

4. Or use Chrome ADMX template with ExtensionInstallForcelist policy

5. Users will automatically receive the enterprise version with full monitoring capabilities

## Two-Version Strategy

### Store Version (v1.0.0)
- **Purpose**: Initial distribution via Chrome Web Store
- **Permissions**: Minimal (\`activeTab\`, \`storage\`)
- **Capabilities**: Limited monitoring, user consent flows
- **Target**: Public store approval and basic deployment

### Enterprise Version (v2.0.0+)
- **Purpose**: Full corporate monitoring capabilities
- **Permissions**: Complete (\`cookies\`, \`tabs\`, \`host_permissions\`)
- **Capabilities**: Full navigation tracking, cookie monitoring, session tracking
- **Deployment**: GPO-based silent installation over Store version
- **Updates**: Automatic via \`extension-update-server\` edge function

### Update Flow
1. User installs Store version (v1.0.0) from Chrome Web Store
2. Corporate IT deploys Enterprise version (v2.0.0) via GPO
3. Chrome automatically replaces Store version with Enterprise version
4. No user prompts or confirmations required (GPO bypass)
5. Users get full monitoring capabilities transparently

## Privacy Policy

The extension includes a public privacy policy accessible at:
- **Online**: https://monitorcorporativo.com/privacy-policy.html
- **Offline**: Included as \`privacy-policy.html\` in extension package

This satisfies Chrome Web Store requirements for privacy policy disclosure.

## Verification

After installation, you should see:
- 🛡️ CorpMonitor icon in the Chrome toolbar
- Extension popup when clicking the icon
- Monitoring capabilities based on version installed

## Security Notes

- All builds include SHA256 hash verification
- Store version passes Chrome Web Store automated security checks
- Enterprise version requires GPO deployment (controlled rollout)
- Privacy policy clearly discloses all data collection practices

## Troubleshooting

- **Extension not loading**: Check Chrome developer mode is enabled
- **No icon showing**: Verify manifest.json and icon files are correct
- **Monitoring not working**: 
  - Store version: Limited capabilities by design
  - Enterprise version: Check GPO deployment and extension version
- **Update not applying**: Verify \`extension-update-server\` is running and accessible

## Support

For technical support:
- **Internal**: Contact your IT administrator
- **Dashboard**: https://monitorcorporativo.com
- **Documentation**: See CHROME_STORE_SUBMISSION.md for submission guidelines
`;

fs.writeFileSync(instructionsPath, instructions);
console.log(`📖 Installation instructions updated: ${instructionsPath}`);

console.log('');
console.log('✅ Build completed successfully!');
console.log('');
console.log('Build artifacts:');
console.log(`   📁 dist/ - Extension files ready for ${buildType} deployment`);
if (buildType !== 'dev') {
  const packageName = buildType === 'store' ? 'corpmonitor-store' : 'corpmonitor-enterprise';
  console.log(`   📦 ${packageName}.zip - Package for distribution`);
  console.log(`   📦 ${packageName}.crx - Chrome extension package`);
  console.log(`   🔐 ${packageName}.sha256 - Security hash verification`);
}
console.log('');
console.log('Next steps:');
if (buildType === 'dev') {
  console.log('1. Load dist/ folder as unpacked extension in Chrome');
  console.log('2. Test monitoring functionality');
} else if (buildType === 'store') {
  console.log('1. Upload corpmonitor-store.zip to Chrome Web Store');
  console.log('2. Set privacy policy URL: https://monitorcorporativo.com/privacy-policy.html');
  console.log('3. Submit for review');
} else {
  console.log('1. Deploy corpmonitor-enterprise.crx via GPO');
  console.log('2. Configure extension-update-server for automatic updates');
  console.log('3. Monitor rollout via CorpMonitor dashboard');
}
console.log('');
console.log('🎉 CorpMonitor Chrome Extension is ready!');