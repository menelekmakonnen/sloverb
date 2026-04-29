const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    windowControl: (action) => ipcRenderer.send('window-control', action),
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
    enrichLibraryMetadata: () => ipcRenderer.invoke('enrich-library-metadata'),
    readFile: (p) => ipcRenderer.invoke('read-file', p),
    fetchYoutube: (url) => ipcRenderer.invoke('fetch-youtube', url),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    updateLibraryOrder: (lib) => ipcRenderer.invoke('update-library-order', lib),
    saveLibrary: (data) => ipcRenderer.invoke('save-library', data),
    locateFile: (p) => ipcRenderer.invoke('locate-file', p),
    getAlbumArt: (p) => ipcRenderer.invoke('get-album-art', p),
    setDiscordActivity: (activity) => ipcRenderer.invoke('set-discord-activity', activity),
    onMediaPlayPause: (callback) => ipcRenderer.on('media-play-pause', callback),
    onMediaNext: (callback) => ipcRenderer.on('media-next', callback),
    onMediaPrevious: (callback) => ipcRenderer.on('media-previous', callback),
    sendThumbbarState: (isPlaying) => ipcRenderer.send('thumbar-playback-state', isPlaying),
    // YouTube streaming
    ytSearch: (query) => ipcRenderer.invoke('yt-search', query),
    ytGetInfo: (url) => ipcRenderer.invoke('yt-get-info', url),
    ytStreamStart: (url) => ipcRenderer.invoke('yt-stream-start', url),
    ytStreamStop: () => ipcRenderer.invoke('yt-stream-stop'),
    onStreamChunk: (cb) => ipcRenderer.on('stream-chunk', (e, chunk) => cb(chunk)),
    onStreamEnd: (cb) => ipcRenderer.on('stream-end', () => cb()),
    removeStreamListeners: () => {
        ipcRenderer.removeAllListeners('stream-chunk');
        ipcRenderer.removeAllListeners('stream-end');
    },
    // YouTube session login (no API keys — signs in via BrowserWindow)
    ytLogin: () => ipcRenderer.invoke('yt-login'),
    ytDisconnect: () => ipcRenderer.invoke('yt-disconnect'),
    ytConnectionStatus: () => ipcRenderer.invoke('yt-connection-status'),
    ytGetPlaylistItems: (id) => ipcRenderer.invoke('yt-get-playlist-items', id),
    ytGetLikedVideos: () => ipcRenderer.invoke('yt-get-liked-videos'),
    ytGetMyPlaylists: () => ipcRenderer.invoke('yt-get-my-playlists'),
    ytStreamStartAuth: (url) => ipcRenderer.invoke('yt-stream-start-auth', url),
    onOpenFile: (callback) => ipcRenderer.on('open-file', callback),
    removeMediaListeners: () => {
        ipcRenderer.removeAllListeners('media-play-pause');
        ipcRenderer.removeAllListeners('media-next');
        ipcRenderer.removeAllListeners('media-previous');
        ipcRenderer.removeAllListeners('open-file');
    }
});
