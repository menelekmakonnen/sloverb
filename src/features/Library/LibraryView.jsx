import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useLibraryStore } from '../../stores/libraryStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useUIStore } from '../../stores/uiStore';
import { motion } from 'framer-motion';
import { Play, FolderOpen, Search, ChevronLeft, ChevronRight, Disc3, Clock, TrendingUp, Users, ListMusic, ArrowLeft, Crown, Flame, Music } from 'lucide-react';
import ArtThumb from '../../components/ArtThumb';
import { playbackEngine } from '../../lib/playbackEngine';

/* ── Helpers ── */
const fmt = (s) => { if (!s || s < 60) return `${Math.floor(s || 0)}s`; if (s < 3600) return `${Math.floor(s/60)}m`; return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`; };

function HScrollRow({ title, action, actionLabel, children }) {
  const ref = useRef(null);
  const scroll = (dir) => ref.current?.scrollBy({ left: dir * 280, behavior: 'smooth' });
  if (!React.Children.count(children)) return null;
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{title}</h3>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {action && <button onClick={action} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>{actionLabel || 'See All →'}</button>}
          <button onClick={() => scroll(-1)} className="btn btn-ghost" style={{ width: 28, height: 28, padding: 0, borderRadius: '50%' }}><ChevronLeft size={14} /></button>
          <button onClick={() => scroll(1)} className="btn btn-ghost" style={{ width: 28, height: 28, padding: 0, borderRadius: '50%' }}><ChevronRight size={14} /></button>
        </div>
      </div>
      <div ref={ref} style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>{children}</div>
    </div>
  );
}

/* ── Cards ── */
function TopSongCard({ item, rank, onPlay, onContext }) {
  return (
    <div className="track-card" onClick={() => onPlay(item)} onContextMenu={e => { e.preventDefault(); onContext(e.clientX, e.clientY, item); }}
      style={{ width: 155, flexShrink: 0, cursor: 'pointer', borderRadius: 12, overflow: 'hidden', background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', transition: 'transform 0.15s, box-shadow 0.15s', position: 'relative' }}>
      <ArtThumb path={item.path || item.id} seed={item.name} size={155} style={{ height: 120, width: 155, borderRadius: 0 }} />
      <div style={{ position: 'absolute', top: 6, left: 6, width: 24, height: 24, borderRadius: '50%', background: rank <= 3 ? 'var(--accent)' : 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff' }}>{rank}</div>
      <div style={{ padding: '8px 10px' }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
        <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--text-dim)' }}>{item.playCount} plays</p>
      </div>
    </div>
  );
}

function ArtistCard({ artist, onNav }) {
  return (
    <div onClick={onNav} style={{ width: 120, flexShrink: 0, cursor: 'pointer', textAlign: 'center', transition: 'transform 0.15s' }} className="track-card">
      <div style={{ width: 90, height: 90, borderRadius: '50%', margin: '0 auto 8px', background: `linear-gradient(135deg, hsl(${(artist.artist||'').length*37%360},60%,45%), hsl(${((artist.artist||'').length*37+45)%360},50%,30%))`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
        <Users size={28} color="rgba(255,255,255,0.4)" />
      </div>
      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artist.artist}</p>
      <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--text-dim)' }}>{artist.playCount} plays · {artist.songs} songs</p>
    </div>
  );
}

function PlaylistCard({ pl, songs, onNav }) {
  const count = pl.itemIds?.length || 0;
  return (
    <div onClick={onNav} style={{ width: 155, flexShrink: 0, cursor: 'pointer', borderRadius: 12, overflow: 'hidden', background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', transition: 'transform 0.15s' }} className="track-card">
      <div style={{ height: 100, background: `linear-gradient(135deg, hsl(${pl.name.length*47%360},55%,40%), hsl(${(pl.name.length*47+60)%360},45%,25%))`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ListMusic size={32} color="rgba(255,255,255,0.35)" />
      </div>
      <div style={{ padding: '8px 10px' }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.name}</p>
        <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--text-dim)' }}>{count} tracks</p>
      </div>
    </div>
  );
}

/* ── Virtual Row ── */
const TrackRow = React.memo(function TrackRow({ item, onPlay, onContextMenu, stat }) {
  return (
    <div className="track-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 10, background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', cursor: 'pointer', transition: 'background 0.15s' }}
      onDoubleClick={() => onPlay(item)} onContextMenu={e => { e.preventDefault(); onContextMenu(e.clientX, e.clientY, item); }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
        <ArtThumb path={item.path || item.id} seed={item.name} size={40} type={item.type === 'video' ? 'video' : 'track'} />
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.artist || 'Unknown Artist'} • {item.album || 'Single'}{stat ? ` • ${stat.playCount} plays` : ''}</p>
        </div>
      </div>
      <div className="track-row-actions" style={{ display: 'flex', gap: 4, opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 }}>
        <button onClick={e => { e.stopPropagation(); onPlay(item); }} className="btn btn-accent-soft" style={{ padding: '6px', borderRadius: '50%' }}><Play size={12} /></button>
      </div>
    </div>
  );
});

/* ── Sub-views for drill-down ── */
function TopSongsDetail({ songs, onPlay, onContext, onBack }) {
  return (
    <div>
      <button onClick={onBack} className="btn btn-ghost" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}><ArrowLeft size={14} /> Back to Library</button>
      <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: '0 0 20px' }}><Crown size={20} style={{ marginRight: 8, color: 'var(--accent)' }} />Your Top Songs</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {songs.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 10, background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', cursor: 'pointer', transition: 'background 0.15s' }}
            className="track-row" onDoubleClick={() => onPlay(s)} onContextMenu={e => { e.preventDefault(); onContext(e.clientX, e.clientY, s); }}>
            <span style={{ width: 28, textAlign: 'center', fontSize: 14, fontWeight: 700, color: i < 3 ? 'var(--accent)' : 'var(--text-dim)' }}>{i+1}</span>
            <ArtThumb path={s.path || s.id} seed={s.name} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-dim)' }}>{s.artist || 'Unknown'} · {s.playCount} plays · {fmt(s.totalListenTime)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════ MAIN COMPONENT ══════ */
const ROW_HEIGHT = 60;
const OVERSCAN = 10;

export default function LibraryView() {
  const { songs, playlists, sortBy, setSortBy, searchQuery, setSearchQuery, loadFromDisk, getTopSongs, getTopArtists, getRecap, playStats } = useLibraryStore();
  const { setActiveView, addToast, openContextMenu, librarySubView, setLibrarySubView, setArtistFilter, navStack, pushNav, popNav } = useUIStore();

  const sorted = useMemo(() => useLibraryStore.getState().getSortedSongs(), [songs, sortBy, searchQuery]);

  useEffect(() => { loadFromDisk(); }, []);

  const topSongs = useMemo(() => getTopSongs(15), [playStats]);
  const topArtists = useMemo(() => getTopArtists(10).filter(a => a.artist !== 'Unknown Artist'), [playStats]);
  const recap = useMemo(() => getRecap(7 * 24 * 60 * 60 * 1000), [playStats]);
  const allTopSongs = useMemo(() => getTopSongs(50), [playStats]);

  /* ── Scroll / virtual state ── */
  const scrollRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [cHeight, setCHeight] = useState(800);
  const onScroll = useCallback(e => setScrollTop(e.currentTarget.scrollTop), []);
  useEffect(() => { const el = scrollRef.current; if (!el) return; const ro = new ResizeObserver(([e]) => setCHeight(e.contentRect.height)); ro.observe(el); return () => ro.disconnect(); }, []);

  const handlePlay = useCallback(async (item) => {
    if (!window.electronAPI) return;
    try {
      const buf = await window.electronAPI.readFile(item.path || item.id);
      const f = new File([buf], item.name, { type: item.name?.endsWith('.mp4') ? 'video/mp4' : 'audio/wav' });
      f.path = item.path || item.id;
      playbackEngine.loadFileAndPlay(f, item);
    } catch { addToast('Failed to load track', 'error'); }
  }, []);

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

  /* ── Sub-view drill-downs ── */
  if (librarySubView === 'topSongs') {
    return (
      <div style={{ height: '100%', overflow: 'auto', padding: '24px 28px' }}>
        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} style={{ maxWidth: 800, margin: '0 auto' }}>
          <TopSongsDetail songs={allTopSongs} onPlay={handlePlay} onContext={openContextMenu} onBack={() => setLibrarySubView(null)} />
        </motion.div>
      </div>
    );
  }

  /* ── Flat items for virtual scroll ── */
  const { flatItems, totalHeight } = useMemo(() => {
    const flat = [];
    const HEADER_H = 52;
    const groups = {};
    sorted.forEach(song => {
      let key = 'Tracks';
      if (sortBy.startsWith('title')) { key = (song.name || '#').charAt(0).toUpperCase(); if (!/[A-Z]/.test(key)) key = '#'; }
      else if (sortBy.startsWith('artist')) key = song.artist || 'Unknown Artist';
      else if (sortBy.startsWith('album')) key = song.album || 'Unknown Album';
      else if (sortBy.startsWith('date')) { const d = new Date(song.timestamp || 0); key = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); }
      if (!groups[key]) groups[key] = [];
      groups[key].push(song);
    });
    const sortedKeys = Object.keys(groups).sort((a, b) => sortBy.endsWith('Desc') ? b.localeCompare(a) : a.localeCompare(b));
    let total = 0;
    for (const k of sortedKeys) {
      flat.push({ type: 'header', title: k, count: groups[k].length, height: HEADER_H });
      total += HEADER_H;
      for (const song of groups[k]) { flat.push({ type: 'row', item: song, height: ROW_HEIGHT }); total += ROW_HEIGHT; }
    }
    return { flatItems: flat, totalHeight: total };
  }, [sorted, sortBy]);

  const { visibleItems, offsetTop } = useMemo(() => {
    let cum = 0, startIdx = 0, endIdx = flatItems.length, foundStart = false, startOff = 0;
    for (let i = 0; i < flatItems.length; i++) {
      if (!foundStart && cum + flatItems[i].height > scrollTop - OVERSCAN * ROW_HEIGHT) { startIdx = i; startOff = cum; foundStart = true; }
      cum += flatItems[i].height;
      if (foundStart && cum > scrollTop + cHeight + OVERSCAN * ROW_HEIGHT) { endIdx = i + 1; break; }
    }
    return { visibleItems: flatItems.slice(startIdx, endIdx), offsetTop: startOff };
  }, [flatItems, scrollTop, cHeight]);

  const showHub = !searchQuery && songs.length > 0;

  return (
    <div ref={scrollRef} onScroll={onScroll} style={{ height: '100%', overflow: 'auto', padding: '24px 28px', position: 'relative' }}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 1000, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 30, fontWeight: 800, color: 'var(--text)', margin: '0 0 6px', letterSpacing: '-0.03em' }}>Library</h2>
            <p style={{ fontSize: 13, color: 'var(--accent)', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {songs.length} Tracks · {new Set(songs.map(s => s.artist)).size} Artists
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search library..." className="input" style={{ paddingLeft: 32, width: 220 }} />
            </div>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="input" style={{ width: 'auto', padding: '7px 10px' }}>
              <option value="dateDesc">Newest</option><option value="dateAsc">Oldest</option>
              <option value="titleAsc">Title A–Z</option><option value="titleDesc">Title Z–A</option>
              <option value="artistAsc">Artist A–Z</option><option value="albumAsc">Album A–Z</option>
              <option value="random">Shuffle</option>
            </select>
            {window.electronAPI && <button onClick={handleLoadFolder} className="btn btn-accent-soft"><FolderOpen size={14} /> Import</button>}
          </div>
        </div>

        {songs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '100px 20px' }}>
            <Disc3 size={64} color="var(--text-dim)" style={{ marginBottom: 24, opacity: 0.3 }} />
            <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>Your Library is Empty</p>
            <p style={{ fontSize: 14, color: 'var(--text-dim)', margin: '0 0 24px' }}>Import a folder to start building your collection.</p>
            {window.electronAPI && <button onClick={handleLoadFolder} className="btn btn-primary" style={{ padding: '10px 24px' }}><FolderOpen size={16} /> Import Folder</button>}
          </div>
        ) : (
          <>
            {/* ═══ HUB SECTIONS (hidden during search) ═══ */}
            {showHub && (
              <>
                {/* Recap Card */}
                {recap.totalPlays > 0 && (
                  <div style={{ marginBottom: 32, padding: '20px 24px', borderRadius: 16, background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(99,102,241,0.08))', border: '1px solid rgba(139,92,246,0.2)', display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: 10, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><Flame size={12} /> Your Week in Music</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>{recap.totalPlays} plays</div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>{recap.uniqueTracks} tracks · {recap.uniqueArtists} artists · {fmt(recap.totalListenTime)} listened</div>
                    </div>
                    {recap.topArtist && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Top Artist</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>{recap.topArtist}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{recap.topArtistPlays} plays this week</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Top Songs */}
                {topSongs.length > 0 && (
                  <HScrollRow title="🔥 Top Songs" action={() => setLibrarySubView('topSongs')} actionLabel="See All →">
                    {topSongs.map((s, i) => <TopSongCard key={s.id} item={s} rank={i+1} onPlay={handlePlay} onContext={openContextMenu} />)}
                  </HScrollRow>
                )}

                {/* Top Artists */}
                {topArtists.length > 0 && (
                  <HScrollRow title="🎤 Your Artists" action={() => { setActiveView('artists'); }}>
                    {topArtists.map(a => <ArtistCard key={a.artist} artist={a} onNav={() => { setArtistFilter(a.artist); pushNav('artists', { artistFilter: a.artist }); }} />)}
                  </HScrollRow>
                )}

                {/* Playlists */}
                {playlists.length > 0 && (
                  <HScrollRow title="🎧 Playlists" action={() => setActiveView('playlists')}>
                    {playlists.map(pl => <PlaylistCard key={pl.id} pl={pl} songs={songs} onNav={() => setActiveView('playlists')} />)}
                  </HScrollRow>
                )}
              </>
            )}

            {/* ═══ ALL TRACKS (Virtual Scroll) ═══ */}
            <div style={{ marginTop: showHub ? 8 : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>All Tracks</h3>
              </div>
              <div style={{ position: 'relative', height: totalHeight }}>
                <div style={{ position: 'absolute', top: offsetTop, left: 0, right: 0 }}>
                  {visibleItems.map((entry, vi) => {
                    if (entry.type === 'header') return (
                      <div key={`h-${entry.title}`} style={{ height: entry.height, display: 'flex', alignItems: 'flex-end', paddingBottom: 8 }}>
                        <h4 style={{ fontSize: 13, color: 'var(--text-dim)', borderBottom: '1px solid var(--glass-border)', paddingBottom: 8, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', width: '100%' }}>
                          {entry.title} <span style={{ opacity: 0.5, marginLeft: 8, fontSize: 11 }}>({entry.count})</span>
                        </h4>
                      </div>
                    );
                    const stat = playStats[entry.item.path || entry.item.id];
                    return <div key={entry.item.id} style={{ height: entry.height, padding: '4px 0' }}><TrackRow item={entry.item} onPlay={handlePlay} onContextMenu={openContextMenu} stat={stat} /></div>;
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </motion.div>
      <style>{`
        .play-hover { opacity: 0 !important; }
        div:hover > .play-hover { opacity: 1 !important; }
        .track-card:hover { transform: translateY(-4px) scale(1.02); box-shadow: 0 8px 24px rgba(0,0,0,0.25); }
        .track-row:hover { background: var(--bg-hover) !important; }
        .track-row:hover .track-row-actions { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
