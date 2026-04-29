import { usePlayerStore } from '../../stores/playerStore';
import { useUIStore } from '../../stores/uiStore';
import { playbackEngine } from '../../lib/playbackEngine';
import { Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle, Volume2, Volume1, VolumeX, ListMusic, Radio, Rewind, FastForward } from 'lucide-react';

export default function NowPlayingBar() {
  const { audioBuffer, isPlaying, masterVolume, repeatMode, isShuffle, autoPlay, params, fileName, currentTrack, currentTime, albumArt,
    setMasterVolume, toggleRepeat, toggleShuffle, toggleAutoPlay } = usePlayerStore();
  const { toggleQueueDrawer, studioDrawerOpen, toggleStudioDrawer, openContextMenu } = useUIStore();

  const duration = audioBuffer ? audioBuffer.duration : 0;
  const fmt = (s) => { if (!s || isNaN(s)) return '0:00'; return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`; };

  const idHash = (fileName || 'x').split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const h1 = idHash % 360, h2 = (h1 + 45) % 360;
  const VolumeIcon = masterVolume === 0 ? VolumeX : masterVolume < 0.5 ? Volume1 : Volume2;

  const handleSeekerClick = (e) => {
    if (!audioBuffer) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    playbackEngine.seek(pct * duration);
  };

  const handleBarClick = (e) => {
    if (e.target === e.currentTarget) toggleStudioDrawer();
  };

  const handleTrackContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentTrack) {
      openContextMenu(e.clientX, e.clientY, currentTrack);
    } else if (audioBuffer && fileName) {
      openContextMenu(e.clientX, e.clientY, { name: fileName, artist: 'Unknown Artist', album: 'Unknown Album' });
    }
  };

  const seekPct = duration ? (currentTime / duration) * 100 : 0;

  const handleVolumeWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    const newVol = Math.max(0, Math.min(4, masterVolume + delta));
    setMasterVolume(Math.round(newVol * 100) / 100);
  };

  return (
    <div
      style={{ position: 'relative', zIndex: 50, flexShrink: 0 }}
      onWheel={handleVolumeWheel}
    >
      {/* ═══ FULL-WIDTH SEEKER BAR (above controls) ═══ */}
      <div
        onClick={handleSeekerClick}
        style={{
          height: 6, width: '100%', background: 'rgba(255,255,255,0.06)',
          cursor: audioBuffer ? 'pointer' : 'default', position: 'relative',
          transition: 'height 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onMouseEnter={e => e.currentTarget.style.height = '10px'}
        onMouseLeave={e => e.currentTarget.style.height = '6px'}
      >
        <div style={{
          position: 'absolute', left: 0, top: 0, height: '100%',
          width: `${seekPct}%`,
          background: 'linear-gradient(90deg, rgba(255,255,255,0.4), #fff)',
          boxShadow: '0 0 12px rgba(255,255,255,0.6)',
          transition: 'width 0.1s linear',
        }} />
        {audioBuffer && (
          <div style={{
            position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)',
            left: `${seekPct}%`, width: 14, height: 14, borderRadius: '50%',
            background: '#fff', boxShadow: '0 0 16px rgba(255,255,255,0.8)',
            opacity: 0, transition: 'opacity 0.2s',
          }} className="seek-thumb-bar" />
        )}
      </div>

      {/* ═══ CONTROLS BAR ═══ */}
      <div
        onClick={handleBarClick}
        style={{
          height: 'calc(var(--nowplaying-height) - 6px)',
          background: 'rgba(12, 14, 25, 0.65)', 
          backdropFilter: 'blur(32px) saturate(150%)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', padding: '0 20px', gap: 16,
          cursor: 'pointer',
        }}
      >
        {/* Track Info — left section */}
        <div
          onClick={e => e.stopPropagation()}
          onContextMenu={handleTrackContextMenu}
          style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '0 0 220px', minWidth: 0, cursor: 'default' }}
        >
          <div style={{
            width: 42, height: 42, borderRadius: 10, flexShrink: 0,
            background: albumArt ? `url(${albumArt}) center/cover` : (audioBuffer ? `linear-gradient(135deg, hsl(${h1},70%,55%), hsl(${h2},60%,35%))` : 'rgba(255,255,255,0.05)'),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: albumArt ? '0 4px 16px rgba(0,0,0,0.4)' : 'none',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            {!albumArt && <span style={{ fontSize: audioBuffer ? 18 : 14, color: audioBuffer ? '#fff' : 'rgba(255,255,255,0.3)' }}>{audioBuffer ? '🎵' : '—'}</span>}
          </div>
          <div style={{ overflow: 'hidden', minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '0.2px' }}>{fileName || 'No track'}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentTrack?.artist || (audioBuffer ? 'Unknown Artist' : '')}</div>
          </div>
        </div>

        {/* Center — transport controls + time */}
        <div onClick={e => e.stopPropagation()} style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'default' }}>
          {/* Transport row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={toggleShuffle} style={{ color: isShuffle ? '#fff' : 'rgba(255,255,255,0.35)', padding: 4, transition: 'all 0.2s' }}><Shuffle size={14} /></button>
            <button onClick={() => playbackEngine.playPrev && playbackEngine.playPrev()} style={{ color: 'rgba(255,255,255,0.6)', padding: 4 }}><SkipBack size={16} /></button>
            <button onClick={() => audioBuffer && playbackEngine.seek(Math.max(0, currentTime - 5))} title="Back 5s" style={{ color: 'rgba(255,255,255,0.5)', padding: 4, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color='#fff'} onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,0.5)'}><Rewind size={14} /></button>

            <button onClick={() => playbackEngine.togglePlay()} style={{ width: 38, height: 38, borderRadius: '50%', background: audioBuffer ? '#fff' : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: audioBuffer ? '#000' : 'rgba(255,255,255,0.3)', boxShadow: audioBuffer ? '0 0 20px rgba(255,255,255,0.35)' : 'none', transition: 'all 0.2s', flexShrink: 0 }}>
              {isPlaying ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: 2 }} />}
            </button>

            <button onClick={() => audioBuffer && playbackEngine.seek(Math.min(duration, currentTime + 5))} title="Forward 5s" style={{ color: 'rgba(255,255,255,0.5)', padding: 4, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color='#fff'} onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,0.5)'}><FastForward size={14} /></button>
            <button onClick={() => playbackEngine.playNext()} style={{ color: 'rgba(255,255,255,0.6)', padding: 4 }}><SkipForward size={16} /></button>
            <button onClick={toggleRepeat} style={{ color: repeatMode > 0 ? '#fff' : 'rgba(255,255,255,0.35)', padding: 4, transition: 'all 0.2s' }}>
              {repeatMode === 2 ? <Repeat1 size={14} /> : <Repeat size={14} />}
            </button>
          </div>
          {/* Time display */}
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 500, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', letterSpacing: '0.5px' }}>
            {fmt(currentTime)} <span style={{ opacity: 0.4 }}>/</span> {fmt(duration)}
          </span>
        </div>

        {/* Right — volume + extras */}
        <div onClick={e => e.stopPropagation()} style={{ flex: '0 0 180px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, cursor: 'default' }}>
          <button onClick={toggleAutoPlay} title={autoPlay ? 'Autoplay On' : 'Autoplay Off'} style={{ color: autoPlay ? '#fff' : 'rgba(255,255,255,0.35)', padding: 4, transition: 'color 0.2s' }}><Radio size={14} /></button>
          <button onClick={toggleQueueDrawer} style={{ color: 'rgba(255,255,255,0.5)', padding: 4, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color='#fff'} onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,0.5)'}><ListMusic size={16} /></button>
          <button onClick={() => setMasterVolume(masterVolume === 0 ? 0.9 : 0)} style={{ color: masterVolume === 0 ? 'rgba(255,100,100,0.8)' : 'rgba(255,255,255,0.5)', padding: 2 }}><VolumeIcon size={16} /></button>
          <input type="range" min={0} max={4} step={0.01} value={masterVolume} onChange={e => setMasterVolume(parseFloat(e.target.value))} style={{ width: 70, accentColor: '#fff' }} />
        </div>
      </div>

      <style>{`
        div:hover > .seek-thumb-bar { opacity: 1 !important; }
        input[type=range] {
          -webkit-appearance: none;
          background: transparent;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 12px; width: 12px;
          border-radius: 50%; background: #fff;
          cursor: pointer; margin-top: -4px;
          box-shadow: 0 0 10px rgba(255,255,255,0.5);
        }
        input[type=range]::-webkit-slider-runnable-track {
          width: 100%; height: 4px;
          cursor: pointer; background: rgba(255,255,255,0.1);
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}
