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
  masterVolume: 0.9,
  isRepeat: false,
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

  // ── Actions ──
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
  setMasterVolume: (v) => set({ masterVolume: v }),
  toggleRepeat: () => set(s => ({ isRepeat: !s.isRepeat })),
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

  setIsExporting: (v) => set({ isExporting: v }),
  setExportProgress: (p) => set({ exportProgress: p }),
  setExportDone: (v) => set({ exportDone: v }),
  setYoutubeUrl: (u) => set({ youtubeUrl: u }),

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
