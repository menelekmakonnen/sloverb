import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useLibraryStore } from '../../stores/libraryStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useUIStore } from '../../stores/uiStore';
import { playbackEngine } from '../../lib/playbackEngine';
import { Disc3, Play, Music, Search, ArrowLeft } from 'lucide-react';
import ArtThumb from '../../components/ArtThumb';
import FilterDrawer from '../../components/FilterDrawer';

export default function AlbumsView() {
  const { songs } = useLibraryStore();
  const { addToast, albumFilter, setAlbumFilter } = useUIStore();
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState('count');

  const albums = useMemo(() => {
    const map = {};
    songs.forEach(s => {
      const a = s.album || 'Unknown Album';
      if (!map[a]) map[a] = { name: a, artist: s.artist || 'Various Artists', tracks: [] };
      map[a].tracks.push(s);
    });
    let list = Object.values(map);
    if (sortMode === 'count') list.sort((a, b) => b.tracks.length - a.tracks.length);
    else if (sortMode === 'alpha') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortMode === 'artist') list.sort((a, b) => a.artist.localeCompare(b.artist));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a => a.name.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q));
    }
    return list;
  }, [songs, search, sortMode]);

  const handlePlay = async (song) => {
    if (!window.electronAPI) return;
    try {
      const buf = await window.electronAPI.readFile(song.path || song.id);
      const isVid = song.name?.endsWith('.mp4') || song.type === 'video';
      const f = new File([buf], song.name, { type: isVid ? 'video/mp4' : 'audio/wav' });
      f.path = song.path || song.id;
      playbackEngine.loadFileAndPlay(f, song);
    } catch { addToast('Failed to load track', 'error'); }
  };

  const handlePlayAll = (tracks) => {
    if (tracks.length === 0) return;
    const store = usePlayerStore.getState();
    const rest = tracks.slice(1).map(s => ({ type: 'library', name: s.name, path: s.path, id: s.id }));
    store.setQueue(rest);
    handlePlay(tracks[0]);
  };

  // ── Detail View ──
  if (albumFilter) {
    const album = albums.find(a => a.name === albumFilter);
    if (!album) {
      setAlbumFilter(null);
      return null;
    }
    const h1 = (album.name.charCodeAt(0) * 23) % 360;
    const h2 = (h1 + 50) % 360;

    return (
      <div style={{ height: '100%', overflow: 'auto', padding: '24px 28px' }}>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ maxWidth: 800, margin: '0 auto' }}>
          <button onClick={() => setAlbumFilter(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-dim)', fontSize: 12, marginBottom: 20 }}>
            <ArrowLeft size={14} /> All Albums
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 28 }}>
            <div style={{
              width: 120, height: 120, borderRadius: 14, flexShrink: 0,
              background: `linear-gradient(135deg, hsl(${h1}, 65%, 50%), hsl(${h2}, 55%, 35%))`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            }}>
              <Disc3 size={40} color="rgba(255,255,255,0.3)" />
            </div>
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px', color: 'var(--text)' }}>{album.name}</h2>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '0 0 4px' }}>{album.artist}</p>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '0 0 12px' }}>{album.tracks.length} tracks</p>
              <button onClick={() => handlePlayAll(album.tracks)} className="btn btn-primary" style={{ padding: '8px 20px', fontSize: 12, borderRadius: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Play size={14} /> Play All
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {album.tracks.map((song, i) => {
              const hash = (song.id || '').split('').reduce((a, b) => a + b.charCodeAt(0), 0);
              return (
                <div key={song.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onDoubleClick={() => handlePlay(song)}
                  onContextMenu={(e) => { e.preventDefault(); useUIStore.getState().openContextMenu(e.clientX, e.clientY, song); }}
                >
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', width: 24, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                  <div style={{
                    width: 40, height: 40, borderRadius: 6, flexShrink: 0,
                    background: `linear-gradient(135deg, hsl(${hash % 360}, 65%, 55%), hsl(${(hash+40)%360}, 60%, 35%))`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Music size={14} color="#fff" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-dim)' }}>{song.artist || 'Unknown Artist'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Grid View ──
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '24px 28px', position: 'relative' }}>
      <FilterDrawer songs={songs} onFilter={() => {}} onPlayAll={handlePlayAll} />
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Albums</h2>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>{albums.length} albums</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search albums..." className="input" style={{ paddingLeft: 32, width: 180 }} />
            </div>
            <select value={sortMode} onChange={e => setSortMode(e.target.value)} className="input" style={{ width: 'auto', padding: '7px 10px' }}>
              <option value="count">Most Tracks</option>
              <option value="alpha">Name A–Z</option>
              <option value="artist">Artist A–Z</option>
            </select>
          </div>
        </div>

        {albums.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <Disc3 size={56} color="var(--text-dim)" style={{ marginBottom: 20, opacity: 0.4 }} />
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>No Albums Yet</p>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>Import music with album metadata to see them here.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
            {albums.map((album, i) => {
              const h1 = (album.name.charCodeAt(0) * 23 + i * 41) % 360;
              const h2 = (h1 + 50) % 360;
              return (
                <motion.div key={album.name} whileHover={{ y: -4, scale: 1.02 }}
                  onClick={() => setAlbumFilter(album.name)}
                  style={{
                    cursor: 'pointer', borderRadius: 12, overflow: 'hidden',
                    background: 'var(--bg-surface)', border: '1px solid var(--glass-border)',
                    transition: 'box-shadow 0.2s', position: 'relative',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.35)'; const b = e.currentTarget.querySelector('.alb-btns'); if (b) b.style.opacity = '1'; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; const b = e.currentTarget.querySelector('.alb-btns'); if (b) b.style.opacity = '0'; }}
                  onContextMenu={(e) => { e.preventDefault(); useUIStore.getState().openContextMenu(e.clientX, e.clientY, album.tracks[0]); }}
                >
                  <ArtThumb path={album.tracks[0]?.path || album.tracks[0]?.id} seed={album.name} size={160} style={{ height: 140, width: '100%', borderRadius: 0 }} />
                  <div className="alb-btns" style={{ position: 'absolute', top: 100, right: 8, opacity: 0, transition: 'opacity 0.2s', display: 'flex', gap: 4 }}>
                    <button onClick={(e) => { e.stopPropagation(); handlePlayAll(album.tracks); }} style={{
                      width: 34, height: 34, borderRadius: '50%', background: 'var(--accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.4)', border: 'none', cursor: 'pointer',
                    }}>
                      <Play size={14} style={{ marginLeft: 2 }} />
                    </button>
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{album.name}</p>
                    <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{album.artist} · {album.tracks.length} tracks</p>
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
