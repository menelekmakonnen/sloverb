import TitleBar from './TitleBar';
import Sidebar from './Sidebar';
import NowPlayingBar from './NowPlayingBar';
import SpaceBackground from '../SpaceBackground';
import ToastContainer from '../Toast';
import QueueDrawer from '../QueueDrawer';
import ContextMenu from '../ContextMenu';
import ScrollNav from '../ScrollNav';
import { useUIStore } from '../../stores/uiStore';
import { usePlayerStore } from '../../stores/playerStore';
import { PRESETS } from '../../lib/audioEngine.js';
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import StudioView from '../../features/Studio/StudioView';
import LibraryView from '../../features/Library/LibraryView';
import PlaylistsView from '../../features/Playlists/PlaylistsView';
import HomeView from '../../features/Home/HomeView';
import ArtistsView from '../../features/Artists/ArtistsView';
import AlbumsView from '../../features/Albums/AlbumsView';
import HistoryView from '../../features/History/HistoryView';
import SettingsView from '../../features/Settings/SettingsView';
import FolderView from '../../features/Folders/FolderView';

export default function AppShell() {
  const { activeView, mode, creditsTrack, setCreditsTrack, studioDrawerOpen, setStudioDrawerOpen, spaceAdventure } = useUIStore();
  const immersive = spaceAdventure === 'immersive';
  const { fileName, currentTrack } = usePlayerStore();

  // Global scroll wheel → volume control (Ctrl+scroll to avoid hijacking page scroll)
  useEffect(() => {
    const handleWheel = (e) => {
      if (!e.ctrlKey) return; // Only when Ctrl is held
      e.preventDefault();
      const store = usePlayerStore.getState();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      const newVol = Math.max(0, Math.min(4, store.masterVolume + delta));
      store.setMasterVolume(Math.round(newVol * 100) / 100);
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  const renderView = () => {
    switch (activeView) {
      case 'home': return <HomeView />;
      case 'studio': return <StudioView />;
      case 'library': return <LibraryView />;
      case 'playlists': return <PlaylistsView />;
      case 'artists': return <ArtistsView />;
      case 'albums': return <AlbumsView />;
      case 'history': return <HistoryView />;
      case 'folders': return <FolderView />;
      case 'settings': return <SettingsView />;
      default: return <HomeView />;
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      background: mode === 'dark' ? 'transparent' : 'var(--bg)',
      color: 'var(--text)',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Cosmic Background */}
      {mode === 'dark' && <SpaceBackground />}

      {/* Title Bar — hidden in immersive */}
      {!immersive && <TitleBar />}

      {/* Main Area — hidden in immersive */}
      {!immersive && (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative', zIndex: 1 }}>
          <Sidebar />
          <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            {renderView()}
          </main>
        </div>
      )}

      {/* Studio Drawer — slides up from NowPlayingBar */}
      <AnimatePresence>
        {studioDrawerOpen && !immersive && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            style={{
              position: 'fixed',
              left: 0, right: 0,
              bottom: 'var(--nowplaying-height)',
              top: 'var(--titlebar-height, 38px)',
              zIndex: 40,
              background: 'var(--bg)',
              borderTop: '2px solid var(--accent)',
              overflow: 'hidden',
            }}
          >
            {/* Close handle bar at top */}
            <div
              onClick={() => setStudioDrawerOpen(false)}
              style={{
                height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', borderBottom: '1px solid var(--glass-border)',
                background: 'var(--bg-surface)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-surface)'}
            >
              <div style={{ width: 40, height: 3, borderRadius: 2, background: 'var(--text-dim)', opacity: 0.4 }} />
            </div>
            <div style={{ height: 'calc(100% - 28px)', overflow: 'auto' }}>
              <StudioView />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Now Playing Bar — always visible; in immersive mode, premium floating center */}
      {immersive ? (
        <>
          {/* Window controls — top right, visible on hover */}
          <div className="immersive-controls" style={{
            position: 'fixed', top: 0, right: 0, zIndex: 999,
            display: 'flex', gap: 0, opacity: 0, transition: 'opacity 0.3s',
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0'}
          >
            <div style={{ width: '100vw', height: 36, position: 'absolute', top: 0, left: 0 }} 
              onMouseEnter={e => e.currentTarget.parentElement.style.opacity = '1'} />
            {[
              { label: '—', action: () => window.electronAPI?.windowControl?.('minimize') },
              { label: '☐', action: () => window.electronAPI?.windowControl?.('maximize') },
              { label: '✕', action: () => window.electronAPI?.windowControl?.('close'), danger: true },
            ].map((btn, i) => (
              <button key={i} onClick={btn.action} style={{
                width: 46, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: 13,
                border: 'none', cursor: 'pointer', transition: 'background 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = btn.danger ? 'rgba(220,50,50,0.8)' : 'rgba(255,255,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >{btn.label}</button>
            ))}
          </div>

          {/* Immersive Metadata (Top Left) — elegant and visible */}
          <div style={{
            position: 'fixed', top: 40, left: 40, zIndex: 55,
            display: 'flex', flexDirection: 'column', gap: 6,
            pointerEvents: 'none',
            textShadow: '0 2px 12px rgba(0,0,0,0.8)'
          }}>
            {fileName && (
              <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
                {fileName}
              </div>
            )}
            {currentTrack?.artist && (
              <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
                {currentTrack.artist}
              </div>
            )}
            {currentTrack?.album && (
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                Album: {currentTrack.album}
              </div>
            )}
            {currentTrack?.year && (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                Released: {currentTrack.year}
              </div>
            )}
            {currentTrack?.links && currentTrack.links.map((link, i) => (
              <a key={i} href={link.url} target="_blank" rel="noreferrer" style={{
                fontSize: 13, color: 'var(--primary)', pointerEvents: 'auto', textDecoration: 'none', marginTop: 4
              }}>
                {link.label || link.url}
              </a>
            ))}
          </div>

          {/* Exit & Normal View buttons — transparent by default, translucent on hover */}
          <div style={{
            position: 'fixed', bottom: 24, left: 24, zIndex: 55,
            opacity: 0, transition: 'opacity 0.3s', display: 'flex', flexDirection: 'column', gap: 8
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0'}
          >
            {/* Hover zone */}
            <div style={{ position: 'absolute', bottom: -24, left: -24, width: 200, height: 120 }} />
            <button
              onClick={() => useUIStore.getState().setSpaceAdventure('on')}
              style={{
                padding: '8px 18px', borderRadius: 24, fontSize: 12, fontWeight: 600,
                background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)',
                border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer',
                backdropFilter: 'blur(16px)', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
            >
              ◫ Normal View
            </button>
            <button
              onClick={() => useUIStore.getState().setSpaceAdventure('off')}
              style={{
                padding: '8px 18px', borderRadius: 24, fontSize: 12, fontWeight: 600,
                background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)',
                border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer',
                backdropFilter: 'blur(16px)', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
            >
              ◀ Exit Flight
            </button>
          </div>

          {/* Floating player + presets + queue — transparent by default */}
          <div
            className="immersive-player-panel"
            style={{
              position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              width: 680, maxWidth: '94vw', zIndex: 50,
              background: 'rgba(10, 10, 30, 0.0)',
              borderRadius: 20, border: '1px solid rgba(255,255,255,0.0)',
              overflow: 'hidden',
              transition: 'background 0.4s, border-color 0.4s, box-shadow 0.4s, backdrop-filter 0.4s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(10, 10, 30, 0.7)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.boxShadow = '0 12px 48px rgba(0,0,0,0.6)';
              e.currentTarget.style.backdropFilter = 'blur(24px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(10, 10, 30, 0.0)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.0)';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.backdropFilter = 'blur(0px)';
            }}
          >
            {/* Audio Presets Strip */}
            <ImmersivePresets />

            {/* Up Next Queue (scrollable, above controls) */}
            <ImmersiveQueue />

            <NowPlayingBar />
          </div>

          <style>{`
            .immersive-player-panel > * { transition: opacity 0.3s ease; opacity: 0; pointer-events: none; }
            .immersive-player-panel:hover > * { opacity: 1; pointer-events: auto; }
          `}</style>
        </>
      ) : (
        <NowPlayingBar />
      )}

      {/* Queue Drawer */}
      <QueueDrawer />

      {/* Scroll Navigation */}
      {!immersive && <ScrollNav />}

      <ContextMenu />

      {/* Credits Modal */}
      {creditsTrack && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setCreditsTrack(null)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-elevated)', borderRadius: 16, padding: 28, width: 360,
            border: '1px solid var(--glass-border)', boxShadow: '0 16px 64px rgba(0,0,0,0.5)',
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 16px' }}>Song Credits</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <CreditRow label="Title" value={creditsTrack.name} />
              <CreditRow label="Artist" value={creditsTrack.artist || 'Unknown'} />
              <CreditRow label="Album" value={creditsTrack.album || 'Unknown'} />
              <CreditRow label="Type" value={creditsTrack.type || 'audio'} />
              {creditsTrack.path && <CreditRow label="Path" value={creditsTrack.path} />}
            </div>
            <button onClick={() => setCreditsTrack(null)} className="btn btn-accent-soft" style={{ width: '100%', marginTop: 20, padding: '10px 0' }}>Close</button>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer />
    </div>
  );
}

/* ─── Immersive Presets Strip ─── */
function ImmersivePresets() {
  const { activePresets, applyPreset } = usePlayerStore();
  const presetNames = Object.keys(PRESETS);
  return (
    <div style={{
      display: 'flex', gap: 6, padding: '10px 16px 8px',
      overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.04)',
      scrollbarWidth: 'none',
    }}>
      {presetNames.map(name => {
        const isActive = activePresets.includes(name);
        return (
          <button key={name} onClick={(e) => applyPreset(name, e.ctrlKey || e.shiftKey)} style={{
            padding: '4px 12px', borderRadius: 14, fontSize: 10, fontWeight: 600,
            whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
            background: isActive ? 'rgba(var(--accent-rgb, 139,92,246), 0.25)' : 'rgba(255,255,255,0.04)',
            color: isActive ? 'var(--accent)' : 'rgba(255,255,255,0.5)',
            border: `1px solid ${isActive ? 'rgba(var(--accent-rgb, 139,92,246), 0.3)' : 'rgba(255,255,255,0.06)'}`,
          }}
            onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}}
            onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}}
          >{name}</button>
        );
      })}
    </div>
  );
}

/* ─── Immersive Queue ─── */
function ImmersiveQueue() {
  const queue = usePlayerStore(s => s.queue);
  if (!queue || queue.length === 0) return null;
  return (
    <div style={{
      maxHeight: 120, overflow: 'auto', padding: '8px 16px 4px',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.25)', marginBottom: 4 }}>Up Next</div>
      {queue.slice(0, 6).map((item, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0',
          fontSize: 11, color: i === 0 ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.35)',
        }}>
          <span style={{ width: 14, textAlign: 'right', fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>{i + 1}</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name || 'Unknown'}</span>
          <button onClick={() => usePlayerStore.getState().removeFromQueue(i)} style={{
            fontSize: 9, color: 'rgba(255,255,255,0.15)', cursor: 'pointer', padding: '0 4px',
            background: 'none', border: 'none',
          }} onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,100,100,0.7)'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.15)'}>✕</button>
        </div>
      ))}
      {queue.length > 6 && (
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)', padding: '2px 0' }}>+{queue.length - 6} more</div>
      )}
    </div>
  );
}

function CreditRow({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text)', wordBreak: 'break-all' }}>{value}</div>
    </div>
  );
}
