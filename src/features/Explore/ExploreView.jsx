import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '../../stores/playerStore';
import { useUIStore } from '../../stores/uiStore';
import { playbackEngine } from '../../lib/playbackEngine';
import { Compass, Search, Play, Loader, Video, TrendingUp, Sparkles } from 'lucide-react';

const TRENDING_QUERIES = [
  'Lofi hip hop beats',
  'Slowed and reverb songs 2025',
  'Chill R&B instrumentals',
  'Anime OST slowed',
  'Phonk bass boosted',
  'Ambient study music',
  'Bedroom pop vibes',
  'Jazz lo-fi chillhop',
];

export default function ExploreView() {
  const { addToast, setActiveView } = useUIStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleExploreSearch = async (query) => {
    const q = query || searchQuery.trim();
    if (!q) return;

    // For now, open YouTube search in a browser or convert to a YouTube URL
    // The proper implementation would use youtube-dl to search
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q + ' slowed reverb')}`;

    if (window.electronAPI) {
      // Use shell.openExternal via electron
      try {
        const { shell } = await import('electron');
      } catch {}
    }

    // Copy search URL to clipboard as a convenience, then navigate to Studio
    addToast(`Search: "${q}" — Paste a YouTube link into the Studio to load it`, 'info');
    setActiveView('studio');
  };

  const handleQuickLoad = async (query) => {
    addToast(`Tip: Search "${query}" on YouTube, then paste the link in Studio`, 'info');
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '24px 28px' }}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Explore</h2>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>Discover music to slow, reverb, and make your own</p>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', marginBottom: 32 }}>
          <Search size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleExploreSearch()}
            placeholder="Search for songs, artists, genres..."
            className="input"
            style={{
              width: '100%', paddingLeft: 48, paddingRight: 16, padding: '14px 16px 14px 48px',
              fontSize: 15, borderRadius: 14, background: 'var(--bg-surface)', border: '1px solid var(--glass-border)',
            }}
          />
        </div>

        {/* Trending / Suggestions */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <TrendingUp size={16} color="var(--accent)" />
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Trending Vibes</h3>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {TRENDING_QUERIES.map((q, i) => {
              const h = (q.charCodeAt(0) * 17 + i * 47) % 360;
              return (
                <motion.button key={q} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                  onClick={() => handleQuickLoad(q)}
                  style={{
                    padding: '10px 18px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                    background: `linear-gradient(135deg, hsla(${h}, 60%, 45%, 0.15), hsla(${h + 30}, 50%, 35%, 0.1))`,
                    color: `hsl(${h}, 70%, 70%)`,
                    border: `1px solid hsla(${h}, 50%, 50%, 0.2)`,
                    transition: 'all 0.2s', cursor: 'pointer',
                  }}
                >
                  {q}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Quick YouTube Import */}
        <div style={{
          padding: 24, borderRadius: 16, background: 'var(--bg-surface)', border: '1px solid var(--glass-border)',
          marginBottom: 32,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Video size={20} color="#f00" />
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Quick YouTube Import</h3>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '0 0 14px', lineHeight: 1.6 }}>
            Found something on YouTube? Paste the link below to instantly download and load it into the Studio with your effects.
          </p>
          <QuickYouTubeInput />
        </div>

        {/* Genre Cards */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Sparkles size={16} color="var(--accent)" />
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Genres to Explore</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {['Lo-Fi', 'R&B', 'Phonk', 'Anime OST', 'Jazz', 'Ambient', 'Trap', 'Soul', 'Classical', 'Bedroom Pop', 'Indie', 'Synthwave'].map((genre, i) => {
              const h = (genre.charCodeAt(0) * 23 + i * 31) % 360;
              return (
                <motion.div key={genre} whileHover={{ y: -3, scale: 1.03 }}
                  onClick={() => handleQuickLoad(genre + ' music')}
                  style={{
                    padding: '20px 16px', borderRadius: 12, cursor: 'pointer',
                    background: `linear-gradient(150deg, hsl(${h}, 55%, 45%), hsl(${(h + 50) % 360}, 50%, 30%))`,
                    position: 'relative', overflow: 'hidden',
                  }}
                >
                  <div style={{ position: 'absolute', top: -10, right: -10, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff', position: 'relative', zIndex: 1 }}>{genre}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function QuickYouTubeInput() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const { addToast, setActiveView } = useUIStore();

  const handleLoad = async () => {
    if (!url.trim() || !window.electronAPI) return;
    setLoading(true);
    addToast('Fetching from YouTube...', 'info');

    const progressHandler = (event, msg) => addToast(msg, 'info');
    if (window.electronAPI.onYoutubeProgress) window.electronAPI.onYoutubeProgress(progressHandler);

    try {
      const results = await window.electronAPI.fetchYoutube(url.trim());
      if (!results || results.length === 0) throw new Error("No media found");

      // Save ALL tracks to library
      for (let i = 0; i < results.length; i++) {
          const item = results[i];
          await window.electronAPI.addToLibrary({
              id: item.id || item.path || Date.now().toString() + i,
              name: item.title,
              title: item.title,
              path: item.path,
              type: 'audio',
              artist: item.artist || 'YouTube',
              duration: 0,
              timestamp: Date.now()
          });
      }

      // Play first track
      const result = results[0];
      const rawBuffer = await window.electronAPI.readFile(result.path);
      const ext = (result.path || '').split('.').pop()?.toLowerCase() || 'webm';
      const mimeMap = { mp3: 'audio/mpeg', m4a: 'audio/mp4', webm: 'audio/webm', ogg: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav' };
      const mime = mimeMap[ext] || 'audio/webm';
      
      const file = new File([rawBuffer], `${result.title}.${ext}`, { type: mime });
      file.path = result.path;
      
      usePlayerStore.getState().setFileName(result.title);
      playbackEngine.loadFileAndPlay(file, { name: result.title, path: result.path, id: result.id, artist: result.artist || 'YouTube', type: 'youtube' });
      
      // Queue the rest
      if (results.length > 1) {
        const queue = results.slice(1).map(r => ({ type: 'library', name: r.title, path: r.path, id: r.id, artist: r.artist || 'YouTube' }));
        usePlayerStore.getState().setQueue([...usePlayerStore.getState().queue, ...queue]);
      }
      
      setActiveView('studio');
      addToast(`Playing: ${result.title} (${results.length} saved to Library)`, 'success');

      setUrl('');
    } catch (e) {
      addToast(e?.message || 'Failed to fetch from YouTube', 'error');
    } finally {
      setLoading(false);
      if (window.electronAPI.offYoutubeProgress) window.electronAPI.offYoutubeProgress(progressHandler);
    }
  };

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input value={url} onChange={e => setUrl(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleLoad()}
        placeholder="https://youtube.com/watch?v=..."
        className="input" style={{ flex: 1 }}
        disabled={loading}
      />
      <button onClick={handleLoad} className="btn btn-primary" style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 6 }}
        disabled={loading}>
        {loading ? <Loader size={14} className="spin" /> : <Play size={14} />}
        {loading ? 'Loading...' : 'Load'}
      </button>
    </div>
  );
}
