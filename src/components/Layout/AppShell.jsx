import TitleBar from './TitleBar';
import Sidebar from './Sidebar';
import NowPlayingBar from './NowPlayingBar';
import SpaceBackground from '../SpaceBackground';
import HarmattanBackground from '../HarmattanBackground';

import ToastContainer from '../Toast';
import QueueDrawer from '../QueueDrawer';
import ContextMenu from '../ContextMenu';
import ScrollNav from '../ScrollNav';
import { useUIStore } from '../../stores/uiStore';
import { usePlayerStore } from '../../stores/playerStore';
import { PRESETS } from '../../lib/audioEngine.js';
import { playbackEngine } from '../../lib/playbackEngine.js';
import { useEffect, useState, useRef, useCallback } from 'react';
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
import StreamView from '../../features/Stream/StreamView';

export default function AppShell() {
  const { activeView, mode, creditsTrack, setCreditsTrack, studioDrawerOpen, setStudioDrawerOpen, spaceAdventure, superImmersive, backgroundTheme, cycleBackgroundTheme } = useUIStore();
  const immersive = spaceAdventure === 'immersive';

  // ── Inactivity timer for immersive mode (10s fade) ──
  const [immersiveActive, setImmersiveActive] = useState(true);
  const inactivityTimer = useRef(null);
  const resetActivity = useCallback(() => {
    setImmersiveActive(true);
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => setImmersiveActive(false), 10000);
  }, []);
  useEffect(() => {
    if (!immersive || superImmersive) return;
    resetActivity();
    window.addEventListener('mousemove', resetActivity);
    window.addEventListener('mousedown', resetActivity);
    return () => {
      window.removeEventListener('mousemove', resetActivity);
      window.removeEventListener('mousedown', resetActivity);
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [immersive, superImmersive, resetActivity]);

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

  // ── Keyboard shortcuts: Space=play/pause, Esc=cycle back, MediaStop=stop ──
  useEffect(() => {
    const handleKey = (e) => {
      // Don't intercept when typing in inputs
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return;

      if (e.code === 'Space') {
        e.preventDefault();
        playbackEngine.togglePlay();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        const ui = useUIStore.getState();
        if (ui.superImmersive) {
          // Super Immersive → Normal Immersive
          ui.setSuperImmersive(false);
        } else if (ui.spaceAdventure === 'immersive') {
          // Immersive → Standard (flight on)
          ui.setSpaceAdventure('on');
        } else if (ui.spaceAdventure === 'on') {
          // Flight on → Flight off
          ui.setSpaceAdventure('off');
        } else {
          // Standard → go to studio view
          ui.setActiveView('studio');
          ui.setStudioDrawerOpen(false);
        }
      } else if (e.key === 'MediaStop' || e.code === 'MediaStop') {
        e.preventDefault();
        playbackEngine.stop();
        playbackEngine.pauseOffset = 0;
        usePlayerStore.getState().setCurrentTime(0);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
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
      case 'stream': return <StreamView />;
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
      {/* Background — Space or Harmattan */}
      {mode === 'dark' && (
        backgroundTheme === 'harmattan' ? <HarmattanBackground /> : <SpaceBackground />
      )}

      {/* Title Bar — animated fold-away */}
      <AnimatePresence>
        {!immersive && (
          <motion.div
            key="titlebar"
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1], delay: immersive ? 0 : 0.15 }}
            style={{ zIndex: 2, position: 'relative' }}
          >
            <TitleBar />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Area — sidebar slides left, content fades */}
      <AnimatePresence>
        {!immersive && (
          <motion.div
            key="main-area"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1], delay: immersive ? 0 : 0.05 }}
            style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative', zIndex: 1 }}
          >
            <motion.div
              initial={{ x: -220, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -220, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            >
              <Sidebar />
            </motion.div>
            <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
              {renderView()}
            </main>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Studio Drawer — slides up from NowPlayingBar */}
      <AnimatePresence>
        {studioDrawerOpen && (
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
              style={{
                height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 12,
                borderBottom: '1px solid var(--glass-border)',
                background: 'var(--bg-surface)',
              }}
            >
              <div
                onClick={() => setStudioDrawerOpen(false)}
                style={{ cursor: 'pointer', padding: '4px 16px', display: 'flex', alignItems: 'center' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: 40, height: 3, borderRadius: 2, background: 'var(--text-dim)', opacity: 0.4 }} />
              </div>
              <button
                onClick={() => { setStudioDrawerOpen(false); useUIStore.getState().setActiveView('studio'); if (immersive) useUIStore.getState().setSpaceAdventure('on'); }}
                style={{
                  position: 'absolute', right: 16,
                  padding: '4px 14px', fontSize: 11, fontWeight: 600,
                  borderRadius: 16, background: 'var(--accent-muted)', color: 'var(--accent)',
                  border: '1px solid var(--border-accent)', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-glow)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--accent-muted)'}
              >
                ⤢ Open Full Studio
              </button>
            </div>
            <div style={{ height: 'calc(100% - 28px)', overflow: 'auto' }}>
              <StudioView />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Now Playing Bar — always visible; in immersive mode, premium floating center */}
      {immersive ? (
        <div className="immersive-wrapper">
          {/* Window controls — top right, always-accessible */}
          <div className="immersive-controls" style={{
            position: 'fixed', top: 0, right: 0, zIndex: 9999,
            display: 'flex', gap: 0, WebkitAppRegion: 'no-drag',
          }}>
            {/* Wide hover zone across top */}
            <div style={{ position: 'absolute', top: 0, left: -200, width: 'calc(100% + 200px)', height: 44 }} />
            {[
              { label: '—', action: () => window.electronAPI?.windowControl?.('minimize') },
              { label: '☐', action: () => window.electronAPI?.windowControl?.('maximize') },
              { label: '✕', action: () => window.electronAPI?.windowControl?.('close'), danger: true },
            ].map((btn, i) => (
              <button key={i} onClick={(e) => { e.stopPropagation(); btn.action(); }} style={{
                width: 46, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: 13,
                border: 'none', cursor: 'pointer', transition: 'background 0.15s', position: 'relative', zIndex: 10000,
              }}
                onMouseEnter={e => e.currentTarget.style.background = btn.danger ? 'rgba(220,50,50,0.8)' : 'rgba(255,255,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >{btn.label}</button>
            ))}
          </div>

          {/* Exit, Normal View & Super Immersive toggle — bottom left, 10% ambient */}
          <div className="immersive-side-btns" style={{
            position: 'fixed', bottom: 24, left: 24, zIndex: 55,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            {/* Hover zone */}
            <div style={{ position: 'absolute', bottom: -24, left: -24, width: 220, height: 180 }} />
            <button
              onClick={cycleBackgroundTheme}
              style={{
                padding: '8px 18px', borderRadius: 24, fontSize: 12, fontWeight: 600,
                background: backgroundTheme === 'harmattan' ? 'rgba(210,170,100,0.2)' : 'rgba(255,255,255,0.04)',
                color: backgroundTheme === 'harmattan' ? 'rgb(230,200,140)' : 'rgba(255,255,255,0.6)',
                border: `1px solid ${backgroundTheme === 'harmattan' ? 'rgba(210,170,100,0.3)' : 'rgba(255,255,255,0.06)'}`,
                cursor: 'pointer', backdropFilter: 'blur(16px)', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {backgroundTheme === 'harmattan' ? '🏜️ Harmattan' : '🌌 Space'}
            </button>
            <button
              onClick={() => { const s = useUIStore.getState(); s.toggleSuperImmersive(); }}
              style={{
                padding: '8px 18px', borderRadius: 24, fontSize: 12, fontWeight: 600,
                background: superImmersive ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
                color: superImmersive ? 'var(--accent)' : 'rgba(255,255,255,0.6)',
                border: `1px solid ${superImmersive ? 'rgba(139,92,246,0.3)' : 'rgba(255,255,255,0.06)'}`,
                cursor: 'pointer', backdropFilter: 'blur(16px)', transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              ⚡ {superImmersive ? 'Super Mode ON' : 'Super Mode'}
            </button>
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

          {/* Floating player + presets + queue — 10% ambient, full on hover */}
          <div
            className="immersive-player-panel"
            style={{
              position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              width: 860, maxWidth: '94vw', zIndex: 50,
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
            <ImmersivePresets />
            <ImmersiveQueue />
            <NowPlayingBar />
          </div>

          <style>{`
            ${superImmersive ? `
              /* Super Immersive: fully invisible, fast reveal on hover */
              .immersive-controls { opacity: 0; transition: opacity 0.3s ease; }
              .immersive-controls:hover { opacity: 1; }
              .immersive-side-btns { opacity: 0; transition: opacity 0.3s ease; }
              .immersive-side-btns:hover { opacity: 1; }
              .immersive-player-panel > * { opacity: 0; pointer-events: none; transition: opacity 0.3s ease; }
              .immersive-player-panel:hover > * { opacity: 1; pointer-events: auto; }
            ` : `
              /* Normal Immersive: invisible after inactivity, slower fade */
              .immersive-controls { opacity: ${immersiveActive ? '0.10' : '0'}; transition: opacity ${immersiveActive ? '0.3s' : '3s'} ease; }
              .immersive-controls:hover { opacity: 1 !important; transition: opacity 0.3s ease; }
              .immersive-side-btns { opacity: ${immersiveActive ? '0.10' : '0'}; transition: opacity ${immersiveActive ? '0.3s' : '3s'} ease; }
              .immersive-side-btns:hover { opacity: 1 !important; transition: opacity 0.3s ease; }
              .immersive-player-panel > * { opacity: ${immersiveActive ? '0.10' : '0'}; pointer-events: none; transition: opacity ${immersiveActive ? '0.3s' : '3s'} ease; }
              .immersive-player-panel:hover > * { opacity: 1 !important; pointer-events: auto; transition: opacity 0.3s ease; }
              /* Coordinated reveal on any hover */
              .immersive-wrapper:hover .immersive-controls { opacity: 1 !important; transition: opacity 0.3s ease; }
              .immersive-wrapper:hover .immersive-side-btns { opacity: 1 !important; transition: opacity 0.3s ease; }
            `}
          `}</style>
        </div>
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
  const { activePresets, applyPreset, params, setParam } = usePlayerStore();
  const presetNames = Object.keys(PRESETS);
  const preservePitch = params.preservePitch || false;
  return (
    <div style={{
      display: 'flex', gap: 6, padding: '10px 16px 8px',
      overflowX: 'auto', borderBottom: '1px solid rgba(255,255,255,0.04)',
      scrollbarWidth: 'none', alignItems: 'center',
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
      {/* ── Voice: Original / Effect ── */}
      <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)', flexShrink: 0, margin: '0 4px' }} />
      <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 2, border: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        {[{ label: 'Original', val: true }, { label: 'Effect', val: false }].map(opt => {
          const active = preservePitch === opt.val;
          return (
            <button key={opt.label} onClick={() => setParam('preservePitch', opt.val)} style={{
              padding: '3px 10px', borderRadius: 12, fontSize: 10, fontWeight: 700,
              border: 'none', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap',
              background: active ? 'rgba(var(--accent-rgb, 139,92,246), 0.25)' : 'transparent',
              color: active ? 'var(--accent)' : 'rgba(255,255,255,0.4)',
            }}>{opt.label}</button>
          );
        })}
      </div>
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
