const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const initDB = require('./src/db');
const { initSettings, getSettings, updateSetting, resetSettings } = require('./src/settings');

let mainWindow;
let overlayWindow;
let DB;
let SETTINGS;
let overlayIgnoreState = false; // tracks current setIgnoreMouseEvents state

const DATA_DIR = app.getPath('userData');
const DB_PATH = path.join(DATA_DIR, 'jlyric.db');

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'main.html'));
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

function createOverlayWindow() {
  if (overlayWindow) return;

  const { x, y, width, height } = SETTINGS.overlay;

  overlayWindow = new BrowserWindow({
    x: x ?? undefined,
    y: y ?? undefined,
    width,
    height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWindow.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Save position when window is moved (native drag via -webkit-app-region)
  let saveTimer = null;
  overlayWindow.on('move', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const [x, y] = overlayWindow.getPosition();
      updateSetting('overlay.x', x);
      updateSetting('overlay.y', y);
      SETTINGS = getSettings();
    }, 200);
  });

  // Send settings to overlay
  overlayWindow.webContents.on('did-finish-load', () => {
    overlayWindow.webContents.send('overlay:settings', SETTINGS);
  });
}

function registerGlobalShortcuts() {
  globalShortcut.unregisterAll();
  const { next, prev, close } = SETTINGS.shortcuts;

  if (next) {
    globalShortcut.register(next, () => {
      if (overlayWindow && overlayWindow.isVisible()) {
        overlayWindow.webContents.send('overlay:navigate', { direction: 'down' });
      }
    });
  }

  if (prev) {
    globalShortcut.register(prev, () => {
      if (overlayWindow && overlayWindow.isVisible()) {
        overlayWindow.webContents.send('overlay:navigate', { direction: 'up' });
      }
    });
  }

  if (close) {
    globalShortcut.register(close, () => {
      if (overlayWindow && overlayWindow.isVisible()) {
        overlayWindow.hide();
      }
    });
  }
}

function registerOverlayShortcuts() {
  // Ctrl+Shift+T: toggle click-through mode
  globalShortcut.register('CommandOrControl+Shift+T', () => {
    if (overlayWindow && overlayWindow.isVisible()) {
      overlayIgnoreState = !overlayIgnoreState;
      overlayWindow.setIgnoreMouseEvents(overlayIgnoreState, { forward: overlayIgnoreState });
      overlayWindow.webContents.send('overlay:ignore-state', overlayIgnoreState);
    }
  });
}

function unregisterOverlayShortcuts() {
  globalShortcut.unregister('CommandOrControl+Shift+T');
}

app.whenReady().then(async () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  SETTINGS = initSettings(DATA_DIR);
  DB = await initDB(DB_PATH);
  createMainWindow();
  registerGlobalShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (overlayWindow) {
    overlayWindow.destroy();
    overlayWindow = null;
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (overlayWindow) overlayWindow.destroy();
});

// === IPC handlers: Songs ===
ipcMain.handle('songs:list', async () => DB.getAllSongs());
ipcMain.handle('songs:get', async (event, songId) => DB.getSongWithLyrics(songId));
ipcMain.handle('songs:delete', async (event, songId) => DB.deleteSong(songId));
ipcMain.handle('songs:search', async (event, query) => {
  const { searchSongs } = require('./src/api');
  return searchSongs(query);
});
ipcMain.handle('songs:import-netease', async (event, songId) => {
  const { fetchAndParseLyrics } = require('./src/api');
  const lyricData = await fetchAndParseLyrics(songId);
  if (!lyricData) return { success: false, error: '获取歌词失败' };
  return DB.importSong(lyricData, 'netease');
});
ipcMain.handle('songs:import-file', async (event, options) => {
  const { parseLRC, parseJSON, parseYAML } = require('./src/parser');
  let lyricData;
  if (options.format === 'lrc') lyricData = parseLRC(options.content, options.title);
  else if (options.format === 'json') lyricData = parseJSON(options.content);
  else if (options.format === 'yaml') lyricData = parseYAML(options.content);
  if (!lyricData) return { success: false, error: '解析失败' };
  return DB.importSong(lyricData, options.format);
});
ipcMain.handle('songs:update-lyric', async (event, { songId, lineIndex, field, value }) => {
  return DB.updateLyricLine(songId, lineIndex, field, value);
});
ipcMain.handle('songs:export-json', async (event, songId) => DB.exportSongAsJSON(songId));

// === IPC handlers: Overlay ===
ipcMain.handle('overlay:show', async (event, songId) => {
  if (!overlayWindow) createOverlayWindow();
  overlayIgnoreState = false;
  registerOverlayShortcuts();
  // Send settings first
  overlayWindow.webContents.send('overlay:settings', SETTINGS);
  // Then send song data
  setTimeout(() => {
    const song = DB.getSongWithLyrics(songId);
    if (overlayWindow && overlayWindow.webContents && song) {
      overlayWindow.webContents.send('overlay:load-song', song);
    }
  }, 100);
  overlayWindow.showInactive();
});

ipcMain.handle('overlay:close', async () => {
  if (overlayWindow) {
    unregisterOverlayShortcuts();
    overlayWindow.hide();
  }
});

ipcMain.handle('overlay:set-position', async (event, { x, y }) => {
  if (overlayWindow) {
    overlayWindow.setPosition(Math.round(x), Math.round(y));
    updateSetting('overlay.x', x);
    updateSetting('overlay.y', y);
    SETTINGS = getSettings();
  }
});

ipcMain.handle('overlay:state', async () => ({ visible: overlayWindow?.isVisible() }));

ipcMain.handle('overlay:set-ignore-mouse', async (event, ignore) => {
  if (overlayWindow) {
    overlayWindow.setIgnoreMouseEvents(ignore, { forward: true });
  }
});

ipcMain.handle('overlay:get-position', async () => {
  if (overlayWindow) {
    const [x, y] = overlayWindow.getPosition();
    return { x, y };
  }
  return { x: 0, y: 0 };
});

// === IPC handlers: Settings ===
ipcMain.handle('settings:get', async () => getSettings());
ipcMain.handle('settings:update', async (event, { path, value }) => {
  SETTINGS = updateSetting(path, value);
  // Re-register shortcuts if shortcuts changed
  if (path.startsWith('shortcuts.')) {
    registerGlobalShortcuts();
  }
  // Notify overlay of font changes
  if (overlayWindow && overlayWindow.isVisible() && path.startsWith('fonts.')) {
    overlayWindow.webContents.send('overlay:settings', SETTINGS);
  }
  return SETTINGS;
});
ipcMain.handle('settings:reset', async () => {
  SETTINGS = resetSettings();
  registerGlobalShortcuts();
  if (overlayWindow && overlayWindow.isVisible()) {
    overlayWindow.webContents.send('overlay:settings', SETTINGS);
  }
  return SETTINGS;
});
