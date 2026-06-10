const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  overlay: { x: null, y: null, width: 800, height: 160 },
  fonts: { textSize: 22, readingSize: 14, translationSize: 14 },
  shortcuts: {
    next: 'CommandOrControl+Right',
    prev: 'CommandOrControl+Left',
    close: 'Escape',
  },
};

let settings;
let settingsPath;

function initSettings(dataDir) {
  settingsPath = path.join(dataDir, 'settings.json');
  try {
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      // Merge defaults for any missing keys
      settings = deepMerge({}, DEFAULTS, settings);
    } else {
      settings = JSON.parse(JSON.stringify(DEFAULTS));
      saveSettings();
    }
  } catch {
    settings = JSON.parse(JSON.stringify(DEFAULTS));
  }
  return settings;
}

function getSettings() {
  return JSON.parse(JSON.stringify(settings));
}

function saveSettings() {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

function updateSetting(path, value) {
  const keys = path.split('.');
  let obj = settings;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!obj[keys[i]]) obj[keys[i]] = {};
    obj = obj[keys[i]];
  }
  obj[keys[keys.length - 1]] = value;
  saveSettings();
  return getSettings();
}

function resetSettings() {
  settings = JSON.parse(JSON.stringify(DEFAULTS));
  saveSettings();
  return getSettings();
}

function deepMerge(target, ...sources) {
  for (const source of sources) {
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        target[key] = deepMerge(target[key] || {}, source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }
  return target;
}

module.exports = { initSettings, getSettings, updateSetting, resetSettings, DEFAULTS };
