import { create } from 'zustand';

export const useLibraryStore = create((set, get) => ({
  // ── Library ──
  songs: [],
  playlists: [],
  history: [],
  playHistory: JSON.parse(localStorage.getItem('sloverb_play_history') || '[]'),
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
    return { playHistory: updated };
  }),
  clearPlayHistory: () => { localStorage.removeItem('sloverb_play_history'); set({ playHistory: [] }); },

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
