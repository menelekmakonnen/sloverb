import { motion } from 'framer-motion';
import { useUIStore } from '../../stores/uiStore';
import { Sun, Moon, Rocket } from 'lucide-react';
import {
  HomeIcon, StudioIcon, LibraryIcon, PlaylistIcon, ArtistsIcon,
  AlbumsIcon, FoldersIcon, HistoryIcon, SettingsIcon
} from '../NavIcons';
import SloverbLogo from '../SloverbLogo';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', Icon: HomeIcon },
  { id: 'studio', label: 'Studio', Icon: StudioIcon },
  { id: 'library', label: 'Library', Icon: LibraryIcon },
  { id: 'playlists', label: 'Playlists', Icon: PlaylistIcon },
  { id: 'artists', label: 'Artists', Icon: ArtistsIcon },
  { id: 'albums', label: 'Albums', Icon: AlbumsIcon },
  { id: 'folders', label: 'Folders', Icon: FoldersIcon },
  { id: 'history', label: 'History', Icon: HistoryIcon },
];

const BOTTOM_ITEMS = [
  { id: 'settings', label: 'Settings', Icon: SettingsIcon },
];

export default function Sidebar() {
  const {
    activeView, setActiveView, sidebarCollapsed: collapsed, toggleSidebar,
    mode, setMode, spaceAdventure, cycleSpaceAdventure, setStudioDrawerOpen,
  } = useUIStore();

  const toggleMode = () => setMode(mode === 'dark' ? 'light' : 'dark');

  return (
    <motion.nav
      animate={{ width: collapsed ? 54 : 200 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      style={{
        height: '100%', display: 'flex', flexDirection: 'column',
        background: spaceAdventure !== 'off' ? 'rgba(10, 10, 30, 0.6)' : 'var(--bg-surface)',
        borderRight: 'none', flexShrink: 0, overflow: 'hidden',
        position: 'relative',
        backdropFilter: spaceAdventure !== 'off' ? 'blur(10px)' : 'none',
      }}
    >
      {/* Logo */}
      <div style={{
        padding: collapsed ? '16px 0' : '16px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}>
        <SloverbLogo size={collapsed ? 28 : 34} />
        {!collapsed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>Sloverb</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Studio</div>
          </motion.div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ flex: 1, padding: collapsed ? '8px 6px' : '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {!collapsed && (
          <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.12em', padding: '8px 8px 6px', fontWeight: 600 }}>
            Navigate
          </div>
        )}
        {NAV_ITEMS.map(item => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { setActiveView(item.id); setStudioDrawerOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: collapsed ? '10px 0' : '9px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 8,
                background: isActive ? 'var(--accent-muted)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 400, fontSize: 13,
                transition: 'all 0.15s', width: '100%', position: 'relative',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-indicator"
                  style={{
                    position: 'absolute',
                    left: collapsed ? '50%' : 0,
                    top: collapsed ? 'auto' : '50%',
                    bottom: collapsed ? -2 : 'auto',
                    transform: collapsed ? 'translateX(-50%)' : 'translateY(-50%)',
                    width: collapsed ? 16 : 3,
                    height: collapsed ? 3 : 20,
                    background: 'var(--accent)',
                    borderRadius: 4,
                    boxShadow: '0 0 8px var(--accent-glow)',
                  }}
                  transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                />
              )}
              <item.Icon size={18} active={isActive} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </div>

      {/* Bottom Actions */}
      <div style={{ padding: collapsed ? '8px 6px' : '8px 10px', borderTop: '1px solid var(--glass-border)' }}>
        {/* Theme Toggle */}
        <button
          onClick={toggleMode}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: collapsed ? '10px 0' : '9px 12px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderRadius: 8, width: '100%',
            color: 'var(--text-secondary)', fontSize: 13,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          {!collapsed && <span>{mode === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>

        {/* Space Flight 3-Mode Toggle */}
        {mode === 'dark' && (
          <button
            onClick={cycleSpaceAdventure}
            title={`Space Flight: ${spaceAdventure.toUpperCase()}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: collapsed ? '10px 0' : '9px 12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: 8, width: '100%',
              background: spaceAdventure !== 'off' ? 'var(--accent-muted)' : 'transparent',
              color: spaceAdventure !== 'off' ? 'var(--accent)' : 'var(--text-secondary)', fontSize: 13,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = spaceAdventure !== 'off' ? 'var(--accent-muted)' : 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = spaceAdventure !== 'off' ? 'var(--accent-muted)' : 'transparent'}
          >
            <Rocket size={18} />
            {!collapsed && <span>{spaceAdventure === 'off' ? 'Flight Off' : spaceAdventure === 'on' ? 'Flight On' : 'Immersive'}</span>}
          </button>
        )}

        {BOTTOM_ITEMS.map(item => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: collapsed ? '10px 0' : '9px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 8, width: '100%',
                background: isActive ? 'var(--accent-muted)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 400, fontSize: 13,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <item.Icon size={18} active={isActive} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </div>

      {/* Collapse Edge Bar — vertical line at right edge */}
      <div
        onClick={toggleSidebar}
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 5,
          cursor: 'col-resize', zIndex: 10,
          background: 'transparent',
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--accent)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <div style={{
          position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
          width: 3, height: 30, borderRadius: 4,
          background: 'var(--glass-border)',
          transition: 'background 0.2s',
        }} />
      </div>
    </motion.nav>
  );
}
