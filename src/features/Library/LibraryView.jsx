import { useEffect, useState, useMemo, useRef } from 'react';
import { useLibraryStore } from '../../stores/libraryStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useUIStore } from '../../stores/uiStore';
import { motion } from 'framer-motion';
import { Music, Play, FolderOpen, Search, Trash2, ChevronLeft, ChevronRight, Disc3, Clock } from 'lucide-react';
import ArtThumb from '../../components/ArtThumb';
import FilterDrawer from '../../components/FilterDrawer';
import { playbackEngine } from '../../lib/playbackEngine';

/* ── Shared UI ── */
function HScrollRow({ title, children }) {
  const ref = useRef(null);
  const scroll = (dir) => ref.current?.scrollBy({ left: dir * 280, behavior: 'smooth' });
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>{title}</h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => scroll(-1)} className="btn btn-ghost" style={{ width: 30, height: 30, padding: 0, borderRadius: '50%' }}><ChevronLeft size={16} /></button>
          <button onClick={() => scroll(1)} className="btn btn-ghost" style={{ width: 30, height: 30, padding: 0, borderRadius: '50%' }}><ChevronRight size={16} /></button>
        </div>
      </div>
      <div ref={ref} style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>
        {children}
      </div>
    </div>
  );
}

function TrackCard({ item, onPlay, onContextMenu }) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      onClick={() => onPlay(item)}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, item); }}
      style={{
        width: 160, flexShrink: 0, cursor: 'pointer', borderRadius: 10, overflow: 'hidden',
        background: 'var(--bg-surface)', border: '1px solid var(--glass-border)',
      }}
    >
      <ArtThumb path={item.path || item.id} seed={item.name} size={160} style={{ height: 130, width: 160, borderRadius: 0 }}>
        <div style={{ position: 'absolute', bottom: 8, right: 8, width: 34, height: 34, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }} className="play-hover">
          <Play size={14} color="#fff" style={{ marginLeft: 2 }} />
        </div>
      </ArtThumb>
      <div style={{ padding: '10px 12px' }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
        <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.artist || 'Unknown Artist'}</p>
      </div>
    </motion.div>
  );
}

export default function LibraryView() {
  const { songs, sortBy, setSortBy, searchQuery, setSearchQuery, getSortedSongs, loadFromDisk } = useLibraryStore();
  const { setActiveView, addToast, openContextMenu } = useUIStore();
  
  const sorted = getSortedSongs();
  const [filteredSongs, setFilteredSongs] = useState(null);
  const displaySongs = filteredSongs || sorted;

  useEffect(() => { loadFromDisk(); }, []);

  const handlePlayAll = async (tracks) => {
    if (!tracks || tracks.length === 0 || !window.electronAPI) return;
    const first = tracks[0];
    try {
      const buf = await window.electronAPI.readFile(first.path || first.id);
      const name = first.name || (first.path || '').split(/[\\/]/).pop();
      const f = new File([buf], name, { type: name.endsWith('.mp4') ? 'video/mp4' : 'audio/wav' });
      f.path = first.path || first.id;
      playbackEngine.loadFileAndPlay(f, { name, path: first.path, artist: first.artist, album: first.album });
      usePlayerStore.getState().setQueue(tracks.slice(1).map(t => ({ type: 'library', name: t.name, path: t.path || t.id, artist: t.artist, album: t.album })));
      addToast(`Playing ${tracks.length} tracks`, 'success');
    } catch { addToast('Failed to play', 'error'); }
  };

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

  // Sections Data
  const recentlyAdded = useMemo(() => {
    return [...songs].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 15);
  }, [songs]);

  const groupedSongs = useMemo(() => {
    const groups = {};
    displaySongs.forEach(song => {
      let key = 'Tracks';
      if (sortBy.startsWith('title')) {
        key = (song.name || '#').charAt(0).toUpperCase();
        if (!/[A-Z]/.test(key)) key = '#';
      } else if (sortBy.startsWith('artist')) {
        key = song.artist || 'Unknown Artist';
      } else if (sortBy.startsWith('album')) {
        key = song.album || 'Unknown Album';
      } else if (sortBy.startsWith('date')) {
        const d = new Date(song.timestamp || 0);
        key = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(song);
    });
    // Sort keys based on current sort direction
    const sortedKeys = Object.keys(groups).sort((a, b) => {
       if (sortBy.endsWith('Desc')) return b.localeCompare(a);
       return a.localeCompare(b);
    });
    return sortedKeys.map(k => ({ title: k, items: groups[k] }));
  }, [displaySongs, sortBy]);

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '24px 28px', position: 'relative' }}>
      <FilterDrawer songs={songs} onFilter={setFilteredSongs} onPlayAll={handlePlayAll} />
      
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 1000, margin: '0 auto' }}>
        
        {/* Header Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: 'var(--text)', margin: '0 0 8px', letterSpacing: '-0.03em' }}>Library</h2>
            <p style={{ fontSize: 13, color: 'var(--accent)', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {displaySongs.length} Tracks • {new Set(displaySongs.map(s=>s.artist)).size} Artists
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search library..." className="input" style={{ paddingLeft: 32, width: 220 }}
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
                <FolderOpen size={14} /> Import
              </button>
            )}
          </div>
        </div>

        {displaySongs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '100px 20px' }}>
            <Disc3 size={64} color="var(--text-dim)" style={{ marginBottom: 24, opacity: 0.3 }} />
            <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>Your Library is Empty</p>
            <p style={{ fontSize: 14, color: 'var(--text-dim)', margin: '0 0 24px' }}>Import a folder to start building your collection.</p>
            {window.electronAPI && (
              <button onClick={handleLoadFolder} className="btn btn-primary" style={{ padding: '10px 24px' }}>
                <FolderOpen size={16} /> Import Folder
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Horizontal Sections (Only if no search/filter to keep it clean) */}
            {!searchQuery && (!filteredSongs || filteredSongs.length === songs.length) && recentlyAdded.length > 0 && (
              <HScrollRow title="Recently Added">
                {recentlyAdded.map(item => (
                  <TrackCard key={`recent-${item.id}`} item={item} onPlay={handlePlay} onContextMenu={(e, i) => openContextMenu(e.clientX, e.clientY, i)} />
                ))}
              </HScrollRow>
            )}

            {/* Exhaustive Grouped List */}
            <div style={{ marginTop: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                 <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>All Tracks</h3>
                 <button onClick={() => handlePlayAll(displaySongs)} className="btn btn-primary" style={{ padding: '6px 16px', fontSize: 12, borderRadius: 20 }}>
                   <Play size={12}/> Play Filtered
                 </button>
              </div>

              {groupedSongs.map(group => (
                <div key={group.title} style={{ marginBottom: 32 }}>
                  <h4 style={{ fontSize: 14, color: 'var(--text-dim)', borderBottom: '1px solid var(--glass-border)', paddingBottom: 8, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {group.title} <span style={{ opacity: 0.5, marginLeft: 8, fontSize: 11 }}>({group.items.length})</span>
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 8 }}>
                    {group.items.map((item, i) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '8px 12px', borderRadius: 10, background: 'var(--bg-surface)', border: '1px solid var(--glass-border)',
                          cursor: 'pointer', transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.querySelector('.track-actions').style.opacity = '1'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.querySelector('.track-actions').style.opacity = '0'; }}
                        onDoubleClick={() => handlePlay(item)}
                        onContextMenu={(e) => { e.preventDefault(); openContextMenu(e.clientX, e.clientY, item); }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                          <ArtThumb path={item.path || item.id} seed={item.name} size={40} type={item.type === 'video' ? 'video' : 'track'} />
                          <div style={{ minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.artist || 'Unknown Artist'} • {item.album || 'Single'}</p>
                          </div>
                        </div>
                        <div className="track-actions" style={{ display: 'flex', gap: 4, opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 }}>
                          <button onClick={(e) => { e.stopPropagation(); handlePlay(item); }} className="btn btn-accent-soft" style={{ padding: '6px', borderRadius: '50%' }}>
                            <Play size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </motion.div>
      <style>{`
        .play-hover { opacity: 0 !important; }
        div:hover > .play-hover { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
