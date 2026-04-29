import { usePlayerStore } from '../../stores/playerStore';
import { useUIStore } from '../../stores/uiStore';
import { motion } from 'framer-motion';
import { Music, Download, Check, Globe, Play, Pause, Disc3, Mic, MicOff } from 'lucide-react';
import { extractAudioFromVideo, muxAudioToVideo } from '../../ffmpegProcessor.js';
import { encodeWAV, buildOfflineChain, PRESETS } from '../../lib/audioEngine.js';
import { playbackEngine } from '../../lib/playbackEngine.js';
import { useRef, useEffect } from 'react';

/* ── Knob ── */
function Knob({ label, value, min, max, step, onChange, unit = '', color = 'var(--accent)' }) {
  const pct = (value - min) / (max - min);
  const angle = -135 + pct * 270;
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(0);
  const onMouseDown = (e) => {
    isDragging.current = true; startY.current = e.clientY; startVal.current = value;
    const move = (ev) => { if (!isDragging.current) return; const delta = (startY.current - ev.clientY) / 150; const nv = Math.min(max, Math.max(min, startVal.current + delta * (max - min))); onChange(Math.round(nv / step) * step); };
    const up = () => { isDragging.current = false; document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
  };
  const cx = 30, cy = 30, r = 22;
  const startRad = (-135 + 90) * Math.PI / 180;
  const endRad = (angle + 90) * Math.PI / 180;
  const x1 = cx + r * Math.cos(startRad), y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad), y2 = cy + r * Math.sin(endRad);
  const largeArc = (angle + 135) > 180 ? 1 : 0;
  const pRad = (angle + 90) * Math.PI / 180;
  const px = cx + 14 * Math.cos(pRad), py = cy + 14 * Math.sin(pRad);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, userSelect: 'none' }}>
      <svg width={60} height={60} onMouseDown={onMouseDown} style={{ cursor: 'ns-resize' }}>
        <circle cx={cx} cy={cy} r={r} fill="var(--bg-surface)" stroke="var(--glass-border)" strokeWidth={2} />
        <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={10} fill="var(--bg)" />
        <line x1={cx} y1={cy} x2={px} y2={py} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      </svg>
      <span className="font-mono" style={{ color, fontSize: 11 }}>{typeof value === 'number' ? value.toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0) : value}{unit}</span>
      <span style={{ color: 'var(--text-dim)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
    </div>
  );
}

/* ── Visualizer ── */
import { useState as useReactState } from 'react';
const VIZ_MODES = ['waveform', 'bars', 'particles', 'circular', 'mirror', 'galaxy'];
function Visualizer({ analyserRef, isPlaying }) {
  const canvasRef = useRef(null);
  const raf = useRef(null);
  const [mode, setMode] = useReactState('waveform');

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    for (let i = 0; i < 60; i++) particles.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, size: Math.random() * 3 + 1 });

    const draw = () => {
      raf.current = requestAnimationFrame(draw);
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      if (!analyserRef?.current || !isPlaying) {
        ctx.beginPath(); ctx.strokeStyle = 'rgba(167,139,250,0.15)'; ctx.lineWidth = 1.5;
        ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke(); return;
      }
      const bufSize = analyserRef.current.frequencyBinCount;
      const timeBuf = new Uint8Array(bufSize);
      const freqBuf = new Uint8Array(bufSize);
      analyserRef.current.getByteTimeDomainData(timeBuf);
      analyserRef.current.getByteFrequencyData(freqBuf);

      if (mode === 'waveform') {
        const grad = ctx.createLinearGradient(0, 0, W, 0);
        grad.addColorStop(0, 'rgba(167,139,250,0.8)'); grad.addColorStop(0.5, 'rgba(192,132,252,1)'); grad.addColorStop(1, 'rgba(244,114,182,0.8)');
        ctx.beginPath(); ctx.strokeStyle = grad; ctx.lineWidth = 2.5;
        const sw = W / timeBuf.length;
        for (let i = 0, x = 0; i < timeBuf.length; i++, x += sw) {
          const y = (timeBuf[i] / 128.0) * H / 2;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else if (mode === 'bars') {
        const barCount = 64;
        const barWidth = W / barCount - 2;
        for (let i = 0; i < barCount; i++) {
          const idx = Math.floor(i * bufSize / barCount);
          const barHeight = (freqBuf[idx] / 255.0) * H;
          const hue = (i / barCount) * 280 + 220;
          ctx.fillStyle = `hsla(${hue}, 80%, 60%, 0.85)`;
          ctx.fillRect(i * (barWidth + 2), H - barHeight, barWidth, barHeight);
        }
      } else if (mode === 'particles') {
        let sum = 0; for (let i = 0; i < 10; i++) sum += freqBuf[i];
        const bass = sum / 10;
        particles.forEach(p => {
          p.x += p.vx * (bass / 50 + 1); p.y += p.vy * (bass / 50 + 1);
          if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
          if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size + (bass / 40), 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${(p.x / W) * 360}, 80%, 60%, ${0.3 + (bass/255)})`; ctx.fill();
        });
      } else if (mode === 'circular') {
        const cx = W / 2, cy = H / 2, radius = Math.min(W, H) * 0.3;
        ctx.beginPath();
        for (let i = 0; i < 128; i++) {
          const idx = Math.floor(i * bufSize / 128);
          const amp = freqBuf[idx] / 255;
          const angle = (i / 128) * Math.PI * 2 - Math.PI / 2;
          const r = radius + amp * radius * 0.6;
          const x = cx + Math.cos(angle) * r, y = cy + Math.sin(angle) * r;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        const grad = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius * 1.5);
        grad.addColorStop(0, 'rgba(167,139,250,0.9)'); grad.addColorStop(1, 'rgba(244,114,182,0.4)');
        ctx.strokeStyle = grad; ctx.lineWidth = 2; ctx.stroke();
      } else if (mode === 'mirror') {
        const barCount = 64; const barWidth = W / barCount - 1;
        for (let i = 0; i < barCount; i++) {
          const idx = Math.floor(i * bufSize / barCount);
          const barHeight = (freqBuf[idx] / 255.0) * H / 2;
          const hue = (i / barCount) * 180 + 200;
          ctx.fillStyle = `hsla(${hue}, 70%, 55%, 0.7)`;
          ctx.fillRect(i * (barWidth + 1), H / 2 - barHeight, barWidth, barHeight);
          ctx.fillRect(i * (barWidth + 1), H / 2, barWidth, barHeight);
        }
      } else if (mode === 'galaxy') {
        let sum = 0; for (let i = 0; i < 20; i++) sum += freqBuf[i];
        const energy = sum / 20; const cx = W / 2, cy = H / 2;
        for (let i = 0; i < 100; i++) {
          const angle = (i / 100) * Math.PI * 2 + energy * 0.02;
          const dist = 10 + (i / 100) * (Math.min(W, H) * 0.45);
          const wobble = Math.sin(angle * 3 + energy * 0.05) * (energy / 10);
          const x = cx + Math.cos(angle) * (dist + wobble);
          const y = cy + Math.sin(angle) * (dist + wobble) * 0.6;
          const size = 1 + (freqBuf[i % bufSize] / 255) * 3;
          ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${(i * 3.6) + 200}, 70%, 60%, ${0.3 + (freqBuf[i % bufSize] / 255) * 0.7})`; ctx.fill();
        }
      }
    };
    draw();
    return () => cancelAnimationFrame(raf.current);
  }, [analyserRef, isPlaying, mode]);

  return (
    <div style={{ position: 'relative' }}>
      <canvas ref={canvasRef} onClick={() => setMode(VIZ_MODES[(VIZ_MODES.indexOf(mode) + 1) % VIZ_MODES.length])} width={700} height={80} style={{ width: '100%', height: 80, borderRadius: 10, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', cursor: 'pointer' }} />
      <div style={{ position: 'absolute', top: 6, right: 8, fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', pointerEvents: 'none', background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: 4 }}>
        {mode} (click to change)
      </div>
    </div>
  );
}

/* ── Main View ── */
export default function StudioView() {
  const store = usePlayerStore();
  const { addToast } = useUIStore();
  const { params, setParam, audioBuffer, fileName, isExporting, exportProgress, exportDone, isProcessing, loadingText, progress, isVideo, originalVideoFile, activePresets, savedPresets, youtubeUrl, isPlaying, currentTime, analyserRef, albumArt } = store;

  const formatTime = (s) => { if (!s || isNaN(s)) return '0:00'; return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`; };

  const handleDrop = (e) => { e.preventDefault(); handleFile(e.dataTransfer?.files[0]); };
  const handleFile = async (f) => {
    if (!f) return;
    store.setIsProcessing(true); store.setLoadingText('Reading file...'); store.setAudioBuffer(null);
    store.setIsPlaying(false); store.setExportDone(false); store.setProgress(0); store.setFileName(f.name);
    let arrBuf;
    if (f.type?.startsWith('video/')) {
      store.setIsVideo(true); store.setOriginalVideoFile(f);
      store.setLoadingText('Extracting audio...');
      try { const blob = await extractAudioFromVideo(f, (p) => store.setProgress(p)); arrBuf = await blob.arrayBuffer(); } catch { store.setIsProcessing(false); return; }
    } else {
      store.setIsVideo(false); store.setOriginalVideoFile(null); arrBuf = await f.arrayBuffer();
    }
    const ctx = playbackEngine.ensureCtx();
    const decoded = await ctx.decodeAudioData(arrBuf);
    store.setAudioBuffer(decoded); store.setIsProcessing(false); store.setProgress(100);
    playbackEngine.play();
    addToast(`Loaded: ${f.name}`, 'success');
  };

  const handleExport = async () => {
    if (!audioBuffer) return;
    store.setIsExporting(true); store.setExportProgress(0); store.setExportDone(false);
    try {
      const dur = audioBuffer.duration / params.speed + params.reverbSize + 1;
      const offCtx = new OfflineAudioContext(2, Math.ceil(44100 * dur), 44100);
      const src = buildOfflineChain(offCtx, audioBuffer, params); src.start(0);
      const iv = setInterval(() => store.setExportProgress(p => Math.min(p + 3, 90)), 200);
      const rendered = await offCtx.startRendering(); clearInterval(iv); store.setExportProgress(95);
      const wav = encodeWAV(rendered);
      let blob = new Blob([wav], { type: 'audio/wav' }); let ext = 'wav';
      if (isVideo && originalVideoFile) { blob = await muxAudioToVideo(originalVideoFile, blob); ext = 'mp4'; }
      const out = `${fileName.replace(/\.[^/.]+$/, '')}_sloverb.${ext}`;
      if (window.electronAPI) { await window.electronAPI.saveGeneration(out, await blob.arrayBuffer()); }
      else { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = out; a.click(); URL.revokeObjectURL(u); }
      store.setExportProgress(100); store.setExportDone(true);
      addToast(`Exported: ${out}`, 'success');
    } catch (e) { console.error(e); addToast('Export failed', 'error'); }
    store.setIsExporting(false);
  };

  const handleYoutube = async () => {
    if (!youtubeUrl || !window.electronAPI) return;
    const urlToFetch = youtubeUrl;
    const dlId = Date.now().toString();
    store.setYoutubeUrl('');
    store.addActiveDownload({ id: dlId, title: 'Fetching...', url: urlToFetch, status: 'downloading', timestamp: Date.now() });
    addToast('Downloading from YouTube...', 'info');
    try {
      const data = await window.electronAPI.fetchYoutube(urlToFetch);
      store.updateActiveDownload(dlId, { title: data.title, status: 'done' });
      // Add to queue after completion
      const queueItem = data.libraryItem || {
        name: data.title, path: data.path, id: data.id,
        type: data.path?.endsWith('.mp4') ? 'video' : 'youtube',
        artist: data.artist || 'YouTube', album: 'YouTube Downloads',
      };
      store.addToQueue(queueItem);
      // Save to download history
      store.addToDownloadHistory({
        title: data.title, artist: data.artist || 'YouTube',
        path: data.path, size: data.size, timestamp: Date.now(), url: urlToFetch,
      });
      addToast(`Queued: ${data.title}`, 'success');
      // Remove from active after 3s
      setTimeout(() => store.removeActiveDownload(dlId), 3000);
    } catch (e) {
      store.updateActiveDownload(dlId, { status: 'error', error: e?.message });
      addToast(e?.message || 'YouTube download failed', 'error');
      setTimeout(() => store.removeActiveDownload(dlId), 5000);
    }
  };

  const allPresets = { ...PRESETS, ...savedPresets };
  const idHash = (fileName || 'sloverb').split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const h1 = idHash % 360, h2 = (h1 + 50) % 360;

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '24px 28px' }} onDrop={handleDrop} onDragOver={e => e.preventDefault()}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 750, margin: '0 auto' }}>

        {/* ═══ NOW PLAYING SECTION ═══ */}
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginBottom: 28, flexWrap: 'wrap' }}>
          {/* Album Art */}
          <motion.div
            animate={isPlaying ? { rotate: 360 } : { rotate: 0 }}
            transition={isPlaying ? { duration: 8, repeat: Infinity, ease: 'linear' } : { duration: 0.5 }}
            style={{
              width: 120, height: 120, borderRadius: isPlaying ? '50%' : 16, flexShrink: 0,
              background: albumArt ? `url(${albumArt}) center/cover` : (audioBuffer ? `linear-gradient(135deg, hsl(${h1},70%,50%), hsl(${h2},60%,35%))` : 'var(--bg-elevated)'),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: albumArt ? `0 12px 40px rgba(0,0,0,0.4)` : (audioBuffer ? `0 12px 40px hsla(${h1},60%,20%,0.4)` : 'none'),
              transition: 'border-radius 0.4s',
            }}
          >
            {(!albumArt && audioBuffer) ? <Disc3 size={40} color="rgba(255,255,255,0.3)" /> : (!albumArt && !audioBuffer && <Music size={32} color="var(--text-dim)" />)}
          </motion.div>

          {/* Track Info + Controls */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fileName || 'No Track Loaded'}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '0 0 12px' }}>
              {audioBuffer ? `${formatTime(audioBuffer.duration)} • ${params.speed}x • ${audioBuffer.numberOfChannels}ch` : 'Drop a file or load from YouTube'}
            </p>

            {/* Play + Seek */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => audioBuffer && playbackEngine.seek(Math.max(0, currentTime - 5))} disabled={!audioBuffer} title="-5s" style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700,
                background: 'var(--bg-elevated)', color: audioBuffer ? 'var(--text-secondary)' : 'var(--text-dim)', cursor: audioBuffer ? 'pointer' : 'default', border: '1px solid var(--glass-border)', transition: 'all 0.2s',
              }}>-5</button>

              <button onClick={() => playbackEngine.togglePlay()} disabled={!audioBuffer} style={{
                width: 40, height: 40, borderRadius: '50%',
                background: audioBuffer ? 'var(--accent)' : 'var(--bg-elevated)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: audioBuffer ? '#fff' : 'var(--text-dim)',
                boxShadow: audioBuffer ? '0 0 16px var(--accent-glow)' : 'none',
                cursor: audioBuffer ? 'pointer' : 'default', transition: 'all 0.2s',
              }}>
                {isPlaying ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: 2 }} />}
              </button>

              <button onClick={() => audioBuffer && playbackEngine.seek(Math.min(audioBuffer.duration, currentTime + 5))} disabled={!audioBuffer} title="+5s" style={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700,
                background: 'var(--bg-elevated)', color: audioBuffer ? 'var(--text-secondary)' : 'var(--text-dim)', cursor: audioBuffer ? 'pointer' : 'default', border: '1px solid var(--glass-border)', transition: 'all 0.2s',
              }}>+5</button>

              <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-dim)', width: 36, textAlign: 'right' }}>{formatTime(currentTime)}</span>
              <div style={{ flex: 1, position: 'relative', height: 6, background: 'var(--glass-border)', borderRadius: 3, cursor: audioBuffer ? 'pointer' : 'default' }}
                onClick={e => { if (!audioBuffer) return; const rect = e.currentTarget.getBoundingClientRect(); const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)); playbackEngine.seek(pct * audioBuffer.duration); }}>
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${audioBuffer ? (currentTime / audioBuffer.duration) * 100 : 0}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-hot))', borderRadius: 3, boxShadow: '0 0 8px var(--accent-glow)' }} />
              </div>
              <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-dim)', width: 36 }}>{formatTime(audioBuffer?.duration || 0)}</span>
            </div>

            {/* Waveform */}
            <div style={{ marginTop: 12 }}><Visualizer analyserRef={analyserRef} isPlaying={isPlaying} /></div>
          </div>
        </div>

        {/* ═══ DROP ZONE (ALWAYS VISIBLE) ═══ */}
        {!isProcessing && (
          <div className="glass-panel" style={{ padding: audioBuffer ? '16px' : '36px 24px', textAlign: 'center', marginBottom: 24, display: 'flex', flexDirection: audioBuffer ? 'row' : 'column', alignItems: 'center', gap: 16 }}>
            <div onClick={() => document.getElementById('studioFileInput')?.click()} style={{ cursor: 'pointer', flex: 1, display: 'flex', flexDirection: audioBuffer ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <input id="studioFileInput" type="file" accept="audio/*,video/*" style={{ display: 'none' }} onChange={e => {
                if (audioBuffer) {
                  store.addToQueue({ type: 'file', file: e.target.files[0], name: e.target.files[0].name });
                  addToast(`Added ${e.target.files[0].name} to queue`, 'success');
                } else {
                  handleFile(e.target.files[0]);
                }
              }} />
              <div style={{ width: audioBuffer ? 40 : 60, height: audioBuffer ? 40 : 60, borderRadius: '50%', background: 'var(--accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Music size={audioBuffer ? 20 : 28} color="var(--accent)" />
              </div>
              <div style={{ textAlign: audioBuffer ? 'left' : 'center' }}>
                <p style={{ color: 'var(--text)', fontSize: 14, fontWeight: 600, margin: '0 0 2px' }}>{audioBuffer ? 'Add to Queue' : 'Drop your audio or video here'}</p>
                <p style={{ color: 'var(--text-dim)', fontSize: 11, margin: 0 }}>MP3 • WAV • FLAC • M4A • OGG • MP4</p>
              </div>
            </div>
            
            {window.electronAPI && (
              <div style={{ flex: 1, padding: 14, background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--glass-border)' }} onClick={e => e.stopPropagation()}>
                <p style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px', textAlign: 'left' }}>YouTube Import</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={youtubeUrl} onChange={e => store.setYoutubeUrl(e.target.value)} placeholder="Paste YouTube link..." className="input" style={{ flex: 1 }} />
                  <button onClick={async () => {
                    if (audioBuffer) {
                      store.addToQueue({ type: 'youtube', url: youtubeUrl, name: 'YouTube Track' });
                      addToast('Added YouTube link to queue', 'success');
                      store.setYoutubeUrl('');
                    } else {
                      handleYoutube();
                    }
                  }} disabled={!youtubeUrl} className="btn btn-primary" style={{ opacity: youtubeUrl ? 1 : 0.5 }}><Globe size={14} /> Load</button>
                </div>
              </div>
            )}
          </div>
        )}

        {isProcessing && (
          <div className="glass-panel" style={{ padding: 20, textAlign: 'center', marginBottom: 24 }}>
            <p style={{ color: 'var(--accent)', fontSize: 13, fontWeight: 600, margin: '0 0 8px' }}>{loadingText}</p>
            <div style={{ background: 'var(--accent-muted)', borderRadius: 4, height: 3, overflow: 'hidden' }}>
              <div style={{ background: 'var(--accent)', height: '100%', width: `${progress}%`, transition: 'width 0.3s' }} />
            </div>
          </div>
        )}

        {/* ═══ PRESETS ═══ */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 12px', fontWeight: 700 }}>Presets</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {Object.keys(allPresets).map(name => {
              const isActive = activePresets.includes(name);
              return (
                <button key={name} onClick={(e) => store.applyPreset(name, e.ctrlKey || e.shiftKey)}
                  style={{
                    position: 'relative',
                    padding: '12px 14px', borderRadius: 12,
                    background: isActive ? 'linear-gradient(135deg, var(--accent), var(--accent-secondary))' : 'var(--bg-surface)',
                    border: `1px solid ${isActive ? 'transparent' : 'var(--glass-border)'}`,
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                    fontWeight: isActive ? 700 : 500, fontSize: 12,
                    textAlign: 'left', cursor: 'pointer', overflow: 'hidden',
                    transition: 'all 0.2s',
                    boxShadow: isActive ? '0 4px 16px var(--accent-glow)' : 'none'
                  }}
                  onMouseEnter={e => { if(!isActive) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                  onMouseLeave={e => { if(!isActive) e.currentTarget.style.background = 'var(--bg-surface)'; }}
                >
                  <div style={{ position: 'relative', zIndex: 1 }}>{name}</div>
                  {isActive && <div style={{ position: 'absolute', right: -10, bottom: -10, opacity: 0.2 }}><Disc3 size={40} /></div>}
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ VOICE: ORIGINAL / EFFECT ═══ */}
        <div className="glass-panel" style={{ padding: '10px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>Voice</span>
          <div style={{ display: 'flex', flex: 1, background: 'var(--bg-elevated)', borderRadius: 10, padding: 3, border: '1px solid var(--glass-border)' }}>
            {[{ label: 'Original', val: true }, { label: 'Effect', val: false }].map(opt => {
              const active = (params.preservePitch || false) === opt.val;
              return (
                <button key={opt.label} onClick={() => setParam('preservePitch', opt.val)} style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  border: 'none', transition: 'all 0.25s',
                  background: active ? 'linear-gradient(135deg, var(--accent), var(--accent-secondary))' : 'transparent',
                  color: active ? '#fff' : 'var(--text-dim)',
                  boxShadow: active ? '0 2px 8px var(--accent-glow)' : 'none',
                }}>{opt.label}</button>
              );
            })}
          </div>
        </div>

        {/* ═══ UP NEXT (Interactive: double-click to play, drag to rearrange) ═══ */}
        {store.queue.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0, fontWeight: 700 }}>Up Next ({store.queue.length})</p>
              <button onClick={() => store.clearQueue()} style={{ fontSize: 10, color: 'var(--text-dim)', background: 'none', border: '1px solid var(--glass-border)', borderRadius: 12, padding: '3px 10px', cursor: 'pointer' }}>Clear</button>
            </div>
            <div style={{ background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--glass-border)', overflow: 'hidden', maxHeight: 320, overflowY: 'auto' }}>
              {store.queue.map((q, i) => {
                const hash = (q.name || '').split('').reduce((a, b) => a + b.charCodeAt(0), 0);
                const h = hash % 360;
                return (
                  <div
                    key={(q.id || q.name) + i}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('queue-index', i.toString())}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderTop = '2px solid var(--accent)'; }}
                    onDragLeave={(e) => { e.currentTarget.style.borderTop = 'none'; }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.style.borderTop = 'none';
                      const fromIdx = parseInt(e.dataTransfer.getData('queue-index'));
                      if (isNaN(fromIdx) || fromIdx === i) return;
                      const newQueue = [...store.queue];
                      const [moved] = newQueue.splice(fromIdx, 1);
                      newQueue.splice(i, 0, moved);
                      store.setQueue(newQueue);
                    }}
                    onDoubleClick={async () => {
                      if (!window.electronAPI) return;
                      try {
                        const buf = await window.electronAPI.readFile(q.path || q.id);
                        const f = new File([buf], q.name, { type: q.name?.endsWith('.mp4') ? 'video/mp4' : 'audio/wav' });
                        f.path = q.path || q.id;
                        playbackEngine.loadFileAndPlay(f, q);
                        const newQueue = [...store.queue];
                        newQueue.splice(i, 1);
                        store.setQueue(newQueue);
                      } catch { addToast('Failed to play', 'error'); }
                    }}
                    className="queue-row"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px',
                      borderBottom: i < store.queue.length - 1 ? '1px solid var(--glass-border)' : 'none',
                      cursor: 'grab', transition: 'background 0.15s', borderTop: 'none',
                    }}
                  >
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', cursor: 'grab', userSelect: 'none' }}>⠿</span>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)', width: 18, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                    <div style={{ width: 32, height: 32, borderRadius: 6, background: `linear-gradient(135deg, hsl(${h},60%,50%), hsl(${(h+40)%360},55%,35%))`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Music size={12} color="rgba(255,255,255,0.5)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.name}</p>
                      <p style={{ margin: '1px 0 0', fontSize: 10, color: 'var(--text-dim)' }}>{q.artist || 'Unknown'}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); const newQ = [...store.queue]; newQ.splice(i, 1); store.setQueue(newQ); }} style={{ color: 'var(--text-dim)', fontSize: 10, padding: 2, cursor: 'pointer', background: 'none', border: 'none' }}>✕</button>
                  </div>
                );
              })}
            </div>
            <style>{`
              .queue-row:hover { background: var(--bg-hover); }
            `}</style>
          </div>
        )}

        {/* ═══ KNOBS ═══ */}
        <div className="glass-panel" style={{ padding: '20px 16px', marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 16, justifyItems: 'center' }}>
            <Knob label="Speed" value={params.speed} min={0.4} max={1.0} step={0.01} onChange={v => setParam('speed', v)} unit="x" />
            <Knob label="Reverb" value={params.reverbMix} min={0} max={1} step={0.01} onChange={v => setParam('reverbMix', v)} />
            <Knob label="Decay" value={params.reverbDecay} min={1} max={10} step={0.1} onChange={v => setParam('reverbDecay', v)} color="var(--accent-secondary)" />
            <Knob label="Size" value={params.reverbSize} min={0.5} max={8} step={0.1} onChange={v => setParam('reverbSize', v)} unit="s" />
            <Knob label="Bass" value={params.bassBoost} min={0} max={18} step={0.5} onChange={v => setParam('bassBoost', v)} unit="dB" color="var(--accent-hot)" />
            <Knob label="Warmth" value={params.warmth} min={0} max={12} step={0.5} onChange={v => setParam('warmth', v)} color="var(--accent-hot)" />
          </div>
        </div>

        {/* ═══ SLIDERS ═══ */}
        <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: 20 }}>
          <p style={{ color: 'var(--text-dim)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 14px', fontWeight: 600 }}>Fine Controls</p>
          {[
            { key: 'stereoWidth', label: 'Stereo Width', min: 0, max: 1, step: 0.01, unit: '%', m: 100 },
            { key: 'preDelay', label: 'Pre-Delay', min: 0, max: 0.2, step: 0.01, unit: 's', m: 1 },
            { key: 'vinyl', label: 'Vinyl Crackle', min: 0, max: 1, step: 0.01, unit: '%', m: 100 },
          ].map(({ key, label, min, max, step, unit, m }) => (
            <div key={key} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{label}</span>
                <span className="font-mono" style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 600 }}>{(params[key] * m).toFixed(m > 1 ? 0 : 2)}{unit}</span>
              </div>
              <input type="range" min={min} max={max} step={step} value={params[key]} onChange={e => setParam(key, parseFloat(e.target.value))} style={{ width: '100%' }} />
            </div>
          ))}
        </div>

        {/* ═══ EXPORT ═══ */}
        {audioBuffer && (
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 40 }}>
            <button onClick={handleExport} disabled={isExporting} className="btn btn-primary" style={{ padding: '12px 28px', fontSize: 13, fontWeight: 700, borderRadius: 12, flex: 1, maxWidth: 300, opacity: isExporting ? 0.6 : 1, position: 'relative', overflow: 'hidden' }}>
              {isExporting ? <span>Rendering... {exportProgress}%</span> : exportDone ? <><Check size={16} /> Exported!</> : <><Download size={16} /> Export WAV</>}
              {isExporting && <div style={{ position: 'absolute', bottom: 0, left: 0, height: 3, background: 'rgba(255,255,255,0.3)', width: `${exportProgress}%`, transition: 'width 0.2s' }} />}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
