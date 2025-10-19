#!/usr/bin/env node

// Build script for CorpMonitor Chrome Extension
// Supports building both Store and Enterprise versions
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log(`🚀 Building CorpMonitor Chrome Extension...`);

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

// Copy manifest
console.log('📋 Copying manifest...');
const manifestSrc = path.join(__dirname, 'manifest.json');
const manifestDest = path.join(buildDir, 'manifest.json');
if (fs.existsSync(manifestSrc)) {
  fs.copyFileSync(manifestSrc, manifestDest);
  console.log('   ✓ manifest.json');
} else {
  console.error('   ❌ manifest.json not found!');
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
console.log('📦 Creating distribution packages...');
try {
  const packageName = 'corpmonitor';
  const zipPath = path.join(__dirname, `${packageName}.zip`);
  
  if (process.platform === 'win32') {
    // Windows - use PowerShell
    execSync(`powershell "Compress-Archive -Path '${buildDir}\\*' -DestinationPath '${zipPath}' -Force"`);
  } else {
    // Unix-like systems - use zip
    execSync(`cd "${buildDir}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });
  }
  
  console.log(`   ✓ ZIP package: ${zipPath}`);
  
  // Generate SHA256 hash of ZIP for Web Store submission
  const crypto = require('crypto');
  const fileBuffer = fs.readFileSync(zipPath);
  const hashSum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  
  fs.writeFileSync(path.join(__dirname, `${packageName}.sha256`), hashSum);
  console.log(`   ✓ SHA256 hash (ZIP): ${hashSum.substring(0, 16)}...`);
  
  
} catch (error) {
  console.warn('   ⚠️  Could not create packages:', error.message);
  console.log('   💡 Manual packaging may be required');
}

// ============================================
// Call pack-and-hash.ps1 to create .crx and update update.xml
// ============================================
if (process.platform === 'win32') {
  console.log('\n🔐 Empacotando extensão e gerando hash SHA256...');
  try {
    execSync('powershell -ExecutionPolicy Bypass -File ./pack-and-hash.ps1', {
      cwd: __dirname,
      stdio: 'inherit'
    });
  } catch (packError) {
    console.warn('\n⚠️  Erro ao executar pack-and-hash.ps1:', packError.message);
    console.log('💡 Execute manualmente: powershell -ExecutionPolicy Bypass -File ./pack-and-hash.ps1');
  }
} else {
  console.log('\n⚠️  pack-and-hash.ps1 requer Windows PowerShell');
  console.log('💡 Para Linux/Mac, use: npm run build:crx');
}

// Generate installation instructions
const instructionsPath = path.join(__dirname, 'INSTALLATION.md');
const instructions = `# CorpMonitor Extension Installation

## Build Process

\`\`\`bash
npm run build
# or
node build.js
\`\`\`

This creates:
- \`dist/\` folder with extension files
- \`corpmonitor.zip\` for Chrome Web Store submission
- \`corpmonitor.crx\` for direct installation
- \`corpmonitor.sha256\` for integrity verification

## Installation Methods

### Development Installation (Unpacked)

1. Build the extension:
   \`\`\`bash
   npm run build
   \`\`\`

2. Open Chrome and navigate to \`chrome://extensions/\`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the \`dist/\` folder
6. Extension should appear in toolbar

### Chrome Web Store Submission

1. Build: \`npm run build\`
2. Upload \`corpmonitor.zip\` to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Privacy Policy URL: \`https://monitorcorporativo.com/privacy-policy.html\`
4. See \`CHROME_STORE_SUBMISSION.md\` for complete submission guide
5. Submit for review

### Enterprise GPO Deployment

1. Build the extension: \`npm run build\`
2. Host \`corpmonitor.crx\` on your internal server or use Supabase update server
3. Configure Group Policy:
   \`\`\`
   [HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Google\\Chrome\\ExtensionInstallForcelist]
   "1"="[EXTENSION_ID];https://monitorcorporativo.com/updates/corpmonitor.crx"
   \`\`\`
4. Extension auto-installs on managed devices

## Privacy Policy

Public privacy policy accessible at:
- **Online**: https://monitorcorporativo.com/privacy-policy.html
- **Offline**: Included as \`privacy-policy.html\` in extension

Satisfies Chrome Web Store disclosure requirements.

## Permissions Explained

| Permission | Purpose | Justification |
|------------|---------|---------------|
| \`activeTab\` | Monitor current tab | User-initiated monitoring via popup |
| \`storage\` | Save preferences | User settings and monitoring state |
| \`cookies\` | Cookie monitoring | Corporate DLP - detect credential leaks |
| \`tabs\` | Navigation tracking | Compliance and audit requirements |
| \`background\` | Continuous sync | Real-time reporting to corporate server |
| \`host_permissions\` | All sites | Detect phishing and malicious sites |

## Security Features

- ✅ SHA256 integrity verification
- ✅ Public privacy policy (LGPD compliant)
- ✅ User notification and consent
- ✅ Monitoring pause controls
- ✅ Clear data collection disclosure

## Troubleshooting

- **Extension not loading**: Enable Chrome developer mode
- **No icon**: Verify icon files in \`icons/\` directory
- **Monitoring not working**: Check background service worker in \`chrome://extensions/\`
- **Update issues**: Verify \`extension-update-server\` edge function

## Support

- **Dashboard**: https://monitorcorporativo.com
- **Documentation**: See \`CHROME_STORE_SUBMISSION.md\`
- **Technical Support**: Contact IT administrator
`;

fs.writeFileSync(instructionsPath, instructions);
console.log(`📖 Installation instructions updated: ${instructionsPath}`);

console.log('');
console.log('✅ Build completed successfully!');
console.log('');
console.log('Build artifacts:');
console.log('   📁 dist/ - Extension files');
console.log('   📦 corpmonitor.zip - Chrome Web Store package');
console.log('   🔐 corpmonitor.sha256 - ZIP integrity verification');
console.log('');
console.log('💡 Next: Run "npm run build:crx" to generate signed .crx package');
console.log('');
console.log('Next steps:');
console.log('1. Upload corpmonitor.zip to Chrome Web Store');
console.log('2. Privacy policy: https://monitorcorporativo.com/privacy-policy.html');
console.log('3. Review CHROME_STORE_SUBMISSION.md for submission checklist');
console.log('4. Submit for review');
console.log('');
console.log('🎉 CorpMonitor Chrome Extension is ready!');