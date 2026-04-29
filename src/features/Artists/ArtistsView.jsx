import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useLibraryStore } from '../../stores/libraryStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useUIStore } from '../../stores/uiStore';
import { playbackEngine } from '../../lib/playbackEngine';
import { Users, Play, Music, Search, ArrowLeft } from 'lucide-react';
import ArtThumb from '../../components/ArtThumb';
import FilterDrawer from '../../components/FilterDrawer';

export default function ArtistsView() {
  const { songs } = useLibraryStore();
  const { addToast, setActiveView, artistFilter, setArtistFilter } = useUIStore();
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState('count'); // 'count', 'alpha', 'albums'

  const artists = useMemo(() => {
    const map = {};
    songs.forEach(s => {
      const a = s.artist || 'Unknown Artist';
      if (!map[a]) map[a] = { name: a, tracks: [], albums: new Set() };
      map[a].tracks.push(s);
      if (s.album) map[a].albums.add(s.album);
    });
    let list = Object.values(map).filter(a => a.name !== 'Unknown Artist');
    if (sortMode === 'count') list.sort((a, b) => b.tracks.length - a.tracks.length);
    else if (sortMode === 'alpha') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortMode === 'albums') list.sort((a, b) => b.albums.size - a.albums.size);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a => a.name.toLowerCase().includes(q));
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
  if (artistFilter) {
    const artist = artists.find(a => a.name === artistFilter);
    if (!artist) { setArtistFilter(null); return null; }
    // Group tracks by album
    const albumGroups = {};
    const folderSet = new Set();
    artist.tracks.forEach(t => {
      const alb = t.album || 'Singles';
      if (!albumGroups[alb]) albumGroups[alb] = [];
      albumGroups[alb].push(t);
      if (t.path) { const parts = t.path.replace(/\\/g, '/').split('/'); parts.pop(); folderSet.add(parts.slice(-2).join('/')); }
    });

    return (
      <div style={{ height: '100%', overflow: 'auto', padding: '24px 28px' }}>
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} style={{ maxWidth: 800, margin: '0 auto' }}>
          <button onClick={() => setArtistFilter(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-dim)', fontSize: 12, marginBottom: 20 }}>
            <ArrowLeft size={14} /> All Artists
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 28 }}>
            <ArtThumb path={artist.tracks[0]?.path || artist.tracks[0]?.id} seed={artist.name} size={110} type="artist" />
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px', color: 'var(--text)' }}>{artist.name}</h2>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '0 0 2px' }}>{artist.tracks.length} tracks · {artist.albums.size} album{artist.albums.size !== 1 ? 's' : ''}</p>
              {folderSet.size > 0 && <p style={{ fontSize: 10, color: 'var(--text-dim)', margin: '0 0 8px', opacity: 0.7 }}>📁 {[...folderSet].slice(0, 3).join(', ')}</p>}
              <button onClick={() => handlePlayAll(artist.tracks)} className="btn btn-primary" style={{ padding: '8px 20px', fontSize: 12, borderRadius: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Play size={14} /> Play All
              </button>
            </div>
          </div>
          {Object.entries(albumGroups).map(([albumName, tracks]) => (
            <div key={albumName} style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '6px 0', borderBottom: '1px solid var(--glass-border)' }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{albumName}</h4>
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{tracks.length} tracks</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {tracks.map((song, i) => (
                  <div key={song.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; const b = e.currentTarget.querySelector('.trk-btns'); if (b) b.style.opacity = '1'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; const b = e.currentTarget.querySelector('.trk-btns'); if (b) b.style.opacity = '0'; }}
                    onDoubleClick={() => handlePlay(song)}
                    onContextMenu={(e) => { e.preventDefault(); useUIStore.getState().openContextMenu(e.clientX, e.clientY, song); }}
                  >
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', width: 20, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                    <ArtThumb path={song.path || song.id} seed={song.name} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.name}</p>
                      <p style={{ margin: '1px 0 0', fontSize: 10, color: 'var(--text-dim)' }}>{song.album || 'Single'}</p>
                    </div>
                    <div className="trk-btns" style={{ display: 'flex', gap: 4, opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 }}>
                      <button onClick={(e) => { e.stopPropagation(); handlePlay(song); }} className="btn btn-accent-soft" style={{ padding: '3px 8px', fontSize: 10, borderRadius: 16 }}>
                        <Play size={10} /> Play
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    );
  }

  // ── Grid View ──
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '24px 28px', position: 'relative' }}>
      <FilterDrawer songs={songs} onFilter={(filtered) => {/* artists derive from songs, filter uses same songs */}} onPlayAll={handlePlayAll} />
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Artists</h2>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>{artists.length} artists</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search artists..." className="input" style={{ paddingLeft: 32, width: 180 }} />
            </div>
            <select value={sortMode} onChange={e => setSortMode(e.target.value)} className="input" style={{ width: 'auto', padding: '7px 10px' }}>
              <option value="count">Most Tracks</option>
              <option value="alpha">Name A–Z</option>
              <option value="albums">Most Albums</option>
            </select>
          </div>
        </div>

        {artists.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <Users size={56} color="var(--text-dim)" style={{ marginBottom: 20, opacity: 0.4 }} />
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>No Artists Yet</p>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>Import music with artist metadata to see them here.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 20 }}>
            {artists.map((artist, i) => {
              const h = (artist.name.charCodeAt(0) * 19 + i * 37) % 360;
              return (
                <motion.div key={artist.name} whileHover={{ y: -4, scale: 1.03 }}
                  onClick={() => setArtistFilter(artist.name)}
                  onContextMenu={(e) => { e.preventDefault(); useUIStore.getState().openContextMenu(e.clientX, e.clientY, null, { type: 'artist', name: artist.name, tracks: artist.tracks }); }}
                  style={{ cursor: 'pointer', textAlign: 'center' }}
                >
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                    <ArtThumb path={artist.tracks[0]?.path || artist.tracks[0]?.id} seed={artist.name} size={120} type="artist" />
                  </div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artist.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-dim)' }}>{artist.tracks.length} track{artist.tracks.length !== 1 ? 's' : ''}</p>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
