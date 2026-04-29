import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../stores/uiStore';
import { usePlayerStore } from '../stores/playerStore';
import { useLibraryStore } from '../stores/libraryStore';
import { playbackEngine } from '../lib/playbackEngine';
import { Play, FastForward, ListPlus, Trash2, ListMusic, ChevronRight, Radio, Download, Disc3, Users, FileText, Share2, Pin, FolderOpen, Shuffle } from 'lucide-react';

export default function ContextMenu() {
  const { contextMenu, closeContextMenu, addToast, setActiveView, setArtistFilter, setAlbumFilter, setCreditsTrack, setFolderFilter } = useUIStore();
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

  if (!contextMenu.isOpen) return null;

  const { track, group } = contextMenu;
  const isGroup = !!group;

  // If neither track nor group, bail
  if (!track && !group) return null;

  // ═══ HELPERS ═══
  const playTrack = async (song) => {
    if (!window.electronAPI) return;
    try {
      const buf = await window.electronAPI.readFile(song.path || song.id);
      const isVid = song.name?.endsWith('.mp4') || song.type === 'video';
      const f = new File([buf], song.name, { type: isVid ? 'video/mp4' : 'audio/wav' });
      f.path = song.path || song.id;
      playbackEngine.loadFileAndPlay(f, song);
    } catch { addToast('Failed to load track', 'error'); }
  };

  const playAllTracks = (tracks) => {
    if (tracks.length === 0) return;
    const store = usePlayerStore.getState();
    const rest = tracks.slice(1).map(s => ({ type: 'library', name: s.name, path: s.path, id: s.id }));
    store.setQueue(rest);
    playTrack(tracks[0]);
  };

  const queueAllTracks = (tracks) => {
    const store = usePlayerStore.getState();
    const items = tracks.map(s => ({ type: 'library', name: s.name, path: s.path, id: s.id }));
    store.setQueue([...store.queue, ...items]);
  };

  // ═══ TRACK ACTIONS ═══
  const handleTrackAction = async (action) => {
    const store = usePlayerStore.getState();
    const qItem = { type: 'library', name: track.name, path: track.path, id: track.id };

    switch (action) {
      case 'play':
        closeContextMenu();
        playTrack(track);
        break;

      case 'start_mix': {
        const lib = useLibraryStore.getState();
        const artist = track.artist || 'Unknown Artist';
        const mixTracks = lib.songs
          .filter(s => s.artist === artist && s.id !== track.id)
          .sort(() => Math.random() - 0.5)
          .slice(0, 15)
          .map(s => ({ type: 'library', name: s.name, path: s.path, id: s.id }));
        store.setQueue(mixTracks);
        closeContextMenu();
        playTrack(track);
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
          setFolderFilter(folder);
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

  // ═══ GROUP ACTIONS ═══
  const handleGroupAction = async (action) => {
    const tracks = group.tracks || [];

    switch (action) {
      case 'play_all':
        closeContextMenu();
        playAllTracks(tracks);
        addToast(`Playing: ${group.name}`, 'success');
        break;

      case 'shuffle_play':
        closeContextMenu();
        playAllTracks([...tracks].sort(() => Math.random() - 0.5));
        addToast(`Shuffling: ${group.name}`, 'success');
        break;

      case 'queue_all':
        queueAllTracks(tracks);
        addToast(`Queued ${tracks.length} tracks`, 'success');
        closeContextMenu();
        break;

      case 'play_next_all': {
        const store = usePlayerStore.getState();
        const items = tracks.map(s => ({ type: 'library', name: s.name, path: s.path, id: s.id }));
        store.setQueue([...items, ...store.queue]);
        addToast(`Playing next: ${tracks.length} tracks`, 'info');
        closeContextMenu();
        break;
      }

      case 'start_mix': {
        const lib = useLibraryStore.getState();
        let mixPool = [];
        if (group.type === 'artist') {
          mixPool = lib.songs.filter(s => (s.artist || 'Unknown Artist') === group.name);
        } else if (group.type === 'album') {
          const albumArtist = tracks[0]?.artist;
          mixPool = lib.songs.filter(s => s.artist === albumArtist);
        } else {
          mixPool = [...tracks];
        }
        const shuffled = mixPool.sort(() => Math.random() - 0.5);
        closeContextMenu();
        playAllTracks(shuffled.slice(0, 25));
        addToast(`Started mix: ${group.name}`, 'success');
        break;
      }

      case 'go_artist':
        if (group.type === 'album' && tracks[0]?.artist) {
          setArtistFilter(tracks[0].artist);
          setActiveView('artists');
        }
        closeContextMenu();
        break;

      case 'go_album':
        if (group.type === 'artist') {
          // Find first album by this artist
          const firstAlbum = tracks.find(t => t.album && t.album !== 'Unknown Album');
          if (firstAlbum) {
            setAlbumFilter(firstAlbum.album);
            setActiveView('albums');
          }
        }
        closeContextMenu();
        break;

      case 'show_folder':
        if (group.type === 'folder') {
          setFolderFilter(group.path || group.name);
          setActiveView('folders');
        } else if (tracks[0]?.path) {
          const folder = tracks[0].path.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
          setFolderFilter(folder);
          setActiveView('folders');
        }
        closeContextMenu();
        break;

      case 'share': {
        const text = group.type === 'artist'
          ? `🎤 ${group.name} — ${tracks.length} tracks`
          : group.type === 'album'
          ? `💿 ${group.name} — ${tracks[0]?.artist || 'Various Artists'}`
          : `📁 ${group.name} — ${tracks.length} tracks`;
        try {
          await navigator.clipboard.writeText(text);
          addToast('Copied to clipboard', 'success');
        } catch { addToast('Could not copy', 'error'); }
        closeContextMenu();
        break;
      }
    }
  };

  const handleAddToPlaylist = (plId) => {
    if (isGroup) {
      const tracks = group.tracks || [];
      tracks.forEach(t => addToPlaylist(plId, t.id));
    } else {
      addToPlaylist(plId, track.id);
    }
    saveToDisk();
    const pl = playlists.find(p => p.id === plId);
    const count = isGroup ? (group.tracks?.length || 0) : 1;
    addToast(`Added ${count} track${count > 1 ? 's' : ''} to "${pl?.name}"`, 'success');
    closeContextMenu();
  };

  const menuX = Math.min(contextMenu.x, window.innerWidth - 240);
  const menuY = Math.min(contextMenu.y, window.innerHeight - 480);

  // ═══ HEADER ═══
  const headerLabel = isGroup
    ? `${group.type === 'artist' ? '🎤' : group.type === 'album' ? '💿' : '📁'} ${group.name}`
    : track.name;
  const headerSub = isGroup
    ? `${group.tracks?.length || 0} tracks`
    : null;

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
        {/* Header */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--glass-border)', marginBottom: 4 }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>
            {headerLabel}
          </div>
          {headerSub && <div style={{ fontSize: 10, color: 'var(--text-dim)', opacity: 0.6, marginTop: 2 }}>{headerSub}</div>}
        </div>

        {isGroup ? (
          /* ═══ GROUP MENU ═══ */
          <>
            <MenuItem icon={Play} label="Play all" onClick={() => handleGroupAction('play_all')} />
            <MenuItem icon={Shuffle} label="Shuffle play" onClick={() => handleGroupAction('shuffle_play')} />
            <MenuItem icon={FastForward} label="Play next" onClick={() => handleGroupAction('play_next_all')} />
            <MenuItem icon={ListPlus} label="Add all to queue" onClick={() => handleGroupAction('queue_all')} />
            <MenuItem icon={Radio} label="Start mix" onClick={() => handleGroupAction('start_mix')} />

            <Divider />

            {/* Save to Playlist Submenu */}
            <PlaylistSubmenu showPlaylists={showPlaylists} setShowPlaylists={setShowPlaylists} playlists={playlists} onAdd={handleAddToPlaylist} />

            <Divider />

            {group.type === 'album' && (
              <MenuItem icon={Users} label="Go to artist" onClick={() => handleGroupAction('go_artist')} />
            )}
            {group.type === 'artist' && (
              <MenuItem icon={Disc3} label="Go to albums" onClick={() => handleGroupAction('go_album')} />
            )}
            <MenuItem icon={FolderOpen} label="Show in folder" onClick={() => handleGroupAction('show_folder')} />
            <MenuItem icon={Share2} label="Share" onClick={() => handleGroupAction('share')} />
          </>
        ) : track.type === 'stream' ? (
          /* ═══ STREAM TRACK MENU ═══ */
          <>
            <MenuItem icon={Play} label="Stream only" onClick={() => {
              usePlayerStore.getState().addToStreamHistory(track);
              playbackEngine.startStream(track);
              closeContextMenu();
            }} />
            <MenuItem icon={Download} label="Send to Studio (Download)" onClick={() => {
              usePlayerStore.getState().setYoutubeUrl(track.url);
              setActiveView('studio');
              closeContextMenu();
              addToast('Sent to Studio for download', 'success');
            }} />
            <MenuItem icon={Radio} label="Stream + Local (Send & Play)" onClick={() => {
              usePlayerStore.getState().addToStreamHistory(track);
              playbackEngine.startStream(track);
              usePlayerStore.getState().setYoutubeUrl(track.url);
              setActiveView('studio');
              closeContextMenu();
              addToast('Streaming and sent to Studio', 'success');
            }} />

            <Divider />

            <MenuItem icon={FastForward} label="Play next" onClick={() => {
              const store = usePlayerStore.getState();
              store.setQueue([track, ...store.queue]);
              addToast(`Will play next: ${track.title || track.name}`, 'info');
              closeContextMenu();
            }} />
            <MenuItem icon={ListPlus} label="Add to queue" onClick={() => {
              const store = usePlayerStore.getState();
              store.setQueue([...store.queue, track]);
              addToast(`Added to queue: ${track.title || track.name}`, 'success');
              closeContextMenu();
            }} />

            <Divider />

            <MenuItem icon={Share2} label="Copy Link" onClick={async () => {
              try {
                await navigator.clipboard.writeText(track.url);
                addToast('Link copied to clipboard', 'success');
              } catch { addToast('Could not copy', 'error'); }
              closeContextMenu();
            }} />
          </>
        ) : (
          /* ═══ LOCAL TRACK MENU ═══ */
          <>
            <MenuItem icon={Radio} label="Start mix" onClick={() => handleTrackAction('start_mix')} />
            <MenuItem icon={FastForward} label="Play next" onClick={() => handleTrackAction('play_next')} />
            <MenuItem icon={ListPlus} label="Add to queue" onClick={() => handleTrackAction('add_queue')} />

            <Divider />

            <MenuItem icon={Trash2} label="Remove from library" onClick={() => handleTrackAction('remove')} />
            <MenuItem icon={Download} label="Show in folder" onClick={() => handleTrackAction('download')} />

            {/* Save to Playlist Submenu */}
            <PlaylistSubmenu showPlaylists={showPlaylists} setShowPlaylists={setShowPlaylists} playlists={playlists} onAdd={handleAddToPlaylist} />

            <Divider />

            <MenuItem icon={Disc3} label="Go to album" onClick={() => handleTrackAction('go_album')} />
            <MenuItem icon={Users} label="Go to artist" onClick={() => handleTrackAction('go_artist')} />
            <MenuItem icon={FileText} label="View song credits" onClick={() => handleTrackAction('credits')} />

            <Divider />

            <MenuItem icon={Share2} label="Share" onClick={() => handleTrackAction('share')} />
            <MenuItem icon={Pin} label="Pin to Listen again" onClick={() => handleTrackAction('pin')} />
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function PlaylistSubmenu({ showPlaylists, setShowPlaylists, playlists, onAdd }) {
  return (
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
                <button key={pl.id} onClick={() => onAdd(pl.id)}
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
