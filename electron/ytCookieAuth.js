// YouTube Session Login for Sloverb
// Opens YouTube in an Electron BrowserWindow, user signs in,
// we export the session cookies to a file yt-dlp can read.
// No API keys, no browser locking issues.
import path from 'path';
import fs from 'fs';
import { ipcMain, BrowserWindow, session } from 'electron';

export function setupYtCookieHandlers(app, youtubedl, { getYtDlpPath, ffmpegDir, activeStreamProcsRef }) {
    const cookiesPath = path.join(app.getPath('userData'), 'yt-cookies.txt');
    const ytPrefPath = path.join(app.getPath('userData'), 'yt-session.json');

    function loadPref() {
        if (!fs.existsSync(ytPrefPath)) return null;
        try { return JSON.parse(fs.readFileSync(ytPrefPath, 'utf8')); }
        catch { return null; }
    }
    function savePref(data) {
        fs.writeFileSync(ytPrefPath, JSON.stringify(data, null, 2), 'utf8');
    }

    // Convert Electron cookies to Netscape cookies.txt format
    function writeCookiesTxt(cookies) {
        const lines = ['# Netscape HTTP Cookie File', '# https://curl.se/docs/http-cookies.html', ''];
        for (const c of cookies) {
            let domain = c.domain || '';
            let includeSubdomains = domain.startsWith('.') ? 'TRUE' : 'FALSE';

            // __Host- cookies must NOT have a . domain prefix
            if (c.name.startsWith('__Host-')) {
                domain = domain.replace(/^\./, '');
                includeSubdomains = 'FALSE';
            }

            const httpOnlyPrefix = c.httpOnly ? '#HttpOnly_' : '';
            const secure = c.secure ? 'TRUE' : 'FALSE';
            const expiry = c.expirationDate ? String(Math.floor(c.expirationDate)) : '0';
            const path = c.path || '/';
            const name = c.name || '';
            const value = c.value || '';

            lines.push(`${httpOnlyPrefix}${domain}\t${includeSubdomains}\t${path}\t${secure}\t${expiry}\t${name}\t${value}`);
        }
        fs.writeFileSync(cookiesPath, lines.join('\n') + '\n', 'utf8');
    }

    // Export YouTube cookies from the yt-login session partition
    async function exportCookies() {
        const ses = session.fromPartition('persist:youtube');
        const cookies = await ses.cookies.get({});
        const ytCookies = cookies.filter(c =>
            c.domain.includes('youtube.com') ||
            c.domain.includes('google.com') ||
            c.domain.includes('googleapis.com')
        );
        writeCookiesTxt(ytCookies);
        console.log(`[YT Session] Exported ${ytCookies.length} cookies`);
        return ytCookies.length > 0;
    }

    // Check if we have a valid session
    async function hasValidSession() {
        const ses = session.fromPartition('persist:youtube');
        const cookies = await ses.cookies.get({ domain: '.youtube.com' });
        // Check for key auth cookies (SID, SSID, HSID, etc.)
        const authCookies = cookies.filter(c =>
            ['SID', 'SSID', 'HSID', 'APISID', 'SAPISID', 'LOGIN_INFO'].includes(c.name)
        );
        return authCookies.length >= 3;
    }

    // yt-dlp helper with cookies file
    async function ytdlpWithCookies(url, extraOpts = {}) {
        if (!fs.existsSync(cookiesPath)) throw new Error('Not logged in');
        return youtubedl(url, {
            cookies: cookiesPath,
            noCheckCertificates: true,
            noWarnings: true,
            skipDownload: true,
            ignoreErrors: true,
            ...extraOpts,
        });
    }

    // ── Login: Open YouTube in a BrowserWindow ──
    ipcMain.handle('yt-login', async () => {
        return new Promise((resolve, reject) => {
            const authWin = new BrowserWindow({
                width: 460,
                height: 700,
                title: 'Sign in to YouTube',
                autoHideMenuBar: true,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    partition: 'persist:youtube', // Persistent session just for YT
                },
            });

            authWin.loadURL('https://accounts.google.com/ServiceLogin?service=youtube&continue=https://www.youtube.com');

            let checkInterval = null;
            let resolved = false;

            // Poll for successful login by checking cookies
            checkInterval = setInterval(async () => {
                try {
                    const url = authWin.webContents.getURL();
                    const loggedIn = await hasValidSession();

                    if (loggedIn && (url.includes('youtube.com') || url.includes('myaccount.google'))) {
                        clearInterval(checkInterval);
                        if (resolved) return;
                        resolved = true;

                        // Export cookies for yt-dlp
                        await exportCookies();

                        // Try to get user name from the page
                        let userName = 'YouTube User';
                        try {
                            const ses = session.fromPartition('persist:youtube');
                            const loginCookies = await ses.cookies.get({ name: 'LOGIN_INFO' });
                            if (loginCookies.length > 0) userName = 'Connected';
                        } catch {}

                        savePref({ loggedIn: true, userName, connectedAt: Date.now() });
                        console.log('[YT Session] Login successful');

                        setTimeout(() => {
                            if (!authWin.isDestroyed()) authWin.close();
                        }, 800);

                        resolve({ connected: true, userName });
                    }
                } catch {}
            }, 1500);

            authWin.on('closed', () => {
                clearInterval(checkInterval);
                if (!resolved) {
                    resolved = true;
                    resolve({ connected: false, cancelled: true });
                }
            });
        });
    });

    // ── Logout ──
    ipcMain.handle('yt-disconnect', async () => {
        // Clear the YouTube session
        const ses = session.fromPartition('persist:youtube');
        await ses.clearStorageData();
        await ses.clearCache();
        if (fs.existsSync(cookiesPath)) fs.unlinkSync(cookiesPath);
        if (fs.existsSync(ytPrefPath)) fs.unlinkSync(ytPrefPath);
        console.log('[YT Session] Logged out');
        return { connected: false };
    });

    // ── Connection status ──
    ipcMain.handle('yt-connection-status', async () => {
        const pref = loadPref();
        if (!pref?.loggedIn) return { connected: false };
        // Verify cookies still exist
        const valid = await hasValidSession();
        if (!valid) return { connected: false };
        // Re-export cookies (they may have refreshed)
        await exportCookies();
        return { connected: true, userName: pref.userName || 'YouTube User' };
    });

    // ── Liked Videos ──
    ipcMain.handle('yt-get-liked-videos', async () => {
        await exportCookies(); // refresh cookies before API call
        const data = await ytdlpWithCookies('https://www.youtube.com/playlist?list=LL', {
            dumpSingleJson: true,
            flatPlaylist: true,
            playlistItems: '1-100',
        });
        return (data?.entries || []).filter(Boolean).map(e => ({
            id: e.id,
            title: e.title || e.url || 'Unknown',
            channel: e.channel || e.uploader || 'Unknown',
            duration: e.duration || 0,
            thumbnail: e.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${e.id}/hqdefault.jpg`,
            url: e.url || e.webpage_url || `https://www.youtube.com/watch?v=${e.id}`,
        }));
    });

    // ── Get My Playlists ──
    ipcMain.handle('yt-get-my-playlists', async () => {
        try {
            const valid = await hasValidSession();
            if (!valid) {
                console.log('[YT Playlists] No valid session');
                return [];
            }
            await exportCookies();
            console.log('[YT Playlists] Starting fetch...');

            // Strategy 1: Use yt-dlp to list playlists from the library feed
            // yt-dlp can extract playlist entries from the user's library page
            const { execFile } = require('child_process');
            const ytdlpPath = getYtDlpPath();

            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    console.error('[YT Playlists] Timed out after 30s');
                    resolve([]);
                }, 30000);

                // Use yt-dlp --flat-playlist to extract playlist URLs from the library
                const args = [
                    '--cookies', cookiesPath,
                    '--flat-playlist',
                    '--dump-json',
                    '--no-warnings',
                    '--ignore-errors',
                    'https://www.youtube.com/feed/playlists'
                ];

                console.log('[YT Playlists] Running yt-dlp with args:', args.join(' '));
                
                let stdout = '';
                let stderr = '';
                const proc = execFile(ytdlpPath, args, { maxBuffer: 10 * 1024 * 1024 }, (err, out, errOut) => {
                    clearTimeout(timeout);
                    stdout = out || '';
                    stderr = errOut || '';

                    if (err) {
                        console.error('[YT Playlists] yt-dlp error:', err.message);
                        console.error('[YT Playlists] stderr:', stderr.substring(0, 500));
                    }

                    // Parse JSON lines output
                    const playlists = [];
                    const seen = new Set();
                    const lines = stdout.split('\n').filter(l => l.trim());

                    for (const line of lines) {
                        try {
                            const item = JSON.parse(line);
                            // yt-dlp returns playlist entries with _type: 'playlist' or _type: 'url'
                            const id = item.id || item.playlist_id || '';
                            const title = item.title || item.playlist_title || 'Unknown';
                            const count = item.playlist_count || item.n_entries || 0;
                            const thumbnail = item.thumbnails?.[0]?.url || item.thumbnail || '';

                            if (id && !seen.has(id) && id !== 'WL' && id !== 'LL') {
                                seen.add(id);
                                playlists.push({
                                    id,
                                    title,
                                    count,
                                    url: `https://www.youtube.com/playlist?list=${id}`,
                                    thumbnail,
                                });
                            }
                        } catch (parseErr) {
                            // Skip unparseable lines
                        }
                    }

                    console.log(`[YT Playlists] Found ${playlists.length} playlists from yt-dlp`);

                    if (playlists.length > 0) {
                        resolve(playlists);
                    } else {
                        // Strategy 2: Try the library/playlists page directly
                        console.log('[YT Playlists] Strategy 1 returned 0, trying library page...');
                        const args2 = [
                            '--cookies', cookiesPath,
                            '--flat-playlist',
                            '--dump-json',
                            '--no-warnings',
                            '--ignore-errors',
                            'https://www.youtube.com/feed/library'
                        ];

                        execFile(ytdlpPath, args2, { maxBuffer: 10 * 1024 * 1024 }, (err2, out2) => {
                            const playlists2 = [];
                            const lines2 = (out2 || '').split('\n').filter(l => l.trim());

                            for (const line of lines2) {
                                try {
                                    const item = JSON.parse(line);
                                    const id = item.id || item.playlist_id || '';
                                    const title = item.title || item.playlist_title || 'Unknown';
                                    const count = item.playlist_count || item.n_entries || 0;
                                    const thumbnail = item.thumbnails?.[0]?.url || item.thumbnail || '';

                                    if (id && !seen.has(id) && id !== 'WL' && id !== 'LL') {
                                        seen.add(id);
                                        playlists2.push({
                                            id,
                                            title,
                                            count,
                                            url: `https://www.youtube.com/playlist?list=${id}`,
                                            thumbnail,
                                        });
                                    }
                                } catch {}
                            }

                            console.log(`[YT Playlists] Strategy 2 found ${playlists2.length} playlists`);
                            resolve(playlists2);
                        });
                    }
                });
            });
        } catch (e) {
            console.error('[YT Playlists] Error:', e);
            return [];
        }
    });

    // ── Get Playlist Items ──
    ipcMain.handle('yt-get-playlist-items', async (event, playlistUrl) => {
        await exportCookies();
        let targetUrl = playlistUrl;
        if (playlistUrl.includes('list=')) {
            const match = playlistUrl.match(/[?&]list=([^&]+)/);
            if (match) targetUrl = `https://www.youtube.com/playlist?list=${match[1]}`;
        } else if (!playlistUrl.startsWith('http')) {
            targetUrl = `https://www.youtube.com/playlist?list=${playlistUrl}`;
        }
        
        // Strip any remaining & to prevent shell injection errors
        targetUrl = targetUrl.split('&')[0];
        
        const data = await ytdlpWithCookies(targetUrl, {
            dumpSingleJson: true,
            flatPlaylist: true,
            playlistItems: '1-200',
        });
        return {
            title: data?.title || 'Playlist',
            items: (data?.entries || []).filter(Boolean).map(e => ({
                id: e.id,
                title: e.title || e.url || 'Unknown',
                channel: e.channel || e.uploader || 'Unknown',
                duration: e.duration || 0,
                thumbnail: e.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${e.id}/hqdefault.jpg`,
                url: e.url || e.webpage_url || `https://www.youtube.com/watch?v=${e.id}`,
            })),
        };
    });

    // ── Authenticated stream ──
    ipcMain.handle('yt-stream-start-auth', async (event, url) => {
        await exportCookies();
        const procs = activeStreamProcsRef;

        if (procs.current) {
            try { procs.current.ytdlp?.kill('SIGKILL'); } catch {}
            try { procs.current.ffmpeg?.kill('SIGKILL'); } catch {}
            procs.current = null;
        }

        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win) throw new Error('No window');

        const { spawn } = await import('child_process');
        const ytdlpBin = getYtDlpPath();
        const ffmpegBin = ffmpegDir ? path.join(ffmpegDir, 'ffmpeg.exe') : 'ffmpeg';
        const cookieArgs = fs.existsSync(cookiesPath) ? ['--cookies', cookiesPath] : [];

        return new Promise((resolve, reject) => {
            const ytdlp = spawn(ytdlpBin, [
                '-f', 'bestaudio', '-o', '-', '--no-playlist',
                '--no-check-certificates', '--no-warnings',
                ...cookieArgs, url,
            ]);
            const ffmpeg = spawn(ffmpegBin, [
                '-i', 'pipe:0', '-f', 's16le', '-ar', '44100', '-ac', '2',
                '-loglevel', 'error', 'pipe:1',
            ]);

            procs.current = { ytdlp, ffmpeg };
            ytdlp.stdout.pipe(ffmpeg.stdin);

            let resolved = false, totalBytes = 0;
            ffmpeg.stdout.on('data', (chunk) => {
                totalBytes += chunk.length;
                if (!resolved) { resolved = true; resolve({ ok: true }); }
                try {
                    if (win && !win.isDestroyed())
                        win.webContents.send('stream-chunk', new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
                } catch {}
            });
            ffmpeg.on('close', () => {
                procs.current = null;
                try { if (win && !win.isDestroyed()) win.webContents.send('stream-end'); } catch {}
                if (!resolved) { resolved = true; reject(new Error('No audio')); }
            });
            ytdlp.on('error', (err) => { if (!resolved) { resolved = true; reject(err); } });
            ffmpeg.on('error', (err) => { if (!resolved) { resolved = true; reject(err); } });
            ytdlp.stderr.on('data', (d) => { const m = d.toString().trim(); if (m) console.log('[Stream]', m); });
            ffmpeg.stderr.on('data', (d) => { const m = d.toString().trim(); if (m) console.error('[Stream]', m); });
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    try { ytdlp.kill('SIGKILL'); } catch {}
                    try { ffmpeg.kill('SIGKILL'); } catch {}
                    procs.current = null;
                    reject(new Error('Stream timeout'));
                }
            }, 15000);
        });
    });
}
