import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLibraryStore } from '../../stores/libraryStore';
import { usePlayerStore } from '../../stores/playerStore';
import { useUIStore } from '../../stores/uiStore';
import { playbackEngine } from '../../lib/playbackEngine';
import { History as HistoryIcon, Play, Trash2, Clock, Calendar, Download, Loader, CheckCircle, XCircle, HardDrive } from 'lucide-react';
import ArtThumb from '../../components/ArtThumb';

export default function HistoryView() {
  const { playHistory, clearPlayHistory } = useLibraryStore();
  const { activeDownloads, downloadHistory, clearDownloadHistory } = usePlayerStore();
  const { addToast } = useUIStore();
  const [filter, setFilter] = useState('all');
  const [tab, setTab] = useState('plays'); // 'plays' | 'downloads'

  const now = Date.now();
  const DAY = 86400000;

  const filtered = playHistory.filter(item => {
    if (filter === 'today') return (now - item.playedAt) < DAY;
    if (filter === 'week') return (now - item.playedAt) < DAY * 7;
    return true;
  });

  const handlePlay = async (item) => {
    if (!window.electronAPI || !item.path) return;
    try {
      const buf = await window.electronAPI.readFile(item.path);
      const f = new File([buf], item.name || 'track', { type: 'audio/wav' });
      f.path = item.path;
      playbackEngine.loadFileAndPlay(f, { name: item.name, path: item.path, artist: item.artist, album: item.album });
    } catch {
      addToast('Failed to load track', 'error');
    }
  };

  const formatDate = (ms) => {
    const d = new Date(ms);
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < DAY) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < DAY * 2) return 'Yesterday';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  // Group plays by date
  const groups = {};
  filtered.forEach(item => {
    const d = new Date(item.playedAt);
    const key = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });

  // Stats for recap
  const topArtists = {};
  const topSongs = {};
  playHistory.forEach(h => {
    if (h.artist && h.artist !== 'Unknown Artist' && h.artist !== 'Unknown') topArtists[h.artist] = (topArtists[h.artist] || 0) + 1;
    if (h.name) topSongs[h.name] = (topSongs[h.name] || 0) + 1;
  });
  const sortedArtists = Object.entries(topArtists).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const sortedSongs = Object.entries(topSongs).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const tabStyle = (id) => ({
    padding: '8px 20px', borderRadius: 20, fontSize: 12, fontWeight: 600,
    background: tab === id ? 'var(--accent-muted)' : 'transparent',
    color: tab === id ? 'var(--accent)' : 'var(--text-dim)',
    border: `1px solid ${tab === id ? 'var(--accent-secondary)' : 'var(--glass-border)'}`,
    transition: 'all 0.2s', cursor: 'pointer',
  });

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '24px 28px' }}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>History</h2>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>
              {tab === 'plays' ? `${filtered.length} plays · ${playHistory.length} total` : `${downloadHistory.length} downloads`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => setTab('plays')} style={tabStyle('plays')}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><HistoryIcon size={12} /> Plays</span>
            </button>
            <button onClick={() => setTab('downloads')} style={tabStyle('downloads')}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Download size={12} /> Downloads
                {activeDownloads.length > 0 && (
                  <span style={{
                    width: 16, height: 16, borderRadius: '50%', background: 'var(--accent)',
                    color: '#000', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{activeDownloads.length}</span>
                )}
              </span>
            </button>
          </div>
        </div>

        {/* ══════════ DOWNLOADS TAB ══════════ */}
        {tab === 'downloads' && (
          <>
            {/* Active Downloads */}
            {activeDownloads.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 10, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Loader size={11} style={{ animation: 'spin 1.5s linear infinite' }} /> Active Downloads
                </div>
                {activeDownloads.map(dl => (
                  <motion.div key={dl.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12,
                      background: dl.status === 'done' ? 'rgba(80,200,120,0.06)' : dl.status === 'error' ? 'rgba(255,80,80,0.06)' : 'var(--bg-surface)',
                      border: `1px solid ${dl.status === 'done' ? 'rgba(80,200,120,0.15)' : dl.status === 'error' ? 'rgba(255,80,80,0.15)' : 'var(--glass-border)'}`,
                      marginBottom: 6, transition: 'all 0.3s',
                    }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {dl.status === 'downloading' && <Loader size={14} color="var(--accent)" style={{ animation: 'spin 1.5s linear infinite' }} />}
                      {dl.status === 'done' && <CheckCircle size={14} color="rgb(80,200,120)" />}
                      {dl.status === 'error' && <XCircle size={14} color="rgb(255,80,80)" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dl.title}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--text-dim)' }}>
                        {dl.status === 'downloading' ? 'Downloading & merging...' : dl.status === 'done' ? 'Complete ✓' : dl.error || 'Failed'}
                      </p>
                    </div>
                    {dl.status === 'downloading' && (
                      <div style={{ width: 60, height: 3, borderRadius: 2, background: 'var(--glass-border)', overflow: 'hidden' }}>
                        <div style={{
                          width: '100%', height: '100%', background: 'var(--accent)', borderRadius: 2,
                          animation: 'indeterminate 1.5s ease-in-out infinite',
                        }} />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {/* Download History */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Download History</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {downloadHistory.length > 0 && (
                  <button onClick={() => {
                    if (downloadHistory.length === 0) return;
                    const store = usePlayerStore.getState();
                    const first = downloadHistory[0];
                    const rest = downloadHistory.slice(1).map(s => ({ ...s, name: s.title }));
                    store.setQueue(rest);
                    store.setPlaybackContext({ type: 'playlist', playlistId: 'downloads' });
                    handlePlay(first);
                  }}
                  style={{ padding: '4px 10px', borderRadius: 16, fontSize: 10, color: 'var(--text-dim)', background: 'transparent', border: '1px solid var(--glass-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Play size={10} /> Play All
                  </button>
                )}
                {downloadHistory.length > 0 && (
                  <button onClick={() => { clearDownloadHistory(); addToast('Download history cleared', 'info'); }}
                    style={{ padding: '4px 10px', borderRadius: 16, fontSize: 10, color: 'var(--text-dim)', background: 'transparent', border: '1px solid var(--glass-border)', cursor: 'pointer' }}>
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            </div>

            {downloadHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <Download size={48} color="var(--text-dim)" style={{ marginBottom: 16, opacity: 0.3 }} />
                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>No Downloads Yet</p>
                <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>Paste a YouTube link to download your first track.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {downloadHistory.map((dl, i) => (
                  <div key={`${dl.timestamp}-${i}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 10,
                      transition: 'background 0.15s', cursor: 'pointer',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onDoubleClick={() => handlePlay(dl)}
                    onContextMenu={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      useUIStore.getState().openContextMenu({ x: e.clientX, y: e.clientY, track: { ...dl, name: dl.title } });
                    }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, rgba(167,139,250,0.15), rgba(99,102,241,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Download size={14} color="var(--accent)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dl.title}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{dl.artist}</span>
                        {dl.size && <><span style={{ fontSize: 8, color: 'var(--text-dim)' }}>·</span><HardDrive size={9} color="var(--text-dim)" /><span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{formatSize(dl.size)}</span></>}
                        <span style={{ fontSize: 8, color: 'var(--text-dim)' }}>·</span>
                        <Clock size={9} color="var(--text-dim)" />
                        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{formatDate(dl.timestamp)}</span>
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handlePlay(dl); }} className="btn btn-accent-soft" style={{ padding: '3px 10px', fontSize: 10, borderRadius: 16, opacity: 0.6, transition: 'opacity 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                    >
                      <Play size={10} /> Play
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* CSS for animations */}
            <style>{`
              @keyframes spin { to { transform: rotate(360deg); } }
              @keyframes indeterminate {
                0% { transform: translateX(-100%); }
                50% { transform: translateX(0%); }
                100% { transform: translateX(100%); }
              }
            `}</style>
          </>
        )}

        {/* ══════════ PLAYS TAB ══════════ */}
        {tab === 'plays' && (
          <>
            {/* Filters */}
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 20 }}>
              {[
                { id: 'all', label: 'All Time' },
                { id: 'week', label: 'This Week' },
                { id: 'today', label: 'Today' },
              ].map(f => (
                <button key={f.id} onClick={() => setFilter(f.id)}
                  style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                    background: filter === f.id ? 'var(--accent-muted)' : 'transparent',
                    color: filter === f.id ? 'var(--accent)' : 'var(--text-dim)',
                    border: `1px solid ${filter === f.id ? 'var(--accent-secondary)' : 'var(--glass-border)'}`,
                    transition: 'all 0.15s', cursor: 'pointer',
                  }}
                >{f.label}</button>
              ))}
              {filtered.length > 0 && (
                <button onClick={() => {
                  if (filtered.length === 0) return;
                  const store = usePlayerStore.getState();
                  const first = filtered[0];
                  const rest = filtered.slice(1).map(s => ({ ...s, name: s.name }));
                  store.setQueue(rest);
                  store.setPlaybackContext({ type: 'playlist', playlistId: 'history' });
                  handlePlay(first);
                }}
                  style={{ padding: '6px 14px', borderRadius: 20, fontSize: 11, color: 'var(--text-dim)', background: 'transparent', border: '1px solid var(--glass-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}
                ><Play size={11} /> Play All</button>
              )}
              {playHistory.length > 0 && (
                <button onClick={() => { clearPlayHistory(); addToast('History cleared', 'info'); }}
                  style={{ padding: '6px 10px', borderRadius: 20, fontSize: 11, color: 'var(--text-dim)', background: 'transparent', border: '1px solid var(--glass-border)', cursor: 'pointer' }}
                ><Trash2 size={11} /></button>
              )}
            </div>

            {/* Mini Stats — Interactive */}
            {playHistory.length > 3 && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 160, padding: '14px 16px', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--glass-border)' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Top Artists</div>
                  {sortedArtists.map(([name, count], i) => {
                    const artistSong = playHistory.find(h => h.artist === name && h.path);
                    return (
                      <div key={name}
                        onClick={() => { useUIStore.getState().setArtistFilter(name); useUIStore.getState().setActiveView('artists'); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: i === 0 ? 'var(--accent)' : 'var(--text)', padding: '4px 6px', fontWeight: i === 0 ? 600 : 400, borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <ArtThumb path={artistSong?.path} seed={name} size={24} type="artist" />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                        <span style={{ color: 'var(--text-dim)', flexShrink: 0, fontSize: 10 }}>{count} plays</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ flex: 1, minWidth: 160, padding: '14px 16px', borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--glass-border)' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Most Played</div>
                  {sortedSongs.map(([name, count], i) => {
                    const songItem = playHistory.find(h => h.name === name && h.path);
                    return (
                      <div key={name}
                        onClick={() => songItem && handlePlay(songItem)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: i === 0 ? 'var(--accent)' : 'var(--text)', padding: '4px 6px', fontWeight: i === 0 ? 600 : 400, borderRadius: 8, cursor: 'pointer', transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <ArtThumb path={songItem?.path} seed={name} size={24} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{name}</span>
                        <span style={{ color: 'var(--text-dim)', flexShrink: 0, fontSize: 10 }}>{count}×</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Content */}
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                <HistoryIcon size={56} color="var(--text-dim)" style={{ marginBottom: 20, opacity: 0.4 }} />
                <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>No Plays Yet</p>
                <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>
                  {filter !== 'all' ? 'No plays found for this period.' : 'Play a track and it will appear here.'}
                </p>
              </div>
            ) : (
              Object.entries(groups).map(([date, items]) => (
                <div key={date} style={{ marginBottom: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Calendar size={12} color="var(--text-dim)" />
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{date}</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--glass-border)' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {items.map((item, i) => (
                      <div key={`${item.playedAt}-${i}`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '6px 12px', borderRadius: 10,
                          transition: 'background 0.15s', cursor: 'pointer',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; const b = e.currentTarget.querySelector('.h-btns'); if (b) b.style.opacity = '1'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; const b = e.currentTarget.querySelector('.h-btns'); if (b) b.style.opacity = '0'; }}
                        onDoubleClick={() => handlePlay(item)}
                        onContextMenu={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          useUIStore.getState().openContextMenu({ x: e.clientX, y: e.clientY, track: item });
                        }}
                      >
                        <ArtThumb path={item.path} seed={item.name} size={36} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                            {item.artist && <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{item.artist}</span>}
                            <Clock size={9} color="var(--text-dim)" />
                            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{formatDate(item.playedAt)}</span>
                          </div>
                        </div>
                        <div className="h-btns" style={{ display: 'flex', gap: 4, opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 }}>
                          <button onClick={(e) => { e.stopPropagation(); handlePlay(item); }} className="btn btn-accent-soft" style={{ padding: '3px 10px', fontSize: 10, borderRadius: 16 }}>
                            <Play size={10} /> Play
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
