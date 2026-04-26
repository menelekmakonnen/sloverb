import { useEffect } from 'react';
import AppShell from './components/Layout/AppShell';
import { useUIStore } from './stores/uiStore';
import { useLibraryStore } from './stores/libraryStore';
import { usePlayerStore } from './stores/playerStore';

function App() {
  const { theme, mode } = useUIStore();
  const { loadFromDisk } = useLibraryStore();

  // Apply theme + mode on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-mode', mode);
    if (theme && theme !== 'violet') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [theme, mode]);

  // Load persisted data on mount
  useEffect(() => {
    const init = async () => {
      const result = await loadFromDisk();
      if (result?.savedPresets) {
        usePlayerStore.getState().setSavedPresets(result.savedPresets);
      }
    };
    init();

    if (window.electronAPI) {
      window.electronAPI.onMediaPlayPause(() => {
        import('./lib/playbackEngine').then(({ playbackEngine }) => playbackEngine.togglePlay());
      });
      window.electronAPI.onMediaNext(() => {
        import('./lib/playbackEngine').then(({ playbackEngine }) => playbackEngine.playNext());
      });

      window.electronAPI.onOpenFile(async (event, filePath) => {
        const filename = filePath.split('\\').pop().split('/').pop();
        const ext = filename.split('.').pop().toLowerCase();
        const isVideo = ext === 'mp4';
        const buf = await window.electronAPI.readFile(filePath);
        const f = new File([buf], filename, { type: isVideo ? 'video/mp4' : `audio/${ext === 'wav' ? 'wav' : 'mpeg'}` });
        f.path = filePath;
        // Set UI to Studio
        useUIStore.getState().setActiveView('studio');
        // Set player metadata
        const trackInfo = { name: filename, path: filePath, type: isVideo ? 'video' : 'raw', artist: 'Unknown Artist', album: 'Opened File' };
        usePlayerStore.getState().setFileName(filename);
        usePlayerStore.getState().setTrack(trackInfo);
        // Load and play
        import('./lib/playbackEngine').then(({ playbackEngine }) => {
           playbackEngine.loadFileAndPlay(f, trackInfo);
        });
        // Auto-add to library
        try {
          await window.electronAPI.addToLibrary({ id: filePath, name: filename, path: filePath, type: isVideo ? 'video' : 'raw', timestamp: Date.now() });
        } catch {}
      });

      // Periodically update Discord RPC
      const iv = setInterval(() => {
        const state = usePlayerStore.getState();
        if (!state.isPlaying || !state.fileName) return;
        window.electronAPI.setDiscordActivity({
          details: state.currentTrack?.name || state.fileName,
          state: `Speed: ${state.params.speed}x • Reverb: ${(state.params.reverbMix * 100).toFixed(0)}%`,
          startTimestamp: Math.floor(Date.now() / 1000) - Math.floor(state.currentTime)
        });
      }, 5000);

      return () => {
        window.electronAPI.removeMediaListeners();
        clearInterval(iv);
      };
    }
  }, []);

  return <AppShell />;
}

export default App;
