const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    selectDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
    createStructure: (data) => ipcRenderer.invoke('hatch:create', data),

    storeGet: (key) => ipcRenderer.invoke('store:get', key),
    storeSet: (key, value) => ipcRenderer.invoke('store:set', key, value),

    parseCSV: (content) => ipcRenderer.invoke('utils:parseCSV', content),
    fetchGoogleSheet: (url) => ipcRenderer.invoke('utils:fetchGoogleSheet', url),
    openPath: (path) => ipcRenderer.invoke('utils:openPath', path),
    openExternal: (url) => ipcRenderer.invoke('utils:openExternal', url),
    saveJSON: (payload) => ipcRenderer.invoke('dialog:saveJSON', payload),
    readJSON: () => ipcRenderer.invoke('dialog:readJSON'),

    // Ingest
    selectFiles: () => ipcRenderer.invoke('ingest:selectFiles'),
    scanPaths: (paths) => ipcRenderer.invoke('ingest:scanPaths', paths),
    readStructure: (rootPath) => ipcRenderer.invoke('fs:readStructure', rootPath),
    processIngest: (data) => ipcRenderer.invoke('ingest:process', data),
    resolveConflicts: (data) => ipcRenderer.invoke('ingest:resolveConflicts', data),
    onIngestProgress: (callback) => ipcRenderer.on('ingest:progress', (_, data) => callback(data)),
    removeIngestProgressListener: () => ipcRenderer.removeAllListeners('ingest:progress'),
    getLogs: () => ipcRenderer.invoke('logs:get'),
    clearLogs: () => ipcRenderer.invoke('logs:clear'),
    getProjects: () => ipcRenderer.invoke('projects:get'),
    deleteProject: (id) => ipcRenderer.invoke('projects:delete', id)
});
