import { app, BrowserWindow, ipcMain, shell, dialog, session } from 'electron';
import youtubedl from 'youtube-dl-exec';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as mm from 'music-metadata';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

        const info = await youtubedl(cleanUrl, {
            dumpJson: true,
            noPlaylist: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true
        });

        const title = info.title ? info.title.replace(/[^\w\s-]/g, '') : `youtube_${Date.now()}`;
        const filename = `youtube_${Date.now()}_${title}.mp3`;
        const filepath = path.join(generationsDir, filename);

        await youtubedl(cleanUrl, {
            extractAudio: true,
            audioFormat: 'mp3',
            output: filepath,
            noPlaylist: true,
            noCheckCertificates: true,
            noWarnings: true
        });

        const buffer = fs.readFileSync(filepath);
        return { title, buffer, path: filepath, id: filepath };

    } catch (e) {
        console.error("YouTube Fetch Error:", e);
        throw e;
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

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        title: "Sloverb Studio",
        icon: path.join(__dirname, '../public/logo.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs')
        }
    });

    const url = process.env.VITE_DEV_SERVER_URL;
    if (url) {
        win.loadURL(url);
        win.webContents.openDevTools();
    } else {
        // Note: this assumes standard vite build output to dist/index.html
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }
}

app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer');

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

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
