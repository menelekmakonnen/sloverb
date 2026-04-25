import { app, BrowserWindow, ipcMain, shell, dialog, session, Tray, Menu, globalShortcut } from 'electron';
import youtubedl from 'youtube-dl-exec';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as mm from 'music-metadata';
import DiscordRPC from 'discord-rpc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const clientId = '123456789012345678'; // Placeholder, doesn't matter for local test but need to be valid length or just use empty if not connecting real app
DiscordRPC.register(clientId);
const rpc = new DiscordRPC.Client({ transport: 'ipc' });
let rpcReady = false;

rpc.on('ready', () => {
    rpcReady = true;
});
rpc.login({ clientId }).catch(console.error);

ipcMain.handle('set-discord-activity', (event, activity) => {
    if (rpcReady) {
        rpc.setActivity({
            details: activity.details,
            state: activity.state,
            largeImageKey: 'sloverb_logo',
            largeImageText: 'Sloverb Studio v2.1',
            startTimestamp: activity.startTimestamp,
            instance: false,
        }).catch(console.error);
    }
});


const presetsPath = path.join(app.getPath('userData'), 'presets.json');

function getPresets() {
    if (!fs.existsSync(presetsPath)) return {};
    try { return JSON.parse(fs.readFileSync(presetsPath, 'utf8')); }
    catch (e) { return {}; }
}

function savePresets(data) {
    fs.writeFileSync(presetsPath, JSON.stringify(data, null, 2), 'utf8');
}

ipcMain.handle('load-presets', () => getPresets());
ipcMain.handle('save-preset', (event, name, data) => {
    const presets = getPresets();
    presets[name] = data;
    savePresets(presets);
    return presets;
});
ipcMain.handle('delete-preset', (event, name) => {
    const presets = getPresets();
    delete presets[name];
    savePresets(presets);
    return presets;
});

const generationsDir = path.join(app.getPath('userData'), 'generations');
if (!fs.existsSync(generationsDir)) {
    fs.mkdirSync(generationsDir, { recursive: true });
}

// ── Configurable download directory ──
const settingsPath = path.join(app.getPath('userData'), 'settings.json');
function getSettings() {
    if (!fs.existsSync(settingsPath)) return {};
    try { return JSON.parse(fs.readFileSync(settingsPath, 'utf8')); }
    catch { return {}; }
}
function saveSettings(data) {
    fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2), 'utf8');
}
function getDownloadDir() {
    const settings = getSettings();
    if (settings.downloadDir && fs.existsSync(settings.downloadDir)) return settings.downloadDir;
    // Default: Windows Music folder
    return app.getPath('music');
}

ipcMain.handle('get-settings', () => getSettings());
ipcMain.handle('save-settings', (event, newSettings) => {
    const current = getSettings();
    const merged = { ...current, ...newSettings };
    saveSettings(merged);
    return merged;
});
ipcMain.handle('select-download-dir', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
});

ipcMain.handle('save-generation', async (event, fileName, bufferData) => {
    const filePath = path.join(generationsDir, fileName);
    fs.writeFileSync(filePath, Buffer.from(bufferData));
    return filePath;
});

ipcMain.handle('get-generations', async () => {
    if (!fs.existsSync(generationsDir)) return [];
    const files = fs.readdirSync(generationsDir);
    return files.map(file => {
        const filePath = path.join(generationsDir, file);
        const stats = fs.statSync(filePath);
        return { name: file, path: filePath, mtime: stats.mtimeMs };
    }).sort((a, b) => b.mtime - a.mtime);
});

ipcMain.handle('delete-generation', async (event, fileName) => {
    const filePath = path.join(generationsDir, fileName);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    return true;
});

ipcMain.handle('read-file', async (event, filePath) => {
    // Attempt absolute path or generations file path
    let target = filePath;
    if (!path.isAbsolute(target) && fs.existsSync(path.join(generationsDir, target))) {
        target = path.join(generationsDir, target);
    }
    if (fs.existsSync(target)) {
        return fs.readFileSync(target);
    }
    throw new Error('File not found: ' + target);
});

ipcMain.handle('open-generation', async (event, fileName) => {
    const filePath = path.join(generationsDir, fileName);
    if (fs.existsSync(filePath)) {
        shell.showItemInFolder(filePath);
    }
});

const libraryPath = path.join(app.getPath('userData'), 'library.json');

ipcMain.handle('load-library', () => {
    let data = { songs: [], playlists: [] };
    if (!fs.existsSync(libraryPath)) return data;
    try {
        const parsed = JSON.parse(fs.readFileSync(libraryPath, 'utf8'));
        if (Array.isArray(parsed)) data.songs = parsed;
        else data = parsed;
    } catch (e) { }
    return data;
});

ipcMain.handle('add-to-library', async (event, item) => {
    let data = { songs: [], playlists: [] };
    if (fs.existsSync(libraryPath)) {
        try {
            const parsed = JSON.parse(fs.readFileSync(libraryPath, 'utf8'));
            if (Array.isArray(parsed)) data.songs = parsed;
            else data = parsed;
        } catch (e) { }
    }

    if (!item.artist && !item.album && item.path && fs.existsSync(item.path) && item.type !== 'video') {
        try {
            const metadata = await mm.parseFile(item.path);
            item.artist = metadata.common.artist || metadata.common.albumartist || 'Unknown Artist';
            item.album = metadata.common.album || 'Unknown Album';
            item.name = metadata.common.title || item.name;
        } catch (e) { }
    } else {
        item.artist = item.artist || 'Unknown Artist';
        item.album = item.album || 'Unknown Album';
    }

    if (!data.songs.find(i => i.id === item.id)) {
        data.songs.unshift(item);
        fs.writeFileSync(libraryPath, JSON.stringify(data, null, 2), 'utf8');
    }
    return data;
});

ipcMain.handle('remove-from-library', (event, id) => {
    let data = { songs: [], playlists: [] };
    if (fs.existsSync(libraryPath)) {
        try {
            const parsed = JSON.parse(fs.readFileSync(libraryPath, 'utf8'));
            if (Array.isArray(parsed)) data.songs = parsed;
            else data = parsed;
        } catch (e) { }
    }
    data.songs = data.songs.filter(i => i.id !== id);
    // Remove from playlists too
    data.playlists.forEach(p => {
        p.itemIds = p.itemIds.filter(itemId => itemId !== id);
    });
    fs.writeFileSync(libraryPath, JSON.stringify(data, null, 2), 'utf8');
    return data;
});

ipcMain.handle('get-album-art', async (event, filePath) => {
    try {
        if (!filePath || !fs.existsSync(filePath)) return null;
        // 1. Try embedded metadata
        const metadata = await mm.parseFile(filePath);
        const picture = metadata.common.picture;
        if (picture && picture.length > 0) {
            return `data:${picture[0].format};base64,${picture[0].data.toString('base64')}`;
        }
        // 2. Fallback: look for cover art images in the same folder
        const dir = path.dirname(filePath);
        const coverNames = ['cover', 'folder', 'album', 'front', 'artwork', 'thumb'];
        const imgExts = ['.jpg', '.jpeg', '.png', '.webp', '.bmp'];
        const dirFiles = fs.readdirSync(dir);
        for (const name of coverNames) {
            for (const ext of imgExts) {
                const candidate = dirFiles.find(f => f.toLowerCase() === name + ext);
                if (candidate) {
                    const imgPath = path.join(dir, candidate);
                    const imgData = fs.readFileSync(imgPath);
                    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
                    return `data:${mime};base64,${imgData.toString('base64')}`;
                }
            }
        }
        // 3. Fallback: any image file in the folder
        const anyImg = dirFiles.find(f => imgExts.some(e => f.toLowerCase().endsWith(e)));
        if (anyImg) {
            const imgPath = path.join(dir, anyImg);
            const imgData = fs.readFileSync(imgPath);
            const ext = path.extname(anyImg).toLowerCase();
            const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
            return `data:${mime};base64,${imgData.toString('base64')}`;
        }
        return null;
    } catch (e) {
        return null;
    }
});

ipcMain.handle('save-library', (event, newLibraryData) => {
    fs.writeFileSync(libraryPath, JSON.stringify(newLibraryData, null, 2), 'utf8');
    return newLibraryData;
});

ipcMain.handle('update-library-order', (event, newSongsList) => {
    let data = { songs: [], playlists: [] };
    if (fs.existsSync(libraryPath)) {
        try {
            const parsed = JSON.parse(fs.readFileSync(libraryPath, 'utf8'));
            if (Array.isArray(parsed)) data.songs = parsed;
            else data = parsed;
        } catch (e) { }
    }
    data.songs = newSongsList;
    fs.writeFileSync(libraryPath, JSON.stringify(data, null, 2), 'utf8');
    return data;
});

// --- Phase 5: YouTube & Folder Scanning ---

ipcMain.handle('fetch-youtube', async (event, url) => {
    try {
        let validUrl = url.trim();
        if (!validUrl.startsWith('http')) {
            validUrl = 'https://' + validUrl;
        }
        let cleanUrl = validUrl;
        let isPlaylist = false;
        try {
            const parsed = new URL(validUrl);
            if (parsed.hostname.includes('youtube.com')) {
                const v = parsed.searchParams.get('v');
                const list = parsed.searchParams.get('list');
                if (list) { cleanUrl = `https://www.youtube.com/playlist?list=${list}`; isPlaylist = true; }
                else if (v) cleanUrl = `https://www.youtube.com/watch?v=${v}`;
            } else if (parsed.hostname.includes('youtu.be')) {
                cleanUrl = `https://www.youtube.com/watch?v=${parsed.pathname.slice(1)}`;
            }
        } catch (e) {
            console.error("URL Parsing failed:", e);
        }

        const downloadDir = getDownloadDir();
        if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });

        // Step 1: Get video/playlist info
        console.log('[YouTube] Fetching info for:', cleanUrl);
        event.sender.send('youtube-download-progress', 'Fetching info from YouTube...');
        
        const infoFlags = {
            dumpJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
        };
        if (isPlaylist) {
            infoFlags.flatPlaylist = true;
        }
        
        const info = await youtubedl(cleanUrl, infoFlags);

        const entries = info._type === 'playlist' && info.entries ? info.entries : [info];
        const results = [];
        
        console.log(`[YouTube] Found ${entries.length} items to download`);
        
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            if (!entry) continue;
            
            const title = entry.title ? entry.title.replace(/[^\w\s\-()\[\]]/g, '').trim() : `youtube_${Date.now()}`;
            const safeTitle = title.substring(0, 80);
            const stamp = Date.now();
            const outPath = path.join(downloadDir, `${safeTitle}.%(ext)s`);
            const entryUrl = entry.webpage_url || entry.url || entry.id
                ? `https://www.youtube.com/watch?v=${entry.id}`
                : cleanUrl;

            console.log(`[YouTube] Downloading (${i+1}/${entries.length}):`, safeTitle);
            if (entries.length > 1) {
                event.sender.send('youtube-download-progress', `Downloading ${i+1} of ${entries.length}: ${safeTitle}...`);
            } else {
                event.sender.send('youtube-download-progress', `Downloading: ${safeTitle}...`);
            }

            // Step 2: Download and extract audio as m4a
            try {
                await youtubedl(entryUrl, {
                    extractAudio: true,
                    audioFormat: 'm4a',
                    audioQuality: 0,
                    output: outPath,
                    noPlaylist: true,
                    noCheckCertificates: true,
                    noWarnings: true,
                });

                // Step 3: Find the output file
                const dirFiles = fs.readdirSync(downloadDir);
                const outputFile = dirFiles.find(f => f.startsWith(safeTitle) && !f.endsWith('.part'));

                if (outputFile) {
                    const filepath = path.join(downloadDir, outputFile);
                    console.log('[YouTube] Downloaded:', filepath);
                    results.push({ title: safeTitle, path: filepath, id: filepath });
                }
            } catch (dlErr) {
                console.error(`[YouTube] Failed to download ${safeTitle}:`, dlErr.message);
                // Continue with other entries if one fails
            }
        }
        
        if (results.length === 0) {
            throw new Error('Download completed but no output files were found');
        }

        return results; // Return array of { title, path, id }

    } catch (e) {
        console.error("[YouTube] Fetch Error:", e.message || e);
        throw new Error(`YouTube download failed: ${e.message || 'Unknown error'}`);
    }
});

ipcMain.handle('locate-file', async (event, targetPath) => {
    if (fs.existsSync(targetPath)) {
        shell.showItemInFolder(targetPath);
    }
});

ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'multiSelections']
    });

    if (result.canceled || result.filePaths.length === 0) return [];

    const selectedPath = result.filePaths[0];
    const validExtensions = ['.mp3', '.wav', '.flac', '.m4a', '.mp4', '.ogg'];
    let filesFound = [];

    const walkSync = async (dir) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filepath = path.join(dir, file);
            const stats = fs.statSync(filepath);
            if (stats.isDirectory()) {
                await walkSync(filepath);
            } else if (stats.isFile()) {
                const ext = path.extname(filepath).toLowerCase();
                if (validExtensions.includes(ext)) {
                    let artist = 'Unknown Artist';
                    let album = 'Unknown Album';
                    let title = file;
                    if (ext !== '.mp4') {
                        try {
                            const metadata = await mm.parseFile(filepath);
                            artist = metadata.common.artist || metadata.common.albumartist || artist;
                            album = metadata.common.album || album;
                            title = metadata.common.title || title;
                        } catch (e) { }
                    }
                    filesFound.push({
                        id: filepath,
                        type: ext === '.mp4' ? 'video' : 'raw',
                        name: title,
                        path: filepath,
                        artist,
                        album,
                        timestamp: stats.birthtimeMs // Time added to folder
                    });
                }
            }
        }
    };

    await walkSync(selectedPath);
    return filesFound;
});

ipcMain.on('window-control', (event, action) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    switch (action) {
        case 'minimize': win.minimize(); break;
        case 'maximize': win.isMaximized() ? win.unmaximize() : win.maximize(); break;
        case 'close': win.close(); break;
    }
});

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        title: "Sloverb Studio",
        frame: false,
        icon: path.join(__dirname, '../public/logo.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs')
        }
    });

    win.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            win.hide();
        }
        return false;
    });

    const url = process.env.VITE_DEV_SERVER_URL;
    if (url) {
        win.loadURL(url);
        win.webContents.openDevTools();
    } else {
        // Note: this assumes standard vite build output to dist/index.html
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
    return win;
}

app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer');

let tray = null;
let mainWindow = null;
let fileToOpen = null;

// Handle macOS open-file event
app.on('open-file', (event, path) => {
    event.preventDefault();
    if (mainWindow && mainWindow.isReady()) {
        mainWindow.webContents.send('open-file', path);
    } else {
        fileToOpen = path;
    }
});

app.whenReady().then(() => {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Cross-Origin-Opener-Policy': ['same-origin'],
                'Cross-Origin-Embedder-Policy': ['require-corp'],
                'Cross-Origin-Resource-Policy': ['cross-origin']
            }
        });
    });

    mainWindow = createWindow();

    // Setup Tray
    tray = new Tray(path.join(__dirname, '../public/logo.png'));
    const contextMenu = Menu.buildFromTemplate([
        { label: 'Show App', click: () => { if (mainWindow) mainWindow.show(); } },
        { label: 'Play/Pause', click: () => { if (mainWindow) mainWindow.webContents.send('media-play-pause'); } },
        { label: 'Next Track', click: () => { if (mainWindow) mainWindow.webContents.send('media-next'); } },
        { type: 'separator' },
        { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
    ]);
    tray.setToolTip('Sloverb Studio');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => { if (mainWindow) mainWindow.show(); });

    // Setup Global Shortcuts
    globalShortcut.register('MediaPlayPause', () => {
        if (mainWindow) mainWindow.webContents.send('media-play-pause');
    });
    globalShortcut.register('MediaNextTrack', () => {
        if (mainWindow) mainWindow.webContents.send('media-next');
    });

    // Check Windows process args for files to open
    if (process.platform === 'win32' && process.argv.length >= 2) {
        const filePath = process.argv[1];
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            fileToOpen = filePath;
        }
    }

    mainWindow.webContents.on('did-finish-load', () => {
        if (fileToOpen) {
            mainWindow.webContents.send('open-file', fileToOpen);
            fileToOpen = null;
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
        else if (mainWindow) mainWindow.show();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});
