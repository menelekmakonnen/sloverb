import { create } from 'zustand';
import { PRESETS } from '../lib/audioEngine.js';

export const usePlayerStore = create((set, get) => ({
  // ── Track State ──
  currentTrack: null, // { id, name, path, artist, album, type, timestamp }
  audioBuffer: null,
  fileName: '',
  albumArt: null,
  isVideo: false,
  originalVideoFile: null,

  // ── Playback State ──
  isPlaying: false,
  currentTime: 0,
  analyserRef: { current: null },
  isProcessing: false,
  loadingText: 'Loading...',
  progress: 0,
  masterVolume: parseFloat(localStorage.getItem('sloverb_volume')) || 0.9,
  repeatMode: 0, // 0 = off, 1 = playlist, 2 = track
  isShuffle: false,
  autoPlay: localStorage.getItem('sloverb_autoplay') !== 'false',

  // ── Effect Parameters ──
  params: PRESETS["Slowed + Reverb"],
  activePresets: ["Slowed + Reverb"],
  savedPresets: {},

  // ── Queue ──
  queue: [],
  currentQueueIndex: -1,
  playbackContext: { type: 'library', playlistId: null },

  // ── Export ──
  isExporting: false,
  exportProgress: 0,
  exportDone: false,

  // ── YouTube ──
  youtubeUrl: '',
  downloadHistory: JSON.parse(localStorage.getItem('sloverb_dl_history') || '[]'),
  activeDownloads: [], // { id, title, status: 'downloading'|'merging'|'done'|'error', progress, timestamp }

  // ── Streaming ──
  isStreaming: false,
  streamTrack: null, // { id, title, channel, duration, thumbnail, url }

  // ── YouTube Browser Connection ──
  ytBrowser: { connected: false, browser: null },
  streamHistory: JSON.parse(localStorage.getItem('sloverb_stream_history') || '[]'),
  ytPlaylists: [],

  // ── Actions ──
  loadYtPlaylists: async () => {
    if (window.electronAPI) {
      try {
        console.log('[Store] Loading YT playlists...');
        const p = await window.electronAPI.ytGetMyPlaylists();
        console.log('[Store] YT playlists result:', p?.length || 0, 'items');
        if (p && p.length > 0) set({ ytPlaylists: p });
      } catch (e) {
        console.error('[Store] loadYtPlaylists error:', e);
      }
    }
  },

  setTrack: (track) => set({ currentTrack: track }),
  setAudioBuffer: (buf) => set({ audioBuffer: buf }),
  setFileName: (name) => set({ fileName: name }),
  setAlbumArt: (art) => set({ albumArt: art }),
  setIsVideo: (v) => set({ isVideo: v }),
  setOriginalVideoFile: (f) => set({ originalVideoFile: f }),
  setIsPlaying: (v) => set({ isPlaying: v }),
  setCurrentTime: (t) => set({ currentTime: t }),
  setIsProcessing: (v) => set({ isProcessing: v }),
  setLoadingText: (t) => set({ loadingText: t }),
  setProgress: (p) => set({ progress: p }),
  setMasterVolume: (v) => {
    localStorage.setItem('sloverb_volume', v);
    set({ masterVolume: v });
  },
  toggleRepeat: () => set(s => ({ repeatMode: (s.repeatMode + 1) % 3 })),
  toggleShuffle: () => set(s => ({ isShuffle: !s.isShuffle })),
  toggleAutoPlay: () => set(s => {
    const next = !s.autoPlay;
    localStorage.setItem('sloverb_autoplay', next);
    return { autoPlay: next };
  }),
  
  setParams: (p) => set({ params: p }),
  setParam: (key, val) => set(s => ({
    params: { ...s.params, [key]: val },
    activePresets: ['Custom']
  })),
  setActivePresets: (p) => set({ activePresets: p }),
  setSavedPresets: (p) => set({ savedPresets: p }),

  setQueue: (q) => set({ queue: q }),
  addToQueue: (item) => set(s => ({ queue: [...s.queue, item] })),
  removeFromQueue: (index) => set(s => ({
    queue: s.queue.filter((_, i) => i !== index)
  })),
  clearQueue: () => set({ queue: [] }),
  setCurrentQueueIndex: (i) => set({ currentQueueIndex: i }),
  setPlaybackContext: (ctx) => set({ playbackContext: ctx }),

  addActiveDownload: (dl) => set(s => ({ activeDownloads: [...s.activeDownloads, dl] })),
  updateActiveDownload: (id, update) => set(s => ({
    activeDownloads: s.activeDownloads.map(d => d.id === id ? { ...d, ...update } : d)
  })),
  removeActiveDownload: (id) => set(s => ({
    activeDownloads: s.activeDownloads.filter(d => d.id !== id)
  })),
  addToDownloadHistory: (item) => set(s => {
    const history = [item, ...s.downloadHistory].slice(0, 100);
    localStorage.setItem('sloverb_dl_history', JSON.stringify(history));
    return { downloadHistory: history };
  }),
  clearDownloadHistory: () => {
    localStorage.removeItem('sloverb_dl_history');
    set({ downloadHistory: [] });
  },

  setIsExporting: (v) => set({ isExporting: v }),
  setExportProgress: (p) => set({ exportProgress: p }),
  setExportDone: (v) => set({ exportDone: v }),
  setYoutubeUrl: (u) => set({ youtubeUrl: u }),
  setIsStreaming: (v) => set({ isStreaming: v }),
  setStreamTrack: (t) => set({ streamTrack: t }),
  setYtBrowser: (b) => set({ ytBrowser: b }),
  addToStreamHistory: (track) => set(s => {
    const exists = s.streamHistory.find(t => t.id === track.id);
    const filtered = exists ? s.streamHistory.filter(t => t.id !== track.id) : s.streamHistory;
    const history = [{ ...track, playedAt: Date.now() }, ...filtered].slice(0, 50);
    localStorage.setItem('sloverb_stream_history', JSON.stringify(history));
    return { streamHistory: history };
  }),

  // ── Preset Logic ──
  applyPreset: (name, isMultiSelect) => {
    const state = get();
    const allPresets = { ...PRESETS, ...state.savedPresets };
    let newPresets = [...state.activePresets];

    if (!isMultiSelect) {
      newPresets = [name];
    } else {
      if (name === "Original" || name === "Custom") {
        newPresets = [name];
      } else {
        if (newPresets.includes("Original") || newPresets.includes("Custom")) newPresets = [];
        if (newPresets.includes(name)) {
          newPresets = newPresets.filter(n => n !== name);
          if (newPresets.length === 0) newPresets = ["Original"];
        } else {
          newPresets.push(name);
        }
      }
    }

    set({ activePresets: newPresets });
    if (newPresets.includes("Custom")) return;

    if (newPresets.length === 1) {
      if (allPresets[newPresets[0]]) set({ params: allPresets[newPresets[0]] });
    } else {
      const combined = {};
      const keys = Object.keys(PRESETS["Original"]);
      for (let key of keys) {
        let sum = 0;
        newPresets.forEach(presetName => {
          sum += parseFloat(allPresets[presetName]?.[key]) || 0;
        });
        combined[key] = parseFloat((sum / newPresets.length).toFixed(4));
      }
      set({ params: combined });
    }
  },
}));
