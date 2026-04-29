import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '../../stores/playerStore';
import { useUIStore } from '../../stores/uiStore';
import { playbackEngine } from '../../lib/playbackEngine';
import { PRESETS } from '../../lib/audioEngine';
import TrackRow from './TrackRow';
import TrackCard from './TrackCard';
import './stream.css';
import {
  Search, Play, Pause, Square, Loader2, Radio,
  ListPlus, Trash2, GripVertical, ChevronDown, LogIn, LogOut,
  Heart, History, Link2, Unlink, Music2, LayoutGrid, List
} from 'lucide-react';

function formatDuration(sec) {
  if (!sec || isNaN(sec)) return '--:--';
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}

function Slider({ label, value, min = 0, max = 1, step = 0.01, onChange, display }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 11, color: 'var(--text-dim)', width: 72, flexShrink: 0, textAlign: 'right' }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))} className="slider"
        style={{ flex: 1, accentColor: 'var(--accent)' }} />
      <span style={{ fontSize: 10, color: 'var(--text-dim)', width: 36 }}>{display || value.toFixed(2)}</span>
    </div>
  );
}

export default function StreamView() {
  const { addToast } = useUIStore();
  const { params, activePresets, isPlaying, isProcessing, loadingText, isStreaming, streamTrack, currentTime, audioBuffer, ytBrowser, streamHistory, currentTrack, ytPlaylists } = usePlayerStore();
  const setParam = usePlayerStore(s => s.setParam);
  const applyPreset = usePlayerStore(s => s.applyPreset);
  const setYtBrowser = usePlayerStore(s => s.setYtBrowser);
  const addToStreamHistory = usePlayerStore(s => s.addToStreamHistory);

  const [tab, setTab] = useState('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [streamQueue, setStreamQueue] = useState([]);
  const [loggingIn, setLoggingIn] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'list' or 'grid'

  const [likedVideos, setLikedVideos] = useState([]);
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [playlistItems, setPlaylistItems] = useState([]);
  const [playlistTitle, setPlaylistTitle] = useState('');
  const [loadingLib, setLoadingLib] = useState(false);

  const searchRef = useRef(null);
  const presetNames = useMemo(() => Object.keys(PRESETS), []);
  const duration = audioBuffer?.duration || streamTrack?.duration || 0;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const api = window.electronAPI;

  // Check connection on mount
  useEffect(() => {
    if (!api) return;
    api.ytConnectionStatus().then(s => setYtBrowser(s)).catch(() => {});
  }, []);

  // ═══ AUTH ═══
  const handleLogin = useCallback(async () => {
    if (!api) return;
    setLoggingIn(true);
    try {
      const result = await api.ytLogin();
      if (result.connected) {
        setYtBrowser(result);
        addToast('Signed in to YouTube!', 'success');
      } else if (result.cancelled) {
        addToast('Login cancelled', 'info');
      }
    } catch (e) { addToast('Login failed: ' + e.message, 'error'); }
    setLoggingIn(false);
  }, [api, addToast, setYtBrowser]);

  const handleLogout = useCallback(async () => {
    if (!api) return;
    await api.ytDisconnect();
    setYtBrowser({ connected: false });
    setLikedVideos([]);
    setPlaylistItems([]);
    addToast('Signed out', 'info');
  }, [api, addToast, setYtBrowser]);

  // ═══ SEARCH ═══
  const handleSearch = useCallback(async () => {
    if (!query.trim() || !api) return;
    setSearching(true);
    try {
      const r = await api.ytSearch(query.trim());
      setResults(r || []);
      if (!r || r.length === 0) addToast('No results found', 'info');
    } catch (e) { addToast('Search failed: ' + e.message, 'error'); }
    setSearching(false);
  }, [query, api, addToast]);

  // ═══ LIBRARY ═══
  const loadLikedVideos = useCallback(async () => {
    if (!api || likedVideos.length > 0) return;
    setLoadingLib(true);
    try {
      const items = await api.ytGetLikedVideos();
      setLikedVideos(items || []);
    } catch (e) { addToast('Failed: ' + e.message, 'error'); }
    setLoadingLib(false);
  }, [api, addToast, likedVideos.length]);

  const loadPlaylist = useCallback(async () => {
    if (!api || !playlistUrl.trim()) return;
    setLoadingLib(true);
    try {
      const data = await api.ytGetPlaylistItems(playlistUrl.trim());
      setPlaylistItems(data.items || []);
      setPlaylistTitle(data.title || 'Playlist');
    } catch (e) { addToast('Failed: ' + e.message, 'error'); }
    setLoadingLib(false);
  }, [api, addToast, playlistUrl]);

  useEffect(() => {
    if (!ytBrowser.connected) return;
    if (tab === 'liked') loadLikedVideos();
    if (tab === 'playlist' && ytPlaylists.length === 0) {
      usePlayerStore.getState().loadYtPlaylists();
    }
  }, [tab, ytBrowser.connected]);

  // ═══ STREAM ═══
  const handleStream = useCallback((item) => {
    addToStreamHistory(item);
    playbackEngine.startStream(item);
  }, [addToStreamHistory]);
  const handleStop = useCallback(() => playbackEngine.stopStream(), []);
  const addToQueue = (item) => {
    if (streamQueue.find(q => q.id === item.id)) return;
    setStreamQueue(q => [...q, item]);
    addToast(`Queued: ${item.title}`, 'success');
  };

  const hasRightPanel = streamTrack || isStreaming;

  // ═══ VIEW TOGGLE ═══
  const ViewToggle = () => (
    <div className="view-toggle">
      <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} title="List view"><List size={14} /></button>
      <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} title="Grid view"><LayoutGrid size={14} /></button>
    </div>
  );

  const { openContextMenu } = useUIStore();

  const handleContextMenu = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    openContextMenu({ x: e.clientX, y: e.clientY, track: { ...item, type: 'stream' } });
  };

  const renderItems = (items) => viewMode === 'grid' ? (
    <div className="stream-grid-results">
      {items.map((item, i) => {
        const isActive = currentTrack?.type === 'stream' && (currentTrack?.id === item.url || currentTrack?.id === item.id);
        return <TrackCard key={item.id + i} item={item} isActive={isActive} onPlay={handleStream} onQueue={addToQueue} onContextMenu={e => handleContextMenu(e, item)} />;
      })}
    </div>
  ) : (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {items.map((item, i) => {
        const isActive = currentTrack?.type === 'stream' && (currentTrack?.id === item.url || currentTrack?.id === item.id);
        return <TrackRow key={item.id + i} item={item} index={i} isActive={isActive} onPlay={handleStream} onQueue={addToQueue} onContextMenu={e => handleContextMenu(e, item)} />;
      })}
    </div>
  );

  // ═══ TAB RENDERERS ═══
  const renderSearch = () => (
    <>
      <div className="stream-search-bar">
        <div className="inner">
          <Search size={16} className="icon" />
          <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search YouTube for songs, artists, albums..." className="input" />
        </div>
        <button onClick={handleSearch} disabled={searching || !query.trim()}
          className="btn btn-primary" style={{ padding: '8px 20px', borderRadius: 8, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          {searching ? <Loader2 size={14} className="spin" /> : <Search size={14} />} Search
        </button>
      </div>
      {results.length > 0 ? (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <h3 className="stream-section-title" style={{ margin: 0 }}><Search size={14} color="var(--accent)" /> Results <span className="count">({results.length})</span></h3>
            <ViewToggle />
          </div>
          {renderItems(results)}
        </div>
      ) : !searching && (
        <div className="stream-empty">
          <Search size={40} color="var(--text-dim)" className="icon" />
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>Search for music</p>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>Find any song on YouTube and stream it with effects</p>
        </div>
      )}
    </>
  );

  // ═══ PLAY ALL ═══
  const handlePlayAllStream = useCallback((items) => {
    if (!items || items.length === 0) return;
    const store = usePlayerStore.getState();
    const first = items[0];
    const rest = items.slice(1).map(item => ({ ...item, type: 'stream' }));
    store.setQueue(rest);
    store.setPlaybackContext({ type: 'stream-playlist', playlistId: 'multi' });
    handleStream(first);
  }, [handleStream]);

  const renderLiked = () => {
    if (!ytBrowser.connected) return <LoginPrompt onLogin={handleLogin} loading={loggingIn} />;
    if (loadingLib) return <Loading text="Loading liked songs... this may take a moment" />;
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 className="stream-section-title" style={{ margin: 0 }}><Heart size={14} color="#ff4466" /> Liked Songs <span className="count">({likedVideos.length})</span></h3>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {likedVideos.length > 0 && <button onClick={() => handlePlayAllStream(likedVideos)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 11, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 6 }}><Play size={12} /> Play All</button>}
            {likedVideos.length > 0 && <ViewToggle />}
          </div>
        </div>
        {likedVideos.length === 0
          ? <div className="stream-empty"><Heart size={40} color="var(--text-dim)" className="icon" /><p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>No liked videos found</p></div>
          : renderItems(likedVideos)
        }
      </>
    );
  };

  const renderPlaylist = () => {
    if (!ytBrowser.connected) return <LoginPrompt onLogin={handleLogin} loading={loggingIn} />;
    return (
      <>
        <div className="stream-search-bar" style={{ marginBottom: 16 }}>
          <div className="inner">
            <Link2 size={16} className="icon" />
            <input value={playlistUrl} onChange={e => setPlaylistUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadPlaylist()}
              placeholder="Paste a YouTube/YouTube Music playlist URL..." className="input" />
          </div>
          <button onClick={loadPlaylist} disabled={loadingLib || !playlistUrl.trim()}
            className="btn btn-primary" style={{ padding: '8px 20px', borderRadius: 8, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            {loadingLib ? <Loader2 size={14} className="spin" /> : <Music2 size={14} />} Load
          </button>
        </div>
        {playlistItems.length > 0 ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 className="stream-section-title" style={{ margin: 0 }}><Music2 size={14} color="var(--accent)" /> {playlistTitle} <span className="count">({playlistItems.length})</span></h3>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button onClick={() => handlePlayAllStream(playlistItems)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 11, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 6 }}><Play size={12} /> Play All</button>
                <ViewToggle />
              </div>
            </div>
            {renderItems(playlistItems)}
          </>
        ) : ytPlaylists?.length > 0 ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 className="stream-section-title" style={{ margin: 0 }}><List size={14} color="var(--accent)" /> Your YouTube Playlists <span className="count">({ytPlaylists.length})</span></h3>
            </div>
            <div className="stream-grid-results">
              {ytPlaylists.map((pl, i) => (
                <motion.div key={pl.id} whileHover={{ y: -4, scale: 1.02 }}
                  onClick={() => {
                    setPlaylistUrl(pl.url);
                    // trigger load automatically if desired, but setting URL is safe
                  }}
                  style={{
                    background: 'var(--bg-surface)', borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
                    border: '1px solid var(--glass-border)'
                  }}
                >
                  <div style={{ height: 110, position: 'relative', background: '#111' }}>
                    {pl.thumbnail && <img src={pl.thumbnail} alt={pl.title} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }} />
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.title}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--text-dim)' }}>{pl.count} tracks</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        ) : !loadingLib && (
          <div className="stream-empty">
            <Music2 size={40} color="var(--text-dim)" className="icon" />
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>Load a playlist</p>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>Paste any YouTube or YouTube Music playlist URL above</p>
          </div>
        )}
      </>
    );
  };

  const renderRecent = () => (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h3 className="stream-section-title" style={{ margin: 0 }}><History size={14} color="var(--accent)" /> Recent Streams <span className="count">({streamHistory.length})</span></h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {streamHistory.length > 0 && <button onClick={() => handlePlayAllStream(streamHistory)} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 11, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 6 }}><Play size={12} /> Play All</button>}
          {streamHistory.length > 0 && <ViewToggle />}
        </div>
      </div>
      {streamHistory.length === 0
        ? <div className="stream-empty"><History size={40} color="var(--text-dim)" className="icon" /><p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 4px' }}>No recent streams</p></div>
        : renderItems(streamHistory)
      }
    </>
  );

  const tabs = [
    { id: 'search', icon: Search, label: 'Search', render: renderSearch },
    { id: 'liked', icon: Heart, label: 'Liked', render: renderLiked },
    { id: 'playlist', icon: Music2, label: 'Playlist', render: renderPlaylist },
    { id: 'recent', icon: History, label: 'Recent', render: renderRecent },
  ];

  return (
    <div className="stream-page">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="stream-inner">
        {/* Header */}
        <div className="stream-header">
          <Radio size={24} color="var(--accent)" />
          <div>
            <h2>Stream</h2>
            <p>Search YouTube · stream with real-time effects</p>
          </div>
          {ytBrowser.connected && (
            <div className="stream-user-bar">
              <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>● YouTube Connected</span>
              <button className="yt-logout-btn" onClick={handleLogout}><LogOut size={10} /> Sign Out</button>
            </div>
          )}
        </div>

        {/* Login CTA */}
        {!ytBrowser.connected && (
          <div className="stream-login-cta">
            <Music2 size={36} color="var(--accent)" style={{ marginBottom: 12 }} />
            <h3>Sign in to YouTube</h3>
            <p>Access your liked songs, playlists, and YouTube Music library.<br/>No API keys — signs in securely inside Sloverb.</p>
            <button className="yt-login-btn" onClick={handleLogin} disabled={loggingIn}>
              {loggingIn ? <Loader2 size={16} className="spin" /> : <LogIn size={16} />}
              {loggingIn ? 'Signing in...' : 'Sign in with YouTube'}
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="stream-tabs">
          {tabs.map(t => (
            <button key={t.id} className={`stream-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>

        {/* Layout */}
        <div className={`stream-grid ${hasRightPanel ? '' : 'single'}`}>
          <div>
            {/* Now Playing */}
            <AnimatePresence>
              {(isStreaming || streamTrack) && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="now-playing-banner">
                  <div className="row">
                    {streamTrack?.thumbnail && <img src={streamTrack.thumbnail} alt="" />}
                    <div className="meta">
                      <p className="title">{isProcessing ? loadingText : (streamTrack?.title || 'Streaming...')}</p>
                      <p className="sub">{streamTrack?.channel} · {formatDuration(duration)}</p>
                      {!isProcessing && <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>}
                    </div>
                    <div className="controls">
                      {isProcessing ? <Loader2 size={20} className="spin" color="var(--accent)" /> : (
                        <>
                          <button onClick={() => playbackEngine.togglePlay()} className="btn btn-accent-soft" style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {isPlaying ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: 2 }} />}
                          </button>
                          <button onClick={handleStop} className="btn btn-ghost" style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Square size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Queue */}
            {streamQueue.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h3 className="stream-section-title"><ListPlus size={14} color="var(--accent)" /> Queue <span className="count">({streamQueue.length})</span></h3>
                {streamQueue.map((item, i) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8 }}>
                    <GripVertical size={12} color="var(--text-dim)" style={{ opacity: .4 }} />
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', width: 16, textAlign: 'right' }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</p>
                    </div>
                    <button onClick={() => handleStream(item)} className="btn btn-accent-soft" style={{ padding: '3px 8px', fontSize: 9, borderRadius: 12 }}><Play size={9} /></button>
                    <button onClick={() => setStreamQueue(q => q.filter(x => x.id !== item.id))} className="btn btn-ghost" style={{ padding: '3px 6px', borderRadius: 12 }}><Trash2 size={10} /></button>
                  </div>
                ))}
              </div>
            )}

            {tabs.find(t => t.id === tab)?.render()}
          </div>

          {/* Effects Panel */}
          {hasRightPanel && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="effects-panel">
              <h3><ChevronDown size={14} color="var(--accent)" /> Live Effects</h3>
              <div className="preset-chips">
                {presetNames.map(name => (
                  <button key={name} onClick={() => applyPreset(name, false)}
                    className={`preset-chip ${activePresets.includes(name) ? 'active' : ''}`}>{name}</button>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Slider label="Speed" value={params.speed} min={0.5} max={1.2} step={0.01} onChange={v => setParam('speed', v)} display={`${params.speed.toFixed(2)}x`} />
                <Slider label="Reverb Mix" value={params.reverbMix} onChange={v => setParam('reverbMix', v)} />
                <Slider label="Reverb Size" value={params.reverbSize} min={0.1} max={8} step={0.1} onChange={v => setParam('reverbSize', v)} display={`${params.reverbSize.toFixed(1)}s`} />
                <Slider label="Reverb Decay" value={params.reverbDecay} min={0.1} max={6} step={0.1} onChange={v => setParam('reverbDecay', v)} display={`${params.reverbDecay.toFixed(1)}s`} />
                <Slider label="Bass Boost" value={params.bassBoost} min={0} max={15} step={0.5} onChange={v => setParam('bassBoost', v)} display={`${params.bassBoost.toFixed(0)}dB`} />
                <Slider label="Warmth" value={params.warmth} min={0} max={10} step={0.5} onChange={v => setParam('warmth', v)} />
                <Slider label="Vinyl" value={params.vinyl || 0} onChange={v => setParam('vinyl', v)} />
                <Slider label="Stereo" value={params.stereoWidth || 0} onChange={v => setParam('stereoWidth', v)} />
              </div>
              <div className="mode-toggle">
                {['Original', 'Effect'].map(mode => (
                  <button key={mode} onClick={() => setParam('preservePitch', mode === 'Original')}
                    className={mode === 'Original' ? (params.preservePitch ? 'active' : '') : (!params.preservePitch ? 'active' : '')}>{mode}</button>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function LoginPrompt({ onLogin, loading }) {
  return (
    <div className="stream-empty">
      <LogIn size={40} color="var(--text-dim)" className="icon" />
      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: '0 0 8px' }}>Sign in required</p>
      <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '0 0 16px' }}>Sign in to YouTube to access this content</p>
      <button className="yt-login-btn" onClick={onLogin} disabled={loading}>
        {loading ? <Loader2 size={16} className="spin" /> : <LogIn size={16} />}
        {loading ? 'Signing in...' : 'Sign in with YouTube'}
      </button>
    </div>
  );
}

function Loading({ text }) {
  return <div className="stream-loading"><Loader2 size={18} className="spin" /> {text}</div>;
}
