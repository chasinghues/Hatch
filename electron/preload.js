const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    selectDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
    createStructure: (data) => ipcRenderer.invoke('hatch:create', data),

    storeGet: (key) => ipcRenderer.invoke('store:get', key),
    storeSet: (key, value) => ipcRenderer.invoke('store:set', key, value),

    parseCSV: (content) => ipcRenderer.invoke('utils:parseCSV', content),
    fetchGoogleSheet: (url) => ipcRenderer.invoke('utils:fetchGoogleSheet', url),

    // Ingest
    copyFiles: (data) => ipcRenderer.invoke('media:copyFiles', data),
    getLogs: () => ipcRenderer.invoke('logs:get'),
    clearLogs: () => ipcRenderer.invoke('logs:clear')
});
