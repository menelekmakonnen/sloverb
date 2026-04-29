import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useLibraryStore } from '../../stores/libraryStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useUIStore } from '../../stores/uiStore';
import { playbackEngine } from '../../lib/playbackEngine';
import { Play, ArrowLeft, Grid3x3, List, Layers } from 'lucide-react';
import ArtThumb from '../../components/ArtThumb';
import FilterDrawer from '../../components/FilterDrawer';

/* ── Custom Folder SVG Icon ── */
function FolderSVG({ seed = '', size = 64 }) {
  const hash = (seed || 'x').split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const h1 = hash % 360;
  const h2 = (h1 + 40) % 360;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="folder-svg">
      <defs>
        <linearGradient id={`fg-${hash}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={`hsl(${h1}, 55%, 50%)`} />
          <stop offset="100%" stopColor={`hsl(${h2}, 50%, 35%)`} />
        </linearGradient>
      </defs>
      <rect x="4" y="16" width="56" height="40" rx="6" fill={`url(#fg-${hash})`} />
      <path d="M4 22V14a6 6 0 016-6h14l6 6h24a6 6 0 016 6v2H4z" fill={`hsl(${h1}, 50%, 55%)`} />
      <rect x="10" y="28" width="20" height="2" rx="1" fill="rgba(255,255,255,0.15)" />
      <rect x="10" y="34" width="14" height="2" rx="1" fill="rgba(255,255,255,0.1)" />
      <circle cx="48" cy="38" r="6" fill="rgba(255,255,255,0.08)" />
      <path d="M46 36l5 2.5-5 2.5z" fill="rgba(255,255,255,0.2)" />
      <style>{`
        .folder-svg { transition: transform 0.2s ease, filter 0.2s ease; }
        .folder-svg:hover { transform: scale(1.06); filter: brightness(1.1) drop-shadow(0 4px 12px rgba(0,0,0,0.3)); }
      `}</style>
    </svg>
  );
}

export default function FolderView() {
  const { songs } = useLibraryStore();
  const { addToast, folderFilter, setFolderFilter, setActiveView } = useUIStore();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('hierarchical-grid'); // 'grid' | 'hierarchical' | 'hierarchical-grid'

  // Build folder map
  const folderMap = useMemo(() => {
    const map = {};
    songs.forEach(s => {
      if (!s.path) return;
      const folder = s.path.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
      if (!map[folder]) map[folder] = [];
      map[folder].push(s);
    });
    return map;
  }, [songs]);

  // Build hierarchy
  const hierarchy = useMemo(() => {
    const folders = Object.keys(folderMap).sort();
    if (search) {
      const q = search.toLowerCase();
      return folders.filter(p => p.toLowerCase().includes(q));
    }
    return folders;
  }, [folderMap, search]);

  // Group by parent folder for hierarchical-grid
  const groupedFolders = useMemo(() => {
    const groups = {};
    hierarchy.forEach(f => {
      const parts = f.replace(/\\/g, '/').split('/').filter(Boolean);
      const parent = parts.length > 1 ? parts.slice(0, -1).join('/') : '/';
      if (!groups[parent]) groups[parent] = [];
      groups[parent].push(f);
    });
    return groups;
  }, [hierarchy]);

  const handlePlay = async (item) => {
    if (!window.electronAPI) return;
    try {
      const buf = await window.electronAPI.readFile(item.path || item.id);
      const f = new File([buf], item.name, { type: 'audio/wav' });
      f.path = item.path || item.id;
      playbackEngine.loadFileAndPlay(f, item);
    } catch { addToast('Failed to load track', 'error'); }
  };

  const handlePlayAll = (trackList) => {
    if (!trackList || trackList.length === 0) return;
    const [first, ...rest] = trackList;
    handlePlay(first);
    const queue = rest.map(s => ({ type: 'library', name: s.name, path: s.path, id: s.id, artist: s.artist, album: s.album }));
    usePlayerStore.getState().setQueue(queue);
  };

  // ── Folder detail view ──
  if (folderFilter) {
    const folderSongs = folderMap[folderFilter] || [];
    const folderName = folderFilter.split('/').filter(Boolean).pop() || folderFilter;

    return (
      <div style={{ height: '100%', overflow: 'auto', padding: '24px 28px', position: 'relative' }}>
        <FilterDrawer songs={folderSongs} onFilter={() => {}} onPlayAll={handlePlayAll} />
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <button onClick={() => setFolderFilter(null)} className="btn btn-ghost" style={{ padding: '6px 10px', borderRadius: 10 }}>
              <ArrowLeft size={16} />
            </button>
            <FolderSVG seed={folderName} size={44} />
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 2px', letterSpacing: '-0.02em' }}>{folderName}</h2>
              <p style={{ fontSize: 10, color: 'var(--text-dim)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 500 }}>{folderFilter}</p>
            </div>
            <button onClick={() => handlePlayAll(folderSongs)} className="btn btn-primary" style={{ marginLeft: 'auto', padding: '6px 16px', fontSize: 11, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Play size={12} /> Play All ({folderSongs.length})
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {folderSongs.map((s, i) => (
              <div key={s.id || i}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                onDoubleClick={() => handlePlay(s)}
                onContextMenu={e => { e.preventDefault(); useUIStore.getState().openContextMenu(e.clientX, e.clientY, s); }}
              >
                <ArtThumb path={s.path} seed={s.name} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                  <p style={{ margin: '1px 0 0', fontSize: 10, color: 'var(--text-dim)' }}>{s.artist || 'Unknown Artist'}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Folder card (for grid views) ──
  const FolderCard = ({ f }) => {
    const count = folderMap[f].length;
    const deepName = f.split('/').filter(Boolean).pop() || f;
    return (
      <motion.div whileHover={{ y: -3, scale: 1.02 }}
        onClick={() => setFolderFilter(f)}
        onContextMenu={(e) => { e.preventDefault(); const name = f.split('/').filter(Boolean).pop() || f; useUIStore.getState().openContextMenu(e.clientX, e.clientY, null, { type: 'folder', name, path: f, tracks: folderMap[f] }); }}
        style={{
          width: 140, cursor: 'pointer', textAlign: 'center', flexShrink: 0,
        }}
      >
        <div style={{ margin: '0 auto 8px', width: 100 }}>
          <FolderSVG seed={f} size={100} />
        </div>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deepName}</p>
        <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--text-dim)' }}>{count} {count === 1 ? 'track' : 'tracks'}</p>
      </motion.div>
    );
  };

  // ── View mode renderers ──
  const renderGrid = () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'flex-start' }}>
      {hierarchy.map(f => <FolderCard key={f} f={f} />)}
    </div>
  );

  const renderList = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {hierarchy.map(f => {
        const count = folderMap[f].length;
        const deepName = f.split('/').filter(Boolean).pop() || f;
        const shortName = f.split('/').filter(Boolean).slice(-2).join(' / ') || f;
        return (
          <div key={f} onClick={() => setFolderFilter(f)}
            onContextMenu={(e) => { e.preventDefault(); useUIStore.getState().openContextMenu(e.clientX, e.clientY, null, { type: 'folder', name: deepName, path: f, tracks: folderMap[f] }); }}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 10, cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <FolderSVG seed={f} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deepName}</p>
              <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shortName}</p>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>{count} tracks</span>
          </div>
        );
      })}
    </div>
  );

  const renderHierarchicalGrid = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {Object.entries(groupedFolders).map(([parent, folders]) => (
        <div key={parent}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
              {parent === '/' ? 'Root' : parent.split('/').filter(Boolean).slice(-2).join(' / ')}
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--glass-border)' }} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            {folders.map(f => <FolderCard key={f} f={f} />)}
          </div>
        </div>
      ))}
    </div>
  );

  const modes = [
    { id: 'hierarchical-grid', icon: Layers, label: 'Hierarchy Grid' },
    { id: 'grid', icon: Grid3x3, label: 'Grid' },
    { id: 'hierarchical', icon: List, label: 'List' },
  ];

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '24px 28px', position: 'relative' }}>
      <FilterDrawer songs={songs} onFilter={() => {}} onPlayAll={handlePlayAll} />
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Folders</h2>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>{hierarchy.length} folders</p>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {/* View mode toggles */}
            <div style={{ display: 'flex', gap: 2, background: 'var(--bg-surface)', borderRadius: 8, padding: 2, border: '1px solid var(--glass-border)' }}>
              {modes.map(m => (
                <button key={m.id} onClick={() => setViewMode(m.id)} title={m.label}
                  style={{
                    padding: '5px 8px', borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s',
                    background: viewMode === m.id ? 'var(--accent-muted)' : 'transparent',
                    color: viewMode === m.id ? 'var(--accent)' : 'var(--text-dim)',
                  }}>
                  <m.icon size={14} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {hierarchy.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <FolderSVG seed="empty" size={80} />
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: '16px 0 8px' }}>No Folders</p>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>Add songs to see folders.</p>
          </div>
        ) : (
          viewMode === 'grid' ? renderGrid() :
          viewMode === 'hierarchical' ? renderList() :
          renderHierarchicalGrid()
        )}
      </motion.div>
    </div>
  );
}
