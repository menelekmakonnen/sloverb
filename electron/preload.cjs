const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    savePreset: (presetName, presetData) => ipcRenderer.invoke('save-preset', presetName, presetData),
    loadPresets: () => ipcRenderer.invoke('load-presets'),
    deletePreset: (presetName) => ipcRenderer.invoke('delete-preset', presetName),
    saveGeneration: (fileName, bufferData) => ipcRenderer.invoke('save-generation', fileName, bufferData),
    getGenerations: () => ipcRenderer.invoke('get-generations'),
    deleteGeneration: (fileName) => ipcRenderer.invoke('delete-generation', fileName),
    openGeneration: (fileName) => ipcRenderer.invoke('open-generation', fileName),
    loadLibrary: () => ipcRenderer.invoke('load-library'),
    addToLibrary: (item) => ipcRenderer.invoke('add-to-library', item),
    removeFromLibrary: (id) => ipcRenderer.invoke('remove-from-library', id),
    readFile: (p) => ipcRenderer.invoke('read-file', p),
    fetchYoutube: (url) => ipcRenderer.invoke('fetch-youtube', url),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    updateLibraryOrder: (lib) => ipcRenderer.invoke('update-library-order', lib),
    saveLibrary: (data) => ipcRenderer.invoke('save-library', data),
    locateFile: (p) => ipcRenderer.invoke('locate-file', p)
});
