import { useEffect, useState } from 'react';
import { useLibraryStore } from '../../stores/libraryStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useUIStore } from '../../stores/uiStore';
import { motion } from 'framer-motion';
import { Music, Video, Disc3, Play, FolderOpen, Search, Trash2 } from 'lucide-react';
import ArtThumb from '../../components/ArtThumb';
import FilterDrawer from '../../components/FilterDrawer';
import { playbackEngine } from '../../lib/playbackEngine';

export default function LibraryView() {
  const { songs, sortBy, setSortBy, searchQuery, setSearchQuery, getSortedSongs, loadFromDisk } = useLibraryStore();
  const { setActiveView } = useUIStore();
  const { addToast } = useUIStore();
  const sorted = getSortedSongs();
  const [filteredSongs, setFilteredSongs] = useState(null);
  const displaySongs = filteredSongs || sorted;

  const handlePlayAll = async (tracks) => {
    if (!tracks || tracks.length === 0 || !window.electronAPI) return;
    const first = tracks[0];
    try {
      const buf = await window.electronAPI.readFile(first.path || first.id);
      const name = first.name || (first.path || '').split(/[\\/]/).pop();
      const f = new File([buf], name, { type: name.endsWith('.mp4') ? 'video/mp4' : 'audio/wav' });
      f.path = first.path || first.id;
      playbackEngine.loadFileAndPlay(f, { name, path: first.path, artist: first.artist, album: first.album });
      const store = usePlayerStore.getState();
      store.setQueue(tracks.slice(1).map(t => ({ type: 'library', name: t.name, path: t.path || t.id, artist: t.artist, album: t.album })));
      addToast(`Playing ${tracks.length} tracks`, 'success');
    } catch { addToast('Failed to play', 'error'); }
  };

  useEffect(() => { loadFromDisk(); }, []);

  const handleLoadFolder = async () => {
    if (!window.electronAPI) return;
    try {
      const files = await window.electronAPI.selectFolder();
      if (!files || files.length === 0) return;
      for (const item of files) await window.electronAPI.addToLibrary(item);
      await loadFromDisk();
      addToast(`Imported ${files.length} tracks`, 'success');
    } catch (e) { console.error(e); }
  };

  const handlePlay = async (item) => {
    if (!window.electronAPI) return;
    try {
      const buffer = await window.electronAPI.readFile(item.path || item.id);
      const isVid = item.name?.endsWith('.mp4') || item.type === 'video';
      const f = new File([buffer], item.name, { type: isVid ? 'video/mp4' : 'audio/wav' });
      f.path = item.path || item.id;
      usePlayerStore.getState().setFileName(item.name);
      usePlayerStore.getState().setTrack(item);
      // Switch to studio to load and play
      setActiveView('studio');
      addToast(`Loading: ${item.name}`, 'info');
    } catch (e) { addToast('Failed to load track', 'error'); }
  };

  const handleRemove = async (id) => {
    if (!window.electronAPI) return;
    await window.electronAPI.removeFromLibrary(id);
    await loadFromDisk();
    addToast('Removed from library', 'info');
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '24px 28px', position: 'relative' }}>
      <FilterDrawer songs={songs} onFilter={setFilteredSongs} onPlayAll={handlePlayAll} />
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Library</h2>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>{displaySongs.length} of {songs.length} tracks</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search library..."
                className="input"
                style={{ paddingLeft: 32, width: 200 }}
              />
            </div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="input" style={{ width: 'auto', padding: '7px 10px' }}>
              <option value="dateDesc">Newest</option>
              <option value="dateAsc">Oldest</option>
              <option value="titleAsc">Title A–Z</option>
              <option value="titleDesc">Title Z–A</option>
              <option value="artistAsc">Artist A–Z</option>
              <option value="albumAsc">Album A–Z</option>
              <option value="random">Shuffle</option>
            </select>
            {window.electronAPI && (
              <button onClick={handleLoadFolder} className="btn btn-accent-soft">
                <FolderOpen size={14} /> Import Folder
              </button>
            )}
          </div>
        </div>

        {/* Track List */}
        {displaySongs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <Music size={56} color="var(--text-dim)" style={{ marginBottom: 20, opacity: 0.4 }} />
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>Your Library is Empty</p>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '0 0 24px' }}>Import a folder or drop files in the Studio to get started.</p>
            {window.electronAPI && (
              <button onClick={handleLoadFolder} className="btn btn-primary" style={{ padding: '10px 20px' }}>
                <FolderOpen size={16} /> Import Folder
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {displaySongs.map((item, i) => {
              const hash = (item.id || '').split('').reduce((a, b) => a + b.charCodeAt(0), 0);
              const h1 = hash % 360;
              const h2 = (h1 + 40) % 360;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.5) }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderRadius: 10,
                    background: 'transparent',
                    transition: 'all 0.15s',
                    cursor: 'pointer',
                    group: true,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.querySelector('.track-actions').style.opacity = '1'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.querySelector('.track-actions').style.opacity = '0'; }}
                  onDoubleClick={() => handlePlay(item)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    useUIStore.getState().openContextMenu(e.clientX, e.clientY, item);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                    <ArtThumb path={item.path || item.id} seed={item.name} size={40} type={item.type === 'video' ? 'video' : 'track'} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-dim)' }}>{item.artist || 'Unknown Artist'} • {new Date(item.timestamp).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="track-actions" style={{ display: 'flex', gap: 4, opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 }}>
                    <button onClick={(e) => { e.stopPropagation(); handlePlay(item); }} className="btn btn-accent-soft" style={{ padding: '4px 10px', fontSize: 11, borderRadius: 20 }}>
                      <Play size={12} /> Play
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleRemove(item.id); }} className="btn btn-ghost" style={{ padding: '4px 8px', borderRadius: 20, color: 'var(--text-dim)' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
