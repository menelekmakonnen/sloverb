import { usePlayerStore } from '../../stores/playerStore';
import { useUIStore } from '../../stores/uiStore';
import { motion } from 'framer-motion';
import { Music, Disc3, Play, Pause } from 'lucide-react';
import { useRef, useEffect } from 'react';

function WaveformCanvas({ analyserRef, isPlaying }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      if (!analyserRef?.current || !isPlaying) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(167,139,250,0.15)';
        ctx.lineWidth = 1.5;
        ctx.moveTo(0, H / 2);
        ctx.lineTo(W, H / 2);
        ctx.stroke();
        return;
      }
      const bufferLen = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLen);
      analyserRef.current.getByteTimeDomainData(dataArray);
      const gradient = ctx.createLinearGradient(0, 0, W, 0);
      gradient.addColorStop(0, 'rgba(167,139,250,0.8)');
      gradient.addColorStop(0.5, 'rgba(192,132,252,1)');
      gradient.addColorStop(1, 'rgba(244,114,182,0.8)');
      ctx.beginPath();
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2.5;
      const sliceWidth = W / bufferLen;
      let x = 0;
      for (let i = 0; i < bufferLen; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * H) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.stroke();
      ctx.shadowColor = 'var(--accent-glow)';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [analyserRef, isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={120}
      style={{
        width: '100%',
        height: 120,
        borderRadius: 12,
        background: 'rgba(0,0,0,0.2)',
        border: '1px solid var(--glass-border)',
      }}
    />
  );
}

export default function PlayerView() {
  const { audioBuffer, isPlaying, fileName, currentTrack, params } = usePlayerStore();
  const { mode } = useUIStore();

  const idHash = (fileName || 'sloverb').split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const hue1 = idHash % 360;
  const hue2 = (hue1 + 50) % 360;
  const hue3 = (hue1 + 100) % 360;

  return (
    <div style={{
      height: '100%',
      overflow: 'auto',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      padding: 40,
    }}>
      {/* Background Blur Gradient */}
      {audioBuffer && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: `
            radial-gradient(ellipse at 30% 40%, hsla(${hue1}, 60%, 30%, 0.15) 0%, transparent 60%),
            radial-gradient(ellipse at 70% 60%, hsla(${hue2}, 50%, 25%, 0.1) 0%, transparent 50%)
          `,
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }} />
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 32,
          zIndex: 1,
          maxWidth: 500,
          width: '100%',
        }}
      >
        {/* Album Art */}
        <motion.div
          animate={isPlaying ? { rotate: 360 } : { rotate: 0 }}
          transition={isPlaying ? { duration: 8, repeat: Infinity, ease: 'linear' } : { duration: 0.5 }}
          style={{
            width: 280, height: 280,
            borderRadius: isPlaying ? '50%' : 24,
            background: audioBuffer
              ? `linear-gradient(135deg, hsl(${hue1}, 70%, 50%), hsl(${hue2}, 60%, 35%), hsl(${hue3}, 50%, 25%))`
              : 'var(--bg-elevated)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: audioBuffer
              ? `0 20px 60px hsla(${hue1}, 60%, 20%, 0.5), 0 0 40px var(--accent-glow)`
              : '0 8px 24px rgba(0,0,0,0.3)',
            transition: 'border-radius 0.5s ease',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {audioBuffer ? (
            <>
              <Disc3 size={80} color="rgba(255,255,255,0.3)" />
              {isPlaying && (
                <div style={{
                  position: 'absolute', inset: 0,
                  borderRadius: 'inherit',
                  border: '2px solid rgba(255,255,255,0.1)',
                }} />
              )}
            </>
          ) : (
            <Music size={64} color="var(--text-dim)" />
          )}
        </motion.div>

        {/* Track Info */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            fontSize: 24, fontWeight: 700, color: 'var(--text)',
            margin: '0 0 8px',
            letterSpacing: '-0.02em',
            maxWidth: 400,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {fileName || 'No Track Loaded'}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
            {currentTrack?.artist || (audioBuffer ? 'Unknown Artist' : 'Drop a file or explore YouTube')}
          </p>
          {audioBuffer && (
            <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '8px 0 0', fontFamily: "'JetBrains Mono', monospace" }}>
              {(audioBuffer.duration / params.speed).toFixed(1)}s at {params.speed}x • {audioBuffer.numberOfChannels}ch • 44.1kHz
            </p>
          )}
        </div>

        {/* Active Preset Badge */}
        {audioBuffer && (
          <div style={{ display: 'flex', gap: 8 }}>
            {usePlayerStore.getState().activePresets.map(name => (
              <span key={name} style={{
                padding: '5px 14px',
                borderRadius: 20,
                background: 'var(--accent-muted)',
                border: '1px solid var(--border-accent)',
                color: 'var(--accent)',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.04em',
              }}>
                {name}
              </span>
            ))}
          </div>
        )}

        {/* Waveform */}
        <div style={{ width: '100%' }}>
          <WaveformCanvas analyserRef={{ current: null }} isPlaying={isPlaying} />
        </div>

        {/* Helpful Text */}
        {!audioBuffer && (
          <div className="glass-panel" style={{ padding: 24, textAlign: 'center', width: '100%' }}>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 8px', fontWeight: 500 }}>
              Welcome to Sloverb Studio
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0, lineHeight: 1.7 }}>
              Load a track from your Library, drop a file into the Studio,<br />
              or explore YouTube to discover new music.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
