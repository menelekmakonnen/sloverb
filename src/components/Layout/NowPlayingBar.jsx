import { usePlayerStore } from '../../stores/playerStore';
import { useUIStore } from '../../stores/uiStore';
import { playbackEngine } from '../../lib/playbackEngine';
import { Play, Pause, SkipBack, SkipForward, Repeat, Shuffle, Volume2, Volume1, VolumeX, ListMusic, Radio } from 'lucide-react';

export default function NowPlayingBar() {
  const { audioBuffer, isPlaying, masterVolume, isRepeat, isShuffle, autoPlay, params, fileName, currentTrack, currentTime, albumArt,
    setMasterVolume, toggleRepeat, toggleShuffle, toggleAutoPlay } = usePlayerStore();
  const { toggleQueueDrawer, studioDrawerOpen, toggleStudioDrawer } = useUIStore();

  const duration = audioBuffer ? audioBuffer.duration : 0;
  const displayDuration = duration / (params.speed || 1);
  const fmt = (s) => { if (!s || isNaN(s)) return '0:00'; return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`; };

  // Smooth wheel volume control over the entire bar
  const handleWheel = (e) => {
    e.preventDefault();
    let newVol = masterVolume - e.deltaY * 0.001; // subtle scroll
    newVol = Math.max(0, Math.min(4, newVol));
    setMasterVolume(newVol);
  };

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

  const seekPct = displayDuration ? (currentTime / displayDuration) * 100 : 0;

  return (
    <div style={{ position: 'relative', zIndex: 50, flexShrink: 0 }}>
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
        onWheel={handleWheel}
        style={{
          height: 'calc(var(--nowplaying-height) - 6px)',
          background: 'rgba(12, 14, 25, 0.65)', 
          backdropFilter: 'blur(32px) saturate(150%)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', padding: '0 32px', gap: 20,
          cursor: 'pointer',
        }}
      >
        {/* LEFT: Playback Controls & Time */}
        <div onClick={e => e.stopPropagation()} style={{ flex: '1', display: 'flex', alignItems: 'center', gap: 24, cursor: 'default' }}>
          <button style={{ color: 'rgba(255,255,255,0.7)', padding: 6, transition: 'color 0.2s, transform 0.2s' }} onMouseEnter={e => {e.currentTarget.style.color='#fff'; e.currentTarget.style.transform='scale(1.1)'}} onMouseLeave={e => {e.currentTarget.style.color='rgba(255,255,255,0.7)'; e.currentTarget.style.transform='scale(1)'}}>
            <SkipBack size={24} />
          </button>
          
          <button onClick={() => playbackEngine.togglePlay()} style={{ color: '#fff', padding: 6, transition: 'transform 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform='scale(1.1)'} onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
            {isPlaying ? <Pause size={28} /> : <Play size={28} style={{ marginLeft: 3 }} fill="currentColor" />}
          </button>

          <button onClick={() => playbackEngine.playNext()} style={{ color: 'rgba(255,255,255,0.7)', padding: 6, transition: 'color 0.2s, transform 0.2s' }} onMouseEnter={e => {e.currentTarget.style.color='#fff'; e.currentTarget.style.transform='scale(1.1)'}} onMouseLeave={e => {e.currentTarget.style.color='rgba(255,255,255,0.7)'; e.currentTarget.style.transform='scale(1)'}}>
            <SkipForward size={24} />
          </button>
          
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginLeft: 8, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
            {fmt(currentTime)} <span style={{opacity:0.4, margin: '0 4px'}}>/</span> {fmt(displayDuration)}
          </span>
        </div>

        {/* CENTER: Track Info */}
        <div onClick={e => e.stopPropagation()} style={{ flex: '1.5', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, cursor: 'default', minWidth: 0 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 8, flexShrink: 0,
            background: albumArt ? `url(${albumArt}) center/cover` : (audioBuffer ? `linear-gradient(135deg, hsl(${h1},70%,55%), hsl(${h2},60%,35%))` : 'rgba(255,255,255,0.05)'),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: albumArt ? '0 4px 16px rgba(0,0,0,0.4)' : 'none',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            {!albumArt && <span style={{ fontSize: audioBuffer ? 20 : 16, color: audioBuffer ? '#fff' : 'rgba(255,255,255,0.3)' }}>{audioBuffer ? '🎵' : '—'}</span>}
          </div>
          <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, textAlign: 'left' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '0.2px' }}>{fileName || 'No track'}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.4px' }}>{currentTrack?.artist || (audioBuffer ? 'Unknown Artist' : '')}</div>
          </div>
        </div>

        {/* RIGHT: Volume & Extras */}
        <div onClick={e => e.stopPropagation()} style={{ flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 20, cursor: 'default' }}>
          {/* Volume Group */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.04)', padding: '6px 14px', borderRadius: 20 }}>
            <button onClick={() => setMasterVolume(masterVolume === 0 ? 0.9 : 0)} style={{ color: masterVolume === 0 ? 'rgba(255,100,100,0.8)' : 'rgba(255,255,255,0.8)', padding: 2, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color='#fff'} onMouseLeave={e => e.currentTarget.style.color=masterVolume === 0 ? 'rgba(255,100,100,0.8)' : 'rgba(255,255,255,0.8)'}>
              <VolumeIcon size={18} />
            </button>
            <input type="range" min={0} max={4} step={0.01} value={masterVolume} onChange={e => setMasterVolume(parseFloat(e.target.value))} style={{ width: 100, accentColor: '#fff', cursor: 'pointer' }} />
          </div>

          <button onClick={toggleRepeat} style={{ color: isRepeat ? '#fff' : 'rgba(255,255,255,0.5)', padding: 4, transition: 'all 0.2s', transform: isRepeat ? 'scale(1.1)' : 'scale(1)', textShadow: isRepeat ? '0 0 8px rgba(255,255,255,0.5)' : 'none' }}><Repeat size={20} /></button>
          <button onClick={toggleShuffle} style={{ color: isShuffle ? '#fff' : 'rgba(255,255,255,0.5)', padding: 4, transition: 'all 0.2s', transform: isShuffle ? 'scale(1.1)' : 'scale(1)', textShadow: isShuffle ? '0 0 8px rgba(255,255,255,0.5)' : 'none' }}><Shuffle size={20} /></button>
          <button onClick={toggleQueueDrawer} style={{ color: 'rgba(255,255,255,0.6)', padding: 4, transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color='#fff'} onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,0.6)'}><ListMusic size={22} /></button>
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
