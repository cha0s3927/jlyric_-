const fs = require('fs');
const path = require('path');

const PROJECT_DIR = path.resolve(__dirname);
const ELECTRON_DIST = path.join(PROJECT_DIR, 'node_modules', 'electron', 'dist');
const OUT_DIR = path.join(PROJECT_DIR, 'dist', 'JLyric');
const APP_NAME = 'JLyric';

// If output dir doesn't exist, copy full Electron dist
if (!fs.existsSync(OUT_DIR)) {
  console.log('First build: copying Electron runtime...');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.cpSync(ELECTRON_DIST, OUT_DIR, { recursive: true, dereference: true });
} else {
  console.log('Incremental build: updating app files...');
  // Also check for missing Electron runtime files
  for (const entry of fs.readdirSync(ELECTRON_DIST)) {
    if (!fs.existsSync(path.join(OUT_DIR, entry))) {
      const src = path.join(ELECTRON_DIST, entry);
      const dest = path.join(OUT_DIR, entry);
      if (fs.statSync(src).isFile()) {
        fs.copyFileSync(src, dest);
        console.log(`  Restored missing runtime file: ${entry}`);
      }
    }
  }
}

// Always ensure app exe exists (copy electron.exe and rename)
const electronExe = path.join(OUT_DIR, 'electron.exe');
const appExe = path.join(OUT_DIR, `${APP_NAME}.exe`);
if (!fs.existsSync(appExe)) {
  // Need to copy electron.exe first
  if (!fs.existsSync(electronExe)) {
    fs.copyFileSync(path.join(ELECTRON_DIST, 'electron.exe'), electronExe);
  }
  fs.renameSync(electronExe, appExe);
  console.log('  Created: ' + APP_NAME + '.exe');
}

// Copy locale .pak files (critical — without them, Electron shows blank window)
const localesSrc = path.join(ELECTRON_DIST, 'locales');
const localesDest = path.join(OUT_DIR, 'locales');
fs.mkdirSync(localesDest, { recursive: true });
for (const entry of fs.readdirSync(localesSrc)) {
  if (entry.endsWith('.pak')) {
    fs.copyFileSync(path.join(localesSrc, entry), path.join(localesDest, entry));
  }
}
console.log('  Updated locales');

// Copy app files to resources/app (always overwrite)
const resourcesApp = path.join(OUT_DIR, 'resources', 'app');
fs.mkdirSync(resourcesApp, { recursive: true });

const filesToCopy = ['main.js', 'preload.js', 'package.json', 'src', 'renderer', 'data'];
for (const file of filesToCopy) {
  const src = path.join(PROJECT_DIR, file);
  const dest = path.join(resourcesApp, file);
  if (fs.existsSync(src)) {
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(src, dest, { recursive: true, dereference: true });
    console.log(`  Updated: ${file}`);
  }
}

// Copy node_modules deps
const appNodeModules = path.join(resourcesApp, 'node_modules');
fs.mkdirSync(appNodeModules, { recursive: true });

const deps = ['sql.js', 'kuromoji'];
for (const dep of deps) {
  const src = path.join(PROJECT_DIR, 'node_modules', dep);
  const dest = path.join(appNodeModules, dep);
  if (fs.existsSync(src)) {
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(src, dest, { recursive: true, dereference: true });
    console.log(`  Updated dep: ${dep}`);
  }
}

// Create minimal package.json
const pkgJson = { name: 'jlyric', version: '1.0.0', main: 'main.js', dependencies: { 'sql.js': '^1.14.1', 'kuromoji': '^0.1.2' } };
fs.writeFileSync(path.join(resourcesApp, 'package.json'), JSON.stringify(pkgJson, null, 2));

// 6. Calculate size (simple recursive walk)
function getDirSize(dir) {
  let size = 0;
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isFile()) size += fs.statSync(full).size;
      else if (entry.isDirectory()) walk(full);
    }
  };
  walk(dir);
  return size;
}

const sizeMB = (getDirSize(OUT_DIR) / 1024 / 1024).toFixed(0);
console.log(`\nDone! Output: ${OUT_DIR}`);
console.log(`Size: ~${sizeMB}MB`);
console.log(`Run: ${appExe}`);
