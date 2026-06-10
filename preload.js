const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  songs: {
    list: () => ipcRenderer.invoke('songs:list'),
    get: (id) => ipcRenderer.invoke('songs:get', id),
    delete: (id) => ipcRenderer.invoke('songs:delete', id),
    search: (query) => ipcRenderer.invoke('songs:search', query),
    importNetease: (songId) => ipcRenderer.invoke('songs:import-netease', songId),
    importFile: (options) => ipcRenderer.invoke('songs:import-file', options),
    updateLyric: (data) => ipcRenderer.invoke('songs:update-lyric', data),
    exportJSON: (id) => ipcRenderer.invoke('songs:export-json', id),
  },
  overlay: {
    show: (songId) => ipcRenderer.invoke('overlay:show', songId),
    close: () => ipcRenderer.invoke('overlay:close'),
    state: () => ipcRenderer.invoke('overlay:state'),
    setPosition: (x, y) => ipcRenderer.invoke('overlay:set-position', { x, y }),
    getPosition: () => ipcRenderer.invoke('overlay:get-position'),
    setIgnoreMouse: (ignore) => ipcRenderer.invoke('overlay:set-ignore-mouse', ignore),
    onNavigate: (cb) => ipcRenderer.on('overlay:navigate', (e, data) => cb(data)),
    onLoadSong: (cb) => ipcRenderer.on('overlay:load-song', (e, data) => cb(data)),
    onSettings: (cb) => ipcRenderer.on('overlay:settings', (e, data) => cb(data)),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (path, value) => ipcRenderer.invoke('settings:update', { path, value }),
    reset: () => ipcRenderer.invoke('settings:reset'),
  },
});
