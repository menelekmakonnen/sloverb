import { useMemo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useLibraryStore } from '../../stores/libraryStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useUIStore } from '../../stores/uiStore';
import { playbackEngine } from '../../lib/playbackEngine';
import { Play, ChevronLeft, ChevronRight, Music, Disc3, BarChart3, Clock, Heart, Sparkles } from 'lucide-react';
import { useRef } from 'react';
import ArtThumbShared from '../../components/ArtThumb';

/* ── Reusable horizontal scroll row ── */
function HScrollRow({ title, children, subtitle, actionLabel, onAction }) {
  const ref = useRef(null);
  const scroll = (dir) => {
    if (ref.current) ref.current.scrollBy({ left: dir * 280, behavior: 'smooth' });
  };
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, padding: '0 4px' }}>
        <div>
          {subtitle && <p style={{ fontSize: 11, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, margin: '0 0 2px' }}>{subtitle}</p>}
          <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>{title}</h3>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {actionLabel && <button onClick={onAction} style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', padding: '4px 10px', borderRadius: 12, background: 'var(--accent-muted)' }}>{actionLabel}</button>}
          <button onClick={() => scroll(-1)} style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', color: 'var(--text-dim)', cursor: 'pointer' }}>
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => scroll(1)} style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', color: 'var(--text-dim)', cursor: 'pointer' }}>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <div ref={ref} style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>
        {children}
      </div>
    </div>
  );
}



/* ── Track card (horizontal scroll item) ── */
function TrackCard({ item, onPlay, onContextMenu }) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ type: 'spring', damping: 20 }}
      onClick={() => onPlay(item)}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, item); }}
      style={{
        width: 160, flexShrink: 0, cursor: 'pointer', borderRadius: 10, overflow: 'hidden',
        background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', transition: 'box-shadow 0.2s',
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.35)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      <ArtThumbShared path={item.path || item.id} seed={item.name} size={160} style={{ height: 130, width: 160, borderRadius: 0 }}>
        <div style={{
          position: 'absolute', bottom: 8, right: 8, width: 34, height: 34, borderRadius: '50%',
          background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: 0, transition: 'opacity 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }} className="play-hover">
          <Play size={14} color="#fff" style={{ marginLeft: 2 }} />
        </div>
      </ArtThumbShared>
      <div style={{ padding: '10px 12px' }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
        <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.artist || 'Unknown Artist'}</p>
      </div>
    </motion.div>
  );
}

/* ── Quick pick row item (compact list-style) ── */
function QuickPickItem({ item, onPlay, onContextMenu }) {
  return (
    <div
      onClick={() => onPlay(item)}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, item); }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px',
        borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <ArtThumbShared path={item.path || item.id} seed={item.name} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-dim)' }}>{item.artist || 'Unknown Artist'} · {item.album || 'Single'}</p>
      </div>
    </div>
  );
}

/* ── Recap card ── */
function RecapCard({ title, subtitle, icon: Icon, gradient, onClick }) {
  return (
    <motion.div whileHover={{ y: -3, scale: 1.02 }} onClick={onClick}
      style={{
        width: 170, height: 180, flexShrink: 0, borderRadius: 14, overflow: 'hidden',
        background: gradient, cursor: 'pointer', padding: '16px 14px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)', position: 'relative',
      }}
    >
      <div style={{ position: 'absolute', top: 10, right: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.3)', fontSize: 9, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Recap</div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={40} color="rgba(255,255,255,0.35)" />
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>{title}</p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{subtitle}</p>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════ */
export default function HomeView() {
  const { songs, history, playHistory } = useLibraryStore();
  const { addToast, setActiveView } = useUIStore();

  // ── Sections ──
  const recentlyPlayed = useMemo(() => {
    // De-duplicate by name, keep most recent
    const seen = new Set();
    return playHistory.filter(h => {
      if (seen.has(h.name)) return false;
      seen.add(h.name);
      return true;
    }).slice(0, 20);
  }, [playHistory]);

  const forgottenFavourites = useMemo(() => {
    if (songs.length < 5) return [];
    // Songs not played recently (based on age — older timestamps, random selection from the back half)
    const sorted = [...songs].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    const oldHalf = sorted.slice(0, Math.ceil(sorted.length * 0.6));
    const shuffled = oldHalf.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 12);
  }, [songs]);

  const quickPicks = useMemo(() => {
    return [...songs].sort(() => Math.random() - 0.5).slice(0, 12);
  }, [songs]);

  const fromLibrary = useMemo(() => {
    return [...songs].sort(() => Math.random() - 0.5).slice(0, 20);
  }, [songs]);

  const topArtists = useMemo(() => {
    const artists = {};
    songs.forEach(s => {
      const a = s.artist || 'Unknown Artist';
      if (!artists[a]) artists[a] = { name: a, count: 0, firstPath: s.path || s.id };
      artists[a].count++;
    });
    return Object.values(artists).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [songs]);

  // Recap stats (from play history)
  const recapStats = useMemo(() => {
    const uniqueArtists = new Set(songs.map(s => s.artist || 'Unknown')).size;
    const uniqueAlbums = new Set(songs.map(s => s.album || 'Unknown')).size;
    const totalTracks = songs.length;
    const totalSessions = playHistory.length;
    // Top artist by play count
    const artistCounts = {};
    playHistory.forEach(h => { if (h.artist) artistCounts[h.artist] = (artistCounts[h.artist] || 0) + 1; });
    const topArtist = Object.entries(artistCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || topArtists[0]?.name || 'Nobody';
    return { uniqueArtists, uniqueAlbums, totalTracks, totalSessions, topArtist };
  }, [songs, playHistory, topArtists]);

  const handlePlay = async (item) => {
    if (!window.electronAPI) return;
    try {
      const filePath = item.path || item.id || item.name;
      const buf = await window.electronAPI.readFile(filePath);
      const name = item.name || filePath.split(/[\\/]/).pop();
      const isVid = name.endsWith('.mp4');
      const f = new File([buf], name, { type: isVid ? 'video/mp4' : 'audio/wav' });
      f.path = filePath;
      playbackEngine.loadFileAndPlay(f, { name, path: filePath, type: item.type || 'library', artist: item.artist, album: item.album });
    } catch { addToast('Failed to load track', 'error'); }
  };

  const handleContextMenu = (e, item) => {
    useUIStore.getState().openContextMenu(e.clientX, e.clientY, item);
  };

  const greeting = new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() < 18 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '24px 28px' }}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Hero Greeting */}
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 12, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, margin: '0 0 4px' }}>Sloverb Studio</p>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.03em' }}>{greeting}</h2>
        </div>

        {/* ═══ RECENTLY PLAYED ═══ */}
        {recentlyPlayed.length > 0 && (
          <HScrollRow title="Recently played" actionLabel="History" onAction={() => setActiveView('history')}>
            {recentlyPlayed.map((item, i) => (
              <TrackCard key={'rp-' + item.playedAt + i} item={{ ...item, id: item.path }} onPlay={handlePlay} onContextMenu={handleContextMenu} />
            ))}
          </HScrollRow>
        )}

        {/* ═══ FORGOTTEN FAVOURITES ═══ */}
        {forgottenFavourites.length > 0 && (
          <HScrollRow title="Forgotten favourites" subtitle="Revisit these gems">
            {forgottenFavourites.map((item, i) => (
              <TrackCard key={'ff-' + item.id + i} item={item} onPlay={handlePlay} onContextMenu={handleContextMenu} />
            ))}
          </HScrollRow>
        )}

        {/* ═══ QUICK PICKS ═══ */}
        {quickPicks.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, padding: '0 4px' }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>Quick picks</h3>
              <button onClick={() => setActiveView('library')} style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', padding: '4px 10px', borderRadius: 12, background: 'var(--accent-muted)' }}>Play all</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4 }}>
              {quickPicks.slice(0, 8).map((item, i) => (
                <QuickPickItem key={'qp-' + item.id + i} item={item} onPlay={handlePlay} onContextMenu={handleContextMenu} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* ═══ LISTEN AGAIN ═══ */}
        {recentlyPlayed.length > 0 && (
          <HScrollRow title="Listen again" subtitle="Recently played">
            {recentlyPlayed.map((item, i) => (
              <TrackCard key={'la-' + item.name + i} item={item} onPlay={handlePlay} onContextMenu={handleContextMenu} />
            ))}
          </HScrollRow>
        )}

        {/* ═══ FROM YOUR LIBRARY ═══ */}
        {fromLibrary.length > 0 && (
          <HScrollRow title="From your library" actionLabel="See all" onAction={() => setActiveView('library')}>
            {fromLibrary.map((item, i) => (
              <TrackCard key={'lib-' + item.id + i} item={item} onPlay={handlePlay} onContextMenu={handleContextMenu} />
            ))}
          </HScrollRow>
        )}

        {/* ═══ YOUR TOP ARTISTS ═══ */}
        {topArtists.length > 0 && (
          <HScrollRow title="Your top artists">
            {topArtists.map((artist, i) => {
              return (
                <motion.div key={artist.name} whileHover={{ y: -3, scale: 1.03 }}
                  onClick={() => { useUIStore.getState().setArtistFilter(artist.name); setActiveView('artists'); }}
                  style={{ width: 140, flexShrink: 0, cursor: 'pointer', textAlign: 'center' }}
                >
                  <div style={{ margin: '0 auto 10px', width: 110, height: 110 }}>
                    <ArtThumbShared path={artist.firstPath} seed={artist.name} size={110} type="artist" />
                  </div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{artist.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-dim)' }}>{artist.count} track{artist.count !== 1 ? 's' : ''}</p>
                </motion.div>
              );
            })}
          </HScrollRow>
        )}

        {/* ═══ RECAPS ═══ */}
        {songs.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, padding: '0 4px' }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>Recaps</h3>
            </div>
            <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>
              <RecapCard
                title={`${recapStats.totalTracks} Tracks`}
                subtitle="In your library"
                icon={Music}
                gradient="linear-gradient(135deg, #6366f1, #8b5cf6)"
                onClick={() => setActiveView('library')}
              />
              <RecapCard
                title={`${recapStats.uniqueArtists} Artists`}
                subtitle="Discovered so far"
                icon={Sparkles}
                gradient="linear-gradient(135deg, #ec4899, #f43f5e)"
                onClick={() => setActiveView('artists')}
              />
              <RecapCard
                title={`${recapStats.uniqueAlbums} Albums`}
                subtitle="In your collection"
                icon={Disc3}
                gradient="linear-gradient(135deg, #14b8a6, #06b6d4)"
                onClick={() => setActiveView('albums')}
              />
              <RecapCard
                title={recapStats.topArtist}
                subtitle="Your top artist"
                icon={Heart}
                gradient="linear-gradient(135deg, #f59e0b, #ef4444)"
                onClick={() => { useUIStore.getState().setArtistFilter(recapStats.topArtist); setActiveView('artists'); }}
              />
              <RecapCard
                title={`${recapStats.totalSessions} Plays`}
                subtitle="Playback history"
                icon={BarChart3}
                gradient="linear-gradient(135deg, #3b82f6, #6366f1)"
                onClick={() => setActiveView('history')}
              />
            </div>
          </div>
        )}

        {/* ═══ EMPTY STATE ═══ */}
        {songs.length === 0 && history.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <Disc3 size={56} color="var(--text-dim)" style={{ marginBottom: 20, opacity: 0.4 }} />
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>Welcome to Sloverb Studio</p>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '0 0 24px' }}>Import music or drop files in the Studio to get started.</p>
            <button onClick={() => setActiveView('studio')} className="btn btn-primary" style={{ padding: '10px 24px' }}>
              Open Studio
            </button>
          </div>
        )}
      </motion.div>

      <style>{`
        .play-hover { opacity: 0 !important; }
        div:hover > .play-hover { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
