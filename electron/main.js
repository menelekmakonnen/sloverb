import { app, BrowserWindow, ipcMain, shell, dialog, session, Tray, Menu, globalShortcut, nativeImage } from 'electron';
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

// ── Album art cache & concurrency limiter ──
const albumArtCache = new Map();
const ALBUM_ART_CACHE_MAX = 500;
const albumArtInFlight = new Map(); // dedup concurrent requests for same path
let artConcurrency = 0;
const ART_MAX_CONCURRENCY = 3;
const artQueue = [];

function runArtQueue() {
    while (artConcurrency < ART_MAX_CONCURRENCY && artQueue.length > 0) {
        const { resolve, reject, filePath } = artQueue.shift();
        artConcurrency++;
        _fetchAlbumArt(filePath)
            .then(resolve)
            .catch(reject)
            .finally(() => { artConcurrency--; runArtQueue(); });
    }
}

async function _fetchAlbumArt(filePath) {
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
}

ipcMain.handle('get-album-art', async (event, filePath) => {
    try {
        // 1. Return from cache immediately
        if (albumArtCache.has(filePath)) {
            return albumArtCache.get(filePath);
        }
        // 2. Dedup: if already in-flight for this path, await same promise
        if (albumArtInFlight.has(filePath)) {
            return await albumArtInFlight.get(filePath);
        }
        // 3. Queue with concurrency limit
        const promise = new Promise((resolve, reject) => {
            artQueue.push({ resolve, reject, filePath });
            runArtQueue();
        }).then(result => {
            // Cache result (LRU eviction)
            if (albumArtCache.size >= ALBUM_ART_CACHE_MAX) {
                const oldest = albumArtCache.keys().next().value;
                albumArtCache.delete(oldest);
            }
            albumArtCache.set(filePath, result);
            albumArtInFlight.delete(filePath);
            return result;
        }).catch(e => {
            albumArtInFlight.delete(filePath);
            return null;
        });
        albumArtInFlight.set(filePath, promise);
        return await promise;
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

// YouTube downloads go to the user's Music folder
const ytDownloadDir = path.join(app.getPath('music'), 'Sloverb');
if (!fs.existsSync(ytDownloadDir)) {
    fs.mkdirSync(ytDownloadDir, { recursive: true });
}

// Locate ffmpeg for yt-dlp stream merging
const ffmpegSearchPaths = [
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages'),
    'C:\\ffmpeg\\bin',
    path.join(process.env.ProgramFiles || '', 'ffmpeg', 'bin'),
];
let ffmpegDir = '';
for (const base of ffmpegSearchPaths) {
    try {
        if (!fs.existsSync(base)) continue;
        // Recursively find ffmpeg.exe
        const walk = (dir) => {
            for (const f of fs.readdirSync(dir)) {
                const fp = path.join(dir, f);
                try {
                    const st = fs.statSync(fp);
                    if (st.isDirectory()) { const r = walk(fp); if (r) return r; }
                    else if (f === 'ffmpeg.exe') return path.dirname(fp);
                } catch (e) { }
            }
            return null;
        };
        const found = walk(base);
        if (found) { ffmpegDir = found; break; }
    } catch (e) { }
}
console.log('[FFmpeg] Location:', ffmpegDir || 'NOT FOUND (merging disabled)');

ipcMain.handle('fetch-youtube', async (event, url) => {
    try {
        let validUrl = url.trim();
        if (!validUrl.startsWith('http')) {
            validUrl = 'https://' + validUrl;
        }
        let cleanUrl = validUrl;
        try {
            const parsed = new URL(validUrl);
            if (parsed.hostname.includes('youtube.com')) {
                const v = parsed.searchParams.get('v');
                if (v) cleanUrl = `https://www.youtube.com/watch?v=${v}`;
            } else if (parsed.hostname.includes('youtu.be')) {
                cleanUrl = `https://www.youtube.com/watch?v=${parsed.pathname.slice(1)}`;
            }
        } catch (e) {
            console.error("URL Parsing failed:", e);
        }

        // Step 1: Get video info
        console.log('[YouTube] Fetching info for:', cleanUrl);
        const info = await youtubedl(cleanUrl, {
            dumpJson: true,
            noPlaylist: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true
        });

        const rawTitle = info.title ? info.title.replace(/[^\w\s\-]/g, '').trim() : `youtube_${Date.now()}`;
        const artist = (info.uploader || info.channel || 'YouTube').replace(/[^\w\s\-]/g, '').trim();
        const displayTitle = rawTitle.substring(0, 80); // Readable title with spaces for UI
        const safeTitle = displayTitle.replace(/\s+/g, '_'); // No spaces for filename
        const safeArtist = artist.substring(0, 40).replace(/\s+/g, '_');
        const stamp = Date.now();
        const fileName = `${safeTitle}_-_${safeArtist}`;
        const outTemplate = path.join(ytDownloadDir, `${fileName}.%(ext)s`);

        console.log('[YouTube] Downloading best video+audio for:', displayTitle, 'by', artist);

        // Step 2: Try best video+audio merge via ffmpeg, fallback to single stream
        // Always aim for highest quality available
        try {
            await youtubedl(cleanUrl, {
                format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio',
                output: outTemplate,
                mergeOutputFormat: 'mp4',
                ffmpegLocation: ffmpegDir || undefined,
                noPlaylist: true,
                noCheckCertificates: true,
                noWarnings: true,
            });
        } catch (mergeErr) {
            console.log('[YouTube] Merge failed, trying single-stream:', mergeErr.message);
            await youtubedl(cleanUrl, {
                format: 'best[ext=mp4]/best',
                output: outTemplate,
                ffmpegLocation: ffmpegDir || undefined,
                noPlaylist: true,
                noCheckCertificates: true,
                noWarnings: true,
            });
        }

        // Step 3: Find the actual output file
        const dirFiles = fs.readdirSync(ytDownloadDir);
        const outputFile = dirFiles.find(f => f.startsWith(fileName));

        if (!outputFile) {
            throw new Error('Download completed but output file not found');
        }

        const filepath = path.join(ytDownloadDir, outputFile);
        const fileSize = fs.statSync(filepath).size;
        console.log('[YouTube] Downloaded:', filepath, `(${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

        // Step 4: Auto-add to library
        const ext = path.extname(outputFile).toLowerCase();
        const libraryItem = {
            id: filepath,
            type: ext === '.mp4' ? 'video' : 'raw',
            name: displayTitle,
            path: filepath,
            artist: artist,
            album: 'YouTube Downloads',
            timestamp: Date.now(),
        };
        // Read existing library and append
        let libData = { songs: [], playlists: [] };
        if (fs.existsSync(libraryPath)) {
            try {
                const parsed = JSON.parse(fs.readFileSync(libraryPath, 'utf8'));
                if (Array.isArray(parsed)) libData.songs = parsed;
                else libData = parsed;
            } catch (e) { }
        }
        if (!libData.songs.find(s => s.id === libraryItem.id)) {
            libData.songs.unshift(libraryItem);
            fs.writeFileSync(libraryPath, JSON.stringify(libData, null, 2), 'utf8');
        }
        console.log('[YouTube] Added to library:', displayTitle);

        return { title: displayTitle, artist, path: filepath, id: filepath, size: fileSize, libraryItem };

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
app.setAppUserModelId('com.icunigroup.sloverb');

let tray = null;
let mainWindow = null;
let isCurrentlyPlaying = false;

// ── Taskbar Thumbnail Toolbar Icons (16x16 SVG → nativeImage) ──
function makeSvgIcon(svgContent) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">${svgContent}</svg>`;
    const encoded = Buffer.from(svg).toString('base64');
    return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${encoded}`);
}

const prevIcon = makeSvgIcon('<polygon points="3,3 3,13 5,13 5,3" fill="white"/><polygon points="5,8 13,3 13,13" fill="white"/>');
const playIcon = makeSvgIcon('<polygon points="4,2 4,14 14,8" fill="white"/>');
const pauseIcon = makeSvgIcon('<rect x="3" y="2" width="4" height="12" rx="1" fill="white"/><rect x="9" y="2" width="4" height="12" rx="1" fill="white"/>');
const nextIcon = makeSvgIcon('<polygon points="3,3 3,13 11,8" fill="white"/><polygon points="11,3 13,3 13,13 11,13" fill="white"/>');

function updateThumbarButtons(win) {
    if (!win || win.isDestroyed()) return;
    try {
        win.setThumbarButtonList([
            {
                tooltip: 'Previous',
                icon: prevIcon,
                click: () => { win.webContents.send('media-previous'); }
            },
            {
                tooltip: isCurrentlyPlaying ? 'Pause' : 'Play',
                icon: isCurrentlyPlaying ? pauseIcon : playIcon,
                click: () => { win.webContents.send('media-play-pause'); }
            },
            {
                tooltip: 'Next',
                icon: nextIcon,
                click: () => { win.webContents.send('media-next'); }
            }
        ]);
    } catch (e) {
        // Thumbar not supported on this platform
    }
}
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

const validAudioExts = ['.mp3', '.wav', '.flac', '.m4a', '.mp4', '.ogg', '.aac', '.wma'];

function extractFileArg(argv) {
    // Find the first argument that looks like a file path with a valid audio extension
    for (const arg of argv.slice(1)) {
        if (arg.startsWith('-') || arg.startsWith('--')) continue;
        const ext = path.extname(arg).toLowerCase();
        if (validAudioExts.includes(ext) && fs.existsSync(arg)) return arg;
    }
    return null;
}

// Single instance lock — if already running, forward file to existing window
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine) => {
        const filePath = extractFileArg(commandLine);
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
            if (filePath) {
                mainWindow.webContents.send('open-file', filePath);
            }
        }
    });
}

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

    // Initialize taskbar thumbnail buttons
    mainWindow.once('ready-to-show', () => updateThumbarButtons(mainWindow));
    mainWindow.webContents.on('did-finish-load', () => updateThumbarButtons(mainWindow));

    // Listen for playback state changes from renderer to update play/pause icon
    ipcMain.on('thumbar-playback-state', (event, playing) => {
        isCurrentlyPlaying = playing;
        updateThumbarButtons(mainWindow);
    });

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
    globalShortcut.register('MediaPreviousTrack', () => {
        if (mainWindow) mainWindow.webContents.send('media-previous');
    });
    globalShortcut.register('MediaNextTrack', () => {
        if (mainWindow) mainWindow.webContents.send('media-next');
    });

    // Check process args for files to open (e.g. double-click association)
    const startupFile = extractFileArg(process.argv);
    if (startupFile) {
        fileToOpen = startupFile;
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
