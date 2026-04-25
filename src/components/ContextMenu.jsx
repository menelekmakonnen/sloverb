import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../stores/uiStore';
import { usePlayerStore } from '../stores/playerStore';
import { useLibraryStore } from '../stores/libraryStore';
import { playbackEngine } from '../lib/playbackEngine';
import { Play, FastForward, ListPlus, Trash2, ListMusic, ChevronRight, Radio, Download, Disc3, Users, FileText, Share2, Pin } from 'lucide-react';

export default function ContextMenu() {
  const { contextMenu, closeContextMenu, addToast, setActiveView, setArtistFilter, setAlbumFilter, setCreditsTrack } = useUIStore();
  const { playlists, addToPlaylist, saveToDisk } = useLibraryStore();
  const menuRef = useRef(null);
  const [showPlaylists, setShowPlaylists] = useState(false);

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        closeContextMenu();
        setShowPlaylists(false);
      }
    };
    if (contextMenu.isOpen) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contextMenu.isOpen, closeContextMenu]);

  useEffect(() => {
    if (!contextMenu.isOpen) setShowPlaylists(false);
  }, [contextMenu.isOpen]);

  if (!contextMenu.isOpen || !contextMenu.track) return null;

  const track = contextMenu.track;

  const handleAction = async (action) => {
    const store = usePlayerStore.getState();
    const qItem = { type: 'library', name: track.name, path: track.path, id: track.id };

    switch (action) {
      case 'play':
        closeContextMenu();
        if (window.electronAPI) {
          const buf = await window.electronAPI.readFile(track.path || track.id);
          const isVid = track.name?.endsWith('.mp4') || track.type === 'video';
          const f = new File([buf], track.name, { type: isVid ? 'video/mp4' : 'audio/wav' });
          f.path = track.path || track.id;
          playbackEngine.loadFileAndPlay(f, track);
        }
        break;

      case 'start_mix': {
        // Queue songs by same artist
        const lib = useLibraryStore.getState();
        const artist = track.artist || 'Unknown Artist';
        const mixTracks = lib.songs
          .filter(s => s.artist === artist && s.id !== track.id)
          .sort(() => Math.random() - 0.5)
          .slice(0, 15)
          .map(s => ({ type: 'library', name: s.name, path: s.path, id: s.id }));
        store.setQueue(mixTracks);
        closeContextMenu();
        if (window.electronAPI) {
          const buf = await window.electronAPI.readFile(track.path || track.id);
          const f = new File([buf], track.name, { type: 'audio/wav' });
          f.path = track.path || track.id;
          playbackEngine.loadFileAndPlay(f, track);
        }
        addToast(`Started mix: ${artist}`, 'success');
        break;
      }

      case 'play_next':
        store.setQueue([qItem, ...store.queue]);
        addToast(`Will play next: ${track.name}`, 'info');
        closeContextMenu();
        break;

      case 'add_queue':
        store.setQueue([...store.queue, qItem]);
        addToast(`Added to queue: ${track.name}`, 'success');
        closeContextMenu();
        break;

      case 'remove':
        if (window.electronAPI) {
          await window.electronAPI.removeFromLibrary(track.id);
          const libData = await window.electronAPI.loadLibrary();
          useLibraryStore.getState().setSongs(libData?.songs || []);
          addToast('Removed from library', 'info');
        }
        closeContextMenu();
        break;

      case 'download':
        if (track.path) {
          const folder = track.path.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
          useUIStore.getState().setFolderFilter(folder);
          setActiveView('folders');
        }
        closeContextMenu();
        break;

      case 'go_album':
        setAlbumFilter(track.album || 'Unknown Album');
        setActiveView('albums');
        closeContextMenu();
        break;

      case 'go_artist':
        setArtistFilter(track.artist || 'Unknown Artist');
        setActiveView('artists');
        closeContextMenu();
        break;

      case 'credits':
        setCreditsTrack(track);
        closeContextMenu();
        break;

      case 'share': {
        const text = `🎵 ${track.name} — ${track.artist || 'Unknown Artist'}`;
        try {
          await navigator.clipboard.writeText(text);
          addToast('Track info copied to clipboard', 'success');
        } catch { addToast('Could not copy', 'error'); }
        closeContextMenu();
        break;
      }

      case 'pin':
        addToast(`Pinned: ${track.name}`, 'success');
        closeContextMenu();
        break;
    }
  };

  const handleAddToPlaylist = (plId) => {
    addToPlaylist(plId, track.id);
    saveToDisk();
    const pl = playlists.find(p => p.id === plId);
    addToast(`Added to "${pl?.name}"`, 'success');
    closeContextMenu();
  };

  const menuX = Math.min(contextMenu.x, window.innerWidth - 240);
  const menuY = Math.min(contextMenu.y, window.innerHeight - 480);

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        style={{
          position: 'fixed', left: menuX, top: menuY,
          background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)',
          borderRadius: 10, boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          padding: 6, zIndex: 10000, minWidth: 210,
          display: 'flex', flexDirection: 'column', gap: 1,
        }}
      >
        {/* Track Name Header */}
        <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-dim)', borderBottom: '1px solid var(--glass-border)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>
          {track.name}
        </div>

        <MenuItem icon={Radio} label="Start mix" onClick={() => handleAction('start_mix')} />
        <MenuItem icon={FastForward} label="Play next" onClick={() => handleAction('play_next')} />
        <MenuItem icon={ListPlus} label="Add to queue" onClick={() => handleAction('add_queue')} />

        <Divider />

        <MenuItem icon={Trash2} label="Remove from library" onClick={() => handleAction('remove')} />
        <MenuItem icon={Download} label="Show in folder" onClick={() => handleAction('download')} />

        {/* Save to Playlist Submenu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowPlaylists(!showPlaylists)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', borderRadius: 6,
              color: 'var(--text)', fontSize: 12, fontWeight: 500,
              textAlign: 'left', width: '100%',
              transition: 'background 0.1s', justifyContent: 'space-between',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ListMusic size={14} />
              <span>Save to playlist</span>
            </span>
            <ChevronRight size={12} color="var(--text-dim)" />
          </button>

          <AnimatePresence>
            {showPlaylists && (
              <motion.div
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -4 }}
                style={{
                  position: 'absolute', left: '100%', top: 0, marginLeft: 4,
                  background: 'var(--bg-elevated)', border: '1px solid var(--glass-border)',
                  borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  padding: 6, minWidth: 170, zIndex: 10001, maxHeight: 250, overflowY: 'auto',
                }}
              >
                {playlists.length === 0 ? (
                  <div style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-dim)' }}>No playlists yet</div>
                ) : (
                  playlists.map(pl => (
                    <button key={pl.id} onClick={() => handleAddToPlaylist(pl.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 12px', borderRadius: 4,
                        color: 'var(--text)', fontSize: 12, fontWeight: 500,
                        textAlign: 'left', width: '100%', transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <ListMusic size={12} color="var(--accent)" />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.name}</span>
                    </button>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Divider />

        <MenuItem icon={Disc3} label="Go to album" onClick={() => handleAction('go_album')} />
        <MenuItem icon={Users} label="Go to artist" onClick={() => handleAction('go_artist')} />
        <MenuItem icon={FileText} label="View song credits" onClick={() => handleAction('credits')} />

        <Divider />

        <MenuItem icon={Share2} label="Share" onClick={() => handleAction('share')} />
        <MenuItem icon={Pin} label="Pin to Listen again" onClick={() => handleAction('pin')} />
      </motion.div>
    </AnimatePresence>
  );
}

function MenuItem({ icon: Icon, label, onClick, color = 'var(--text)' }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px', borderRadius: 6,
        color, fontSize: 12, fontWeight: 500,
        textAlign: 'left', width: '100%',
        transition: 'background 0.1s'
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <Icon size={14} />
      <span>{label}</span>
    </button>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--glass-border)', margin: '3px 0' }} />;
}
