import { create } from 'zustand';

export const useUIStore = create((set, get) => ({
  activeView: 'studio', // 'home' | 'studio' | 'library' | 'playlists' | 'artists' | 'albums' | 'history' | 'settings'
  sidebarCollapsed: false,
  queueDrawerOpen: false,
  toggleQueueDrawer: () => set(s => ({ queueDrawerOpen: !s.queueDrawerOpen })),
  
  // ── Studio Drawer (NowPlayingBar pull-up) ──
  studioDrawerOpen: false,
  toggleStudioDrawer: () => set(s => ({ studioDrawerOpen: !s.studioDrawerOpen })),
  setStudioDrawerOpen: (v) => set({ studioDrawerOpen: v }),

  // ── Space Adventure (off | on | immersive) ──
  spaceAdventure: localStorage.getItem('sloverb_space_adventure') || 'on',
  cycleSpaceAdventure: () => set(s => {
    const modes = ['off', 'on', 'immersive'];
    const next = modes[(modes.indexOf(s.spaceAdventure) + 1) % 3];
    localStorage.setItem('sloverb_space_adventure', next);
    return { spaceAdventure: next };
  }),
  setSpaceAdventure: (v) => { localStorage.setItem('sloverb_space_adventure', v); set({ spaceAdventure: v }); },

  // ── Super Immersive ──
  superImmersive: localStorage.getItem('sloverb_super_immersive') === 'true',
  toggleSuperImmersive: () => set(s => {
    const next = !s.superImmersive;
    localStorage.setItem('sloverb_super_immersive', String(next));
    return { superImmersive: next };
  }),
  setSuperImmersive: (v) => {
    localStorage.setItem('sloverb_super_immersive', String(v));
    set({ superImmersive: v });
  },
  
  contextMenu: { isOpen: false, x: 0, y: 0, track: null, group: null },
  openContextMenu: (x, y, track, group = null) => set({ contextMenu: { isOpen: true, x, y, track, group } }),
  closeContextMenu: () => set(s => ({ contextMenu: { ...s.contextMenu, isOpen: false } })),
  
  // ── Theme ──
  theme: localStorage.getItem('sloverb_theme') || 'violet',
  mode: localStorage.getItem('sloverb_mode') || 'dark',
  
  // ── Background Theme ──
  backgroundTheme: localStorage.getItem('sloverb_bg_theme') || 'space', // 'space' | 'harmattan'
  setBackgroundTheme: (v) => { localStorage.setItem('sloverb_bg_theme', v); set({ backgroundTheme: v }); },
  cycleBackgroundTheme: () => set(s => {
    const themes = ['space', 'harmattan'];
    const next = themes[(themes.indexOf(s.backgroundTheme) + 1) % themes.length];
    localStorage.setItem('sloverb_bg_theme', next);
    return { backgroundTheme: next };
  }),
  
  // ── Panels ──
  lyricsVisible: false,
  
  // ── Toasts ──
  toasts: [],
  _toastId: 0,

  // ── Navigation Stack (infinite drill-down) ──
  navStack: [],
  pushNav: (view, params = {}) => set(s => {
    const current = {
      activeView: s.activeView,
      artistFilter: s.artistFilter,
      albumFilter: s.albumFilter,
      folderFilter: s.folderFilter,
      librarySubView: s.librarySubView,
      librarySubParams: s.librarySubParams,
    };
    return {
      navStack: [...s.navStack, current],
      activeView: view,
      ...params,
    };
  }),
  popNav: () => set(s => {
    if (s.navStack.length === 0) return s;
    const stack = [...s.navStack];
    const prev = stack.pop();
    return { navStack: stack, ...prev };
  }),

  // ── Library sub-views (for drill-down within Library page) ──
  librarySubView: null,    // null = hub, 'topSongs' | 'topArtists' | 'artistDetail' | 'albumDetail'
  librarySubParams: null,  // { artist, album, etc. }
  setLibrarySubView: (view, params = null) => set({ librarySubView: view, librarySubParams: params }),

  // ── Actions ──
  setActiveView: (view) => set({ activeView: view, librarySubView: null, librarySubParams: null }),
  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),

  // ── Sub-page filters ──
  artistFilter: null,
  albumFilter: null,
  folderFilter: null,
  setArtistFilter: (v) => set({ artistFilter: v }),
  setAlbumFilter: (v) => set({ albumFilter: v }),
  setFolderFilter: (v) => set({ folderFilter: v }),

  // ── Credits Modal ──
  creditsTrack: null,
  setCreditsTrack: (t) => set({ creditsTrack: t }),
  
  setTheme: (theme) => {
    localStorage.setItem('sloverb_theme', theme);
    document.documentElement.setAttribute('data-theme', theme === 'violet' ? '' : theme);
    set({ theme });
  },
  
  setMode: (mode) => {
    localStorage.setItem('sloverb_mode', mode);
    document.documentElement.setAttribute('data-mode', mode);
    set({ mode });
  },
  
  toggleMode: () => set(s => {
    const newMode = s.mode === 'dark' ? 'light' : 'dark';
    localStorage.setItem('sloverb_mode', newMode);
    document.documentElement.setAttribute('data-mode', newMode);
    return { mode: newMode };
  }),
  
  setQueueDrawerOpen: (v) => set({ queueDrawerOpen: v }),
  toggleLyrics: () => set(s => ({ lyricsVisible: !s.lyricsVisible })),

  addToast: (message, type = 'info') => set(s => {
    const id = s._toastId + 1;
    setTimeout(() => {
      set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    }, 4000);
    return {
      _toastId: id,
      toasts: [...s.toasts, { id, message, type }]
    };
  }),
  
  removeToast: (id) => set(s => ({
    toasts: s.toasts.filter(t => t.id !== id)
  })),
}));
