import { create } from 'zustand';

/* ── Play Stats persistence helpers ── */
function loadPlayStats() {
  try { return JSON.parse(localStorage.getItem('sloverb_play_stats') || '{}'); } catch { return {}; }
}
function savePlayStats(stats) {
  try { localStorage.setItem('sloverb_play_stats', JSON.stringify(stats)); } catch {}
}

export const useLibraryStore = create((set, get) => ({
  // ── Library ──
  songs: [],
  playlists: [],
  history: [],
  playHistory: JSON.parse(localStorage.getItem('sloverb_play_history') || '[]'),
  playStats: loadPlayStats(), // { [songId]: { playCount, totalListenTime, lastPlayedAt, firstPlayedAt, name, artist, album, path } }
  sortBy: 'dateDesc',
  searchQuery: '',
  
  // ── Actions ──
  setSongs: (songs) => set({ songs }),
  setPlaylists: (playlists) => set({ playlists }),
  setHistory: (history) => set({ history }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  addPlayToHistory: (track) => set(s => {
    const entry = { name: track.name, path: track.path || track.id, artist: track.artist, album: track.album, playedAt: Date.now() };
    const updated = [entry, ...s.playHistory].slice(0, 500); // Keep last 500
    try { localStorage.setItem('sloverb_play_history', JSON.stringify(updated)); } catch {}

    // Also update playStats
    const id = track.path || track.id;
    const stats = { ...s.playStats };
    if (!stats[id]) {
      stats[id] = { playCount: 0, totalListenTime: 0, lastPlayedAt: 0, firstPlayedAt: Date.now(), name: track.name, artist: track.artist, album: track.album, path: id };
    }
    stats[id].playCount += 1;
    stats[id].lastPlayedAt = Date.now();
    stats[id].name = track.name || stats[id].name;
    stats[id].artist = track.artist || stats[id].artist;
    stats[id].album = track.album || stats[id].album;
    savePlayStats(stats);

    return { playHistory: updated, playStats: stats };
  }),

  recordListenTime: (songId, seconds) => set(s => {
    if (!songId || !seconds || seconds < 1) return s;
    const stats = { ...s.playStats };
    if (!stats[songId]) {
      stats[songId] = { playCount: 0, totalListenTime: 0, lastPlayedAt: Date.now(), firstPlayedAt: Date.now(), name: '', artist: '', album: '', path: songId };
    }
    stats[songId].totalListenTime += seconds;
    savePlayStats(stats);
    return { playStats: stats };
  }),

  clearPlayHistory: () => {
    localStorage.removeItem('sloverb_play_history');
    set({ playHistory: [] });
  },

  // ── Computed: Top Songs ──
  getTopSongs: (n = 15, period = null) => {
    const { playStats } = get();
    let entries = Object.entries(playStats);
    if (period) {
      const cutoff = Date.now() - period;
      entries = entries.filter(([, s]) => s.lastPlayedAt > cutoff);
    }
    return entries
      .sort((a, b) => b[1].playCount - a[1].playCount)
      .slice(0, n)
      .map(([id, s]) => ({ id, ...s }));
  },

  // ── Computed: Top Artists ──
  getTopArtists: (n = 10, period = null) => {
    const { playStats } = get();
    const artistMap = {};
    Object.values(playStats).forEach(s => {
      if (period && s.lastPlayedAt < Date.now() - period) return;
      const artist = s.artist || 'Unknown Artist';
      if (artist === 'Unknown Artist' || artist === 'Unknown') return;
      if (!artistMap[artist]) artistMap[artist] = { artist, playCount: 0, totalListenTime: 0, songs: 0 };
      artistMap[artist].playCount += s.playCount;
      artistMap[artist].totalListenTime += s.totalListenTime;
      artistMap[artist].songs += 1;
    });
    return Object.values(artistMap)
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, n);
  },

  // ── Computed: Recap ──
  getRecap: (periodMs = 7 * 24 * 60 * 60 * 1000) => {
    const { playStats, playHistory } = get();
    const cutoff = Date.now() - periodMs;
    const recentPlays = playHistory.filter(p => p.playedAt > cutoff);
    let totalListenTime = 0;
    const artistCounts = {};
    Object.values(playStats).forEach(s => {
      if (s.lastPlayedAt > cutoff) {
        totalListenTime += s.totalListenTime;
      }
    });
    recentPlays.forEach(p => {
      const a = p.artist;
      if (!a || a === 'Unknown Artist' || a === 'Unknown') return;
      artistCounts[a] = (artistCounts[a] || 0) + 1;
    });
    const topArtist = Object.entries(artistCounts).sort((a, b) => b[1] - a[1])[0];
    return {
      totalPlays: recentPlays.length,
      totalListenTime,
      topArtist: topArtist ? topArtist[0] : null,
      topArtistPlays: topArtist ? topArtist[1] : 0,
      uniqueTracks: new Set(recentPlays.map(p => p.name)).size,
      uniqueArtists: new Set(recentPlays.map(p => p.artist).filter(Boolean)).size,
    };
  },

  addSong: (song) => set(s => {
    if (s.songs.find(i => i.id === song.id)) return s;
    return { songs: [song, ...s.songs] };
  }),

  removeSong: (id) => set(s => ({
    songs: s.songs.filter(i => i.id !== id),
    playlists: s.playlists.map(p => ({
      ...p,
      itemIds: p.itemIds.filter(itemId => itemId !== id)
    }))
  })),

  addPlaylist: (playlist) => set(s => ({
    playlists: [...s.playlists, playlist]
  })),

  removePlaylist: (id) => set(s => ({
    playlists: s.playlists.filter(p => p.id !== id)
  })),

  addToPlaylist: (playlistId, songId) => set(s => ({
    playlists: s.playlists.map(p => {
      if (p.id === playlistId && !p.itemIds.includes(songId)) {
        return { ...p, itemIds: [...p.itemIds, songId] };
      }
      return p;
    })
  })),

  removeFromPlaylist: (playlistId, index) => set(s => ({
    playlists: s.playlists.map(p => {
      if (p.id === playlistId) {
        const itemIds = [...p.itemIds];
        itemIds.splice(index, 1);
        return { ...p, itemIds };
      }
      return p;
    })
  })),

  // ── Sorted Library ──
  getSortedSongs: () => {
    const { songs, sortBy, searchQuery } = get();
    let sorted = [...songs];
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      sorted = sorted.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.artist || '').toLowerCase().includes(q) ||
        (s.album || '').toLowerCase().includes(q)
      );
    }
    
    if (sortBy === 'dateDesc') sorted.sort((a, b) => b.timestamp - a.timestamp);
    if (sortBy === 'dateAsc') sorted.sort((a, b) => a.timestamp - b.timestamp);
    if (sortBy === 'titleAsc') sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (sortBy === 'titleDesc') sorted.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
    if (sortBy === 'artistAsc') sorted.sort((a, b) => (a.artist || 'Unknown').localeCompare(b.artist || 'Unknown'));
    if (sortBy === 'albumAsc') sorted.sort((a, b) => (a.album || 'Unknown').localeCompare(b.album || 'Unknown'));
    if (sortBy === 'random') {
      for (let i = sorted.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
      }
    }
    return sorted;
  },

  // ── Persistence ──
  loadFromDisk: async () => {
    if (!window.electronAPI) return;
    try {
      const presets = await window.electronAPI.loadPresets();
      const hist = await window.electronAPI.getGenerations();
      const libData = await window.electronAPI.loadLibrary();
      set({
        history: hist || [],
        songs: libData?.songs || [],
        playlists: libData?.playlists || [],
      });
      return { savedPresets: presets || {} };
    } catch (e) {
      console.error('Failed to load from disk:', e);
      return { savedPresets: {} };
    }
  },

  saveToDisk: async () => {
    const { songs, playlists } = get();
    if (window.electronAPI) {
      await window.electronAPI.saveLibrary({ songs, playlists });
    }
  },
}));
