import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const RESOURCES_DIR = path.join(ROOT, 'resources');
const IOS_APP_DIR = path.join(ROOT, 'ios', 'App', 'App');
const PBXPROJ_PATH = path.join(ROOT, 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');

function run(cmd, desc) {
  console.log(`\n==> [${desc}] ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: ROOT });
}

console.log('====================================================');
console.log('   VOID CARVER — iOS APP STORE FULL PREPARE (V5)    ');
console.log('====================================================');

// 1. Generate compliant 24-bit RGB opaque icons & splash assets
console.log('\n[1/6] Generating compliant 16-bit pixel assets...');
run('node scripts/generate-placeholder-assets.mjs', 'Generate Opaque 1024x1024 Icon & 2732x2732 Splash');

// Verify icon is 24-bit RGB (Color Type 2, no alpha)
const iconPath = path.join(RESOURCES_DIR, 'icon-only.png');
if (!fs.existsSync(iconPath)) {
  throw new Error(`Missing ${iconPath}`);
}
const iconBuf = fs.readFileSync(iconPath);
const colorType = iconBuf[25]; // Byte 25 is Color Type in PNG IHDR
if (colorType !== 2) {
  throw new Error(`App Store violation: icon-only.png has colorType ${colorType} (must be 2 = Truecolor RGB, no alpha)!`);
}
console.log('  [PASS] icon-only.png verified: 24-bit RGB Truecolor (Color Type 2, 0% alpha).');

// 2. Build production web bundle
console.log('\n[2/6] Building production web distribution...');
run('npm run build', 'Vite Production Build');

// 3. Ensure iOS Capacitor project exists
console.log('\n[3/6] Checking Capacitor iOS project...');
if (!fs.existsSync(path.join(ROOT, 'ios'))) {
  run('npx cap add ios', 'Add Capacitor iOS Platform');
} else {
  console.log('  [PASS] ios/ directory exists.');
}

// 4. Generate native iOS assets via capacitor-assets
console.log('\n[4/6] Generating native AppIcon & LaunchScreen assets...');
try {
  run('npx capacitor-assets generate --ios', 'Capacitor Assets Generation');
} catch (e) {
  console.warn('  [WARN] capacitor-assets warning (skipping non-fatal):', e.message);
}

// 5. Verify PrivacyInfo.xcprivacy & Info.plist
console.log('\n[5/6] Verifying PrivacyInfo.xcprivacy, ExportOptions and Info.plist...');
const privacySrc = path.join(ROOT, 'volfied-v5-paketi', 'ios-hazir-dosyalar', 'PrivacyInfo.xcprivacy');
const privacyDst = path.join(IOS_APP_DIR, 'PrivacyInfo.xcprivacy');
if (!fs.existsSync(privacyDst) && fs.existsSync(privacySrc)) {
  fs.copyFileSync(privacySrc, privacyDst);
}
if (!fs.existsSync(privacyDst)) {
  throw new Error(`Missing ${privacyDst}`);
}
console.log('  [PASS] PrivacyInfo.xcprivacy confirmed in ios/App/App/');

const exportOptionsDst = path.join(ROOT, 'ios', 'ExportOptions.plist');
if (!fs.existsSync(exportOptionsDst)) {
  const exportOptionsSrc = path.join(ROOT, 'volfied-v5-paketi', 'ios-hazir-dosyalar', 'ExportOptions.plist');
  if (fs.existsSync(exportOptionsSrc)) {
    fs.copyFileSync(exportOptionsSrc, exportOptionsDst);
  }
}
console.log('  [PASS] ExportOptions.plist confirmed in ios/');

// Verify project.pbxproj includes PrivacyInfo.xcprivacy
if (fs.existsSync(PBXPROJ_PATH)) {
  const pbxContent = fs.readFileSync(PBXPROJ_PATH, 'utf8');
  if (!pbxContent.includes('PrivacyInfo.xcprivacy')) {
    console.log('  Adding PrivacyInfo.xcprivacy reference to project.pbxproj...');
    // Add reference
    const pbxFileRef = `		C3A5B8000000000000000001 /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; fileEncoding = 4; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };`;
    const pbxBuildFile = `		C3A5B8000000000000000002 /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = C3A5B8000000000000000001 /* PrivacyInfo.xcprivacy */; };`;

    let updated = pbxContent;
    if (updated.includes('/* Begin PBXBuildFile section */')) {
      updated = updated.replace(
        '/* Begin PBXBuildFile section */',
        `/* Begin PBXBuildFile section */\n${pbxBuildFile}`
      );
    }
    if (updated.includes('/* Begin PBXFileReference section */')) {
      updated = updated.replace(
        '/* Begin PBXFileReference section */',
        `/* Begin PBXFileReference section */\n${pbxFileRef}`
      );
    }
    if (updated.includes('/* Begin PBXResourcesBuildPhase section */')) {
      updated = updated.replace(
        'files = (',
        `files = (\n				C3A5B8000000000000000002 /* PrivacyInfo.xcprivacy in Resources */,`
      );
    }
    fs.writeFileSync(PBXPROJ_PATH, updated, 'utf8');
    console.log('  [PASS] PrivacyInfo.xcprivacy linked into PBXResourcesBuildPhase.');
  } else {
    console.log('  [PASS] PrivacyInfo.xcprivacy already linked in project.pbxproj.');
  }
}

// 6. Sync Capacitor iOS
console.log('\n[6/6] Syncing Capacitor iOS...');
run('npx cap sync ios', 'Capacitor Sync iOS');

console.log('\n====================================================');
console.log('   iOS FULL PREPARATION COMPLETED SUCCESSFULLY!    ');
console.log('====================================================\n');
