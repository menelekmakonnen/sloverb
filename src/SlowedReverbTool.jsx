import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { extractAudioFromVideo, muxAudioToVideo } from './ffmpegProcessor.js';
import '@fontsource/space-mono';
import '@fontsource/syne';

// --- WAV Encoder ---
function encodeWAV(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const samples = audioBuffer.length;
  const blockAlign = (numChannels * bitDepth) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return buffer;
}

// --- Impulse Response Generator ---
function generateImpulseResponse(audioCtx, duration, decay, preDelay = 0.01) {
  const sampleRate = audioCtx.sampleRate;
  const length = Math.ceil(sampleRate * (duration + preDelay));
  const impulse = audioCtx.createBuffer(2, length, sampleRate);
  const preDelaySamples = Math.ceil(sampleRate * preDelay);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = preDelaySamples; i < length; i++) {
      const t = (i - preDelaySamples) / sampleRate;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t / duration, decay);
    }
  }
  return impulse;
}

// --- Noise Generator ---
function addVinylNoise(ctx, vinylAmount, masterGain) {
  if (!vinylAmount || vinylAmount <= 0) return null;
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    let white = Math.random() * 2 - 1;
    output[i] = (output[i - 1] || 0) * 0.9 + white * 0.1;
    if (Math.random() < 0.001) output[i] += (Math.random() * 2 - 1) * 2;
  }
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = buffer;
  noiseSource.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 2000;

  const gain = ctx.createGain();
  gain.gain.value = vinylAmount * 0.05;

  noiseSource.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  return { source: noiseSource, gain };
}

// --- Build Audio Chain for Offline Export ---
function buildChain(offlineCtx, sourceBuffer, params) {
  const { speed, reverbMix, reverbDecay, reverbSize, bassBoost, warmth, stereoWidth, normalize } = params;

  const source = offlineCtx.createBufferSource();
  source.buffer = sourceBuffer;
  source.playbackRate.value = speed;
  if ('preservesPitch' in source) {
    source.preservesPitch = params.preservePitch || false;
  }

  // Bass boost
  const bass = offlineCtx.createBiquadFilter();
  bass.type = "lowshelf";
  bass.frequency.value = 200;
  bass.gain.value = bassBoost;

  // Warmth (high-frequency roll-off for lo-fi warmth)
  const warmFilter = offlineCtx.createBiquadFilter();
  warmFilter.type = "highshelf";
  warmFilter.frequency.value = 6000;
  warmFilter.gain.value = -warmth;

  // Subtle low-mid presence boost
  const presenceFilter = offlineCtx.createBiquadFilter();
  presenceFilter.type = "peaking";
  presenceFilter.frequency.value = 800;
  presenceFilter.Q.value = 0.8;
  presenceFilter.gain.value = Math.min(bassBoost * 0.3, 4);

  // Compressor for glue
  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 12;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;

  // Reverb convolver
  const convolver = offlineCtx.createConvolver();
  convolver.buffer = generateImpulseResponse(offlineCtx, reverbSize, reverbDecay, params.preDelay || 0);

  // Wet/Dry merge
  const dryGain = offlineCtx.createGain();
  dryGain.gain.value = 1 - reverbMix * 0.6;
  const wetGain = offlineCtx.createGain();
  wetGain.gain.value = reverbMix * 1.4;

  // Pre-Delay
  const preDelayNode = offlineCtx.createDelay();
  preDelayNode.delayTime.value = params.preDelay || 0;

  // Stereo Widening (Haas Effect)
  const splitter = offlineCtx.createChannelSplitter(2);
  const merger = offlineCtx.createChannelMerger(2);
  const widthDelay = offlineCtx.createDelay();
  widthDelay.delayTime.value = (stereoWidth || 0) * 0.02;

  // Master gain
  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = normalize ? 0.85 : 0.9;

  // Connect chain
  source.connect(bass);
  bass.connect(warmFilter);
  warmFilter.connect(presenceFilter);
  presenceFilter.connect(compressor);

  compressor.connect(dryGain);

  compressor.connect(preDelayNode);
  preDelayNode.connect(convolver);

  convolver.connect(splitter);
  splitter.connect(merger, 0, 0);
  splitter.connect(widthDelay, 1);
  widthDelay.connect(merger, 0, 1);
  merger.connect(wetGain);

  dryGain.connect(masterGain);
  wetGain.connect(masterGain);
  masterGain.connect(offlineCtx.destination);

  const noiseSrc = addVinylNoise(offlineCtx, params.vinyl || 0, masterGain);
  if (noiseSrc) noiseSrc.start(0);

  return source;
}

const PRESETS = {
  "Slowed": { speed: 0.80, reverbMix: 0.15, reverbDecay: 3, reverbSize: 2.5, bassBoost: 3, warmth: 2, stereoWidth: 0.3, preDelay: 0.02, vinyl: 0, preservePitch: false },
  "Slowed + Reverb": { speed: 0.78, reverbMix: 0.45, reverbDecay: 4, reverbSize: 3.5, bassBoost: 4, warmth: 3, stereoWidth: 0.5, preDelay: 0.05, vinyl: 0.1, preservePitch: false },
  "Dreamy": { speed: 0.75, reverbMix: 0.65, reverbDecay: 6, reverbSize: 5, bassBoost: 2, warmth: 5, stereoWidth: 0.6, preDelay: 0.08, vinyl: 0.2, preservePitch: false },
  "Underwater": { speed: 0.82, reverbMix: 0.70, reverbDecay: 5, reverbSize: 4, bassBoost: 6, warmth: 8, stereoWidth: 0.2, preDelay: 0.01, vinyl: 0.5, preservePitch: false },
  "Late Night": { speed: 0.85, reverbMix: 0.30, reverbDecay: 3.5, reverbSize: 2, bassBoost: 7, warmth: 4, stereoWidth: 0.4, preDelay: 0.04, vinyl: 0.2, preservePitch: false },
  "Daycore": { speed: 0.65, reverbMix: 0.10, reverbDecay: 2, reverbSize: 1, bassBoost: 8, warmth: 1, stereoWidth: 0.1, preDelay: 0.01, vinyl: 0, preservePitch: false },
  "Lo-Fi Glow": { speed: 0.80, reverbMix: 0.50, reverbDecay: 5, reverbSize: 4, bassBoost: 4, warmth: 8, stereoWidth: 0.5, preDelay: 0.10, vinyl: 0.8, preservePitch: false },
  "Vintage Vinyl": { speed: 0.85, reverbMix: 0.20, reverbDecay: 3, reverbSize: 2, bassBoost: 3, warmth: 10, stereoWidth: 0.1, preDelay: 0.02, vinyl: 1.0, preservePitch: false },
  "Abyss": { speed: 0.60, reverbMix: 0.85, reverbDecay: 8, reverbSize: 8, bassBoost: 5, warmth: 6, stereoWidth: 0.8, preDelay: 0.15, vinyl: 0.3, preservePitch: false },
  "Original": { speed: 1.0, reverbMix: 0, reverbDecay: 2, reverbSize: 2, bassBoost: 0, warmth: 0, stereoWidth: 0, preDelay: 0, vinyl: 0, preservePitch: false },
};

const Knob = ({ label, value, min, max, step, onChange, unit = "", color = "#a78bfa", isDark = true }) => {
  const pct = (value - min) / (max - min);
  const angle = -135 + pct * 270;
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(0);

  const onMouseDown = (e) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startVal.current = value;
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };
  const onMouseMove = (e) => {
    if (!isDragging.current) return;
    const delta = (startY.current - e.clientY) / 150;
    const newVal = Math.min(max, Math.max(min, startVal.current + delta * (max - min)));
    onChange(Math.round(newVal / step) * step);
  };
  const onMouseUp = () => {
    isDragging.current = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  };

  const r = 22;
  const cx = 30;
  const cy = 30;
  const startAngleRad = (-135 + 90) * (Math.PI / 180);
  const endAngleRad = (angle + 90) * (Math.PI / 180);
  const x1 = cx + r * Math.cos(startAngleRad);
  const y1 = cy + r * Math.sin(startAngleRad);
  const x2 = cx + r * Math.cos(endAngleRad);
  const y2 = cy + r * Math.sin(endAngleRad);
  const largeArc = (angle - (-135)) > 180 ? 1 : 0;

  const pointerAngleRad = (angle + 90) * (Math.PI / 180);
  const px = cx + 14 * Math.cos(pointerAngleRad);
  const py = cy + 14 * Math.sin(pointerAngleRad);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, userSelect: "none" }}>
      <svg width={60} height={60} onMouseDown={onMouseDown} style={{ cursor: "ns-resize" }}>
        <circle cx={cx} cy={cy} r={r} fill={isDark ? "#1a1a2e" : "#f1f5f9"} stroke={isDark ? "#2a2a4a" : "#cbd5e1"} strokeWidth={2} />
        <path
          d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
          fill="none" stroke={color} strokeWidth={3} strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={10} fill={isDark ? "#0f0f1e" : "#e2e8f0"} />
        <line x1={cx} y1={cy} x2={px} y2={py} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      </svg>
      <span style={{ color: color, fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: "0.05em" }}>
        {value.toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0)}{unit}
      </span>
      <span style={{ color: "#555", fontFamily: "'Space Mono', monospace", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>
        {label}
      </span>
    </div>
  );
};

const WaveformViz = ({ analyser, isPlaying }) => {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      if (!analyser || !isPlaying) {
        // Idle flat line
        ctx.beginPath();
        ctx.strokeStyle = "rgba(167,139,250,0.2)";
        ctx.lineWidth = 1.5;
        ctx.moveTo(0, H / 2);
        ctx.lineTo(W, H / 2);
        ctx.stroke();
        return;
      }

      const bufferLen = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLen);
      analyser.getByteTimeDomainData(dataArray);

      const gradient = ctx.createLinearGradient(0, 0, W, 0);
      gradient.addColorStop(0, "rgba(99,102,241,0.8)");
      gradient.addColorStop(0.5, "rgba(167,139,250,1)");
      gradient.addColorStop(1, "rgba(236,72,153,0.8)");

      ctx.beginPath();
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
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

      // Glow
      ctx.shadowColor = "rgba(167,139,250,0.5)";
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [analyser, isPlaying]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={80}
      style={{ width: "100%", height: 80, borderRadius: 8, background: "rgba(10,10,25,0.8)", border: "1px solid rgba(167,139,250,0.15)" }}
    />
  );
};

const Seeker = ({ audioCtxRef, startTimeRef, pauseOffsetRef, isPlaying, speed, duration, onSeek }) => {
  const [val, setVal] = useState(0);
  const reqRef = useRef();

  useEffect(() => {
    const tick = () => {
      if (isPlaying && audioCtxRef.current) {
        let elapsed = (audioCtxRef.current.currentTime - startTimeRef.current) * speed;
        setVal(Math.min(elapsed, duration));
      } else if (!isPlaying) {
        setVal(pauseOffsetRef.current);
      }
      reqRef.current = requestAnimationFrame(tick);
    };
    reqRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(reqRef.current);
  }, [isPlaying, speed, duration, pauseOffsetRef]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
      <span style={{ fontSize: 10, color: '#6b7280', fontFamily: "'Space Mono', monospace", width: 30, textAlign: "right" }}>
        {Math.floor(val)}s
      </span>
      <div style={{ position: "relative", flex: 1, height: 6, background: "rgba(100,100,150,0.2)", borderRadius: 4 }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${(val / duration) * 100}%`, background: "linear-gradient(90deg, #a78bfa, #f472b6)", borderRadius: 4, transition: isPlaying ? "none" : "width 0.1s" }} />
        <input
          type="range"
          min={0}
          max={duration}
          step={0.1}
          value={val}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            setVal(v);
            onSeek(v);
          }}
          style={{ position: "absolute", inset: 0, width: "100%", opacity: 0, cursor: 'pointer', height: "100%" }}
        />
      </div>
      <span style={{ fontSize: 10, color: '#6b7280', fontFamily: "'Space Mono', monospace", width: 30 }}>
        {Math.floor(duration)}s
      </span>
    </div>
  );
};

export default function SlowedReverbTool() {
  const [theme, setTheme] = useState("dark");
  const isDark = theme === "dark";

  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingText, setLoadingText] = useState("Loading...");
  const [isVideo, setIsVideo] = useState(false);
  const [originalVideoFile, setOriginalVideoFile] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportProgress, setExportProgress] = useState(0);
  const [activePresets, setActivePresets] = useState(["Slowed + Reverb"]);
  const [dragging, setDragging] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [savedPresets, setSavedPresets] = useState({});
  const [history, setHistory] = useState([]);
  const [library, setLibrary] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [activeLibraryTab, setActiveLibraryTab] = useState("songs"); // "songs" or "playlists"
  const [activePlaylistId, setActivePlaylistId] = useState(null);
  const [sortBy, setSortBy] = useState("dateDesc");
  const [currentTab, setCurrentTab] = useState("studio");
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(-1);
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [playbackContext, setPlaybackContext] = useState({ type: 'library', playlistId: null });
  const [studioQueue, setStudioQueue] = useState([]);
  const [masterVolume, setMasterVolume] = useState(0.9);

  const sortedLibrary = useMemo(() => {
    let sorted = [...library];
    if (sortBy === "dateDesc") sorted.sort((a, b) => b.timestamp - a.timestamp);
    if (sortBy === "dateAsc") sorted.sort((a, b) => a.timestamp - b.timestamp);
    if (sortBy === "titleAsc") sorted.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    if (sortBy === "titleDesc") sorted.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
    if (sortBy === "artistAsc") sorted.sort((a, b) => (a.artist || "Unknown Artist").localeCompare(b.artist || "Unknown Artist"));
    if (sortBy === "albumAsc") sorted.sort((a, b) => (a.album || "Unknown Album").localeCompare(b.album || "Unknown Album"));
    if (sortBy === "random") {
      for (let i = sorted.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
      }
    }
    return sorted;
  }, [library, sortBy]);

  const loadLocalData = useCallback(async () => {
    if (window.electronAPI) {
      window.electronAPI.loadPresets().then(res => setSavedPresets(res || {}));

      try {
        const hist = await window.electronAPI.getGenerations();
        setHistory(hist || []);
      } catch (e) { console.error("Could not load history", e); }

      try {
        const libData = await window.electronAPI.loadLibrary();
        setLibrary(libData?.songs || []);
        setPlaylists(libData?.playlists || []);
        setStudioQueue(libData?.queue || []);
      } catch (e) { console.error("Could not load library", e); }
    }
  }, []);

  useEffect(() => {
    loadLocalData();
  }, [loadLocalData]);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.saveLibrary({ songs: library, playlists, queue: studioQueue });
    }
  }, [studioQueue]);

  const [params, setParams] = useState(PRESETS["Slowed + Reverb"]);

  const audioCtxRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const noiseNodeRef = useRef(null);
  const audioNodesRef = useRef({}); // Stores references to active Web Audio nodes for live updates
  const analyserRef = useRef(null);
  const startTimeRef = useRef(0);
  const pauseOffsetRef = useRef(0);
  const requestRef = useRef();
  const prevReverbParams = useRef({ size: 0, decay: 0, preDelay: 0 });

  // Update audio nodes in real time
  useEffect(() => {
    if (!isPlaying || !audioNodesRef.current || !audioCtxRef.current) return;
    const nodes = audioNodesRef.current;

    // Volume Real-time
    if (nodes.masterGain) nodes.masterGain.gain.setTargetAtTime(masterVolume, audioCtxRef.current.currentTime, 0.05);
    const ctx = audioCtxRef.current;

    // Attempt dynamic pitch preservation update if supported (note: some browsers might require node rebuild for preservesPitch)
    if (nodes.source && ('preservesPitch' in nodes.source)) {
      nodes.source.preservesPitch = params.preservePitch || false;
    }

    try {
      const t = ctx.currentTime;
      if (nodes.source) nodes.source.playbackRate.setTargetAtTime(params.speed, t, 0.05);
      if (nodes.bass) nodes.bass.gain.setTargetAtTime(params.bassBoost, t, 0.05);
      if (nodes.warmFilter) nodes.warmFilter.gain.setTargetAtTime(-params.warmth, t, 0.05);

      if (nodes.convolver) {
        const prev = prevReverbParams.current;
        if (prev.size !== params.reverbSize || prev.decay !== params.reverbDecay || prev.preDelay !== params.preDelay) {
          nodes.convolver.buffer = generateImpulseResponse(ctx, params.reverbSize, params.reverbDecay, params.preDelay || 0);
          prevReverbParams.current = { size: params.reverbSize, decay: params.reverbDecay, preDelay: params.preDelay };
        }
      }

      if (nodes.dryGain) nodes.dryGain.gain.setTargetAtTime(1 - params.reverbMix * 0.6, t, 0.05);
      if (nodes.wetGain) nodes.wetGain.gain.setTargetAtTime(params.reverbMix * 1.4, t, 0.05);
      if (nodes.preDelayNode) nodes.preDelayNode.delayTime.setTargetAtTime(params.preDelay || 0, t, 0.05);
      if (nodes.widthDelay) nodes.widthDelay.delayTime.setTargetAtTime((params.stereoWidth || 0) * 0.02, t, 0.05);
      if (nodes.vinylGain) nodes.vinylGain.gain.setTargetAtTime((params.vinyl || 0) * 0.05, t, 0.05);
    } catch (e) { }
  }, [params, isPlaying]);

  useEffect(() => {
    if (shouldAutoPlay && audioBuffer) {
      startPlayback();
      setShouldAutoPlay(false);
    }
  }, [audioBuffer, shouldAutoPlay]);

  const setParam = (key, val) => {
    setParams(p => ({ ...p, [key]: val }));
    setActivePresets(["Custom"]);
  };

  // Add `bypassQueue` param to force loading
  const loadFile = async (f, bypassQueue = false) => {
    if (!f) return;

    // Auto-queue if actively playing and not bypassing
    if (audioBuffer && !bypassQueue) {
      setStudioQueue(q => [...q, { type: 'file', file: f, name: f.name }]);
      alert(`Added "${f.name}" to the Studio Queue`);
      return;
    }

    if (isPlaying) stopPlayback();

    setIsProcessing(true);
    setLoadingText("Reading file...");
    setAudioBuffer(null);
    setIsPlaying(false);
    setExportDone(false);
    setProgress(0);
    setLoadingText("Loading file...");

    let arrBuf;
    if (f.type.startsWith("video/")) {
      setIsVideo(true);
      setOriginalVideoFile(f);
      setLoadingText("Extracting audio from video...");
      try {
        const audioBlob = await extractAudioFromVideo(f, (p) => setProgress(p));
        arrBuf = await audioBlob.arrayBuffer();
        setLoadingText("Decoding audio track...");
      } catch (err) {
        console.error("FFmpeg extraction failed", err);
        setIsProcessing(false);
        return;
      }
    } else {
      setIsVideo(false);
      setOriginalVideoFile(null);
      arrBuf = await f.arrayBuffer();
    }

    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
    const decoded = await ctx.decodeAudioData(arrBuf);
    audioCtxRef.current = ctx;
    setAudioBuffer(decoded);
    setIsProcessing(false);
    setProgress(100);

    // Auto-save to library
    if (window.electronAPI && f.path) {
      await window.electronAPI.addToLibrary({
        id: f.path,
        type: "raw",
        name: f.name,
        path: f.path,
        timestamp: Date.now()
      });
      await loadLocalData();
    }
  };

  const stopPlayback = () => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch { }
      sourceNodeRef.current = null;
    }
    if (noiseNodeRef.current) {
      try { noiseNodeRef.current.stop(); } catch { }
      noiseNodeRef.current = null;
    }
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    setIsPlaying(false);
  };

  const startPlayback = () => {
    if (!audioBuffer || !audioCtxRef.current) return;
    stopPlayback();

    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume();

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyserRef.current = analyser;

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = params.speed;
    if ('preservesPitch' in source) {
      source.preservesPitch = params.preservePitch || false;
    }

    const bass = ctx.createBiquadFilter();
    bass.type = "lowshelf";
    bass.frequency.value = 200;
    bass.gain.value = params.bassBoost;

    const warmFilter = ctx.createBiquadFilter();
    warmFilter.type = "highshelf";
    warmFilter.frequency.value = 6000;
    warmFilter.gain.value = -params.warmth;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    const convolver = ctx.createConvolver();
    convolver.buffer = generateImpulseResponse(ctx, params.reverbSize, params.reverbDecay, params.preDelay || 0);

    const dryGain = ctx.createGain();
    dryGain.gain.value = 1 - params.reverbMix * 0.6;
    const wetGain = ctx.createGain();
    wetGain.gain.value = params.reverbMix * 1.4;

    const preDelayNode = ctx.createDelay();
    preDelayNode.delayTime.value = params.preDelay || 0;

    const splitter = ctx.createChannelSplitter(2);
    const merger = ctx.createChannelMerger(2);
    const widthDelay = ctx.createDelay();
    widthDelay.delayTime.value = (params.stereoWidth || 0) * 0.02;

    const masterGain = ctx.createGain();
    masterGain.gain.value = masterVolume;

    source.connect(bass);
    bass.connect(warmFilter);
    warmFilter.connect(compressor);
    compressor.connect(dryGain);

    compressor.connect(preDelayNode);
    preDelayNode.connect(convolver);

    convolver.connect(splitter);
    splitter.connect(merger, 0, 0);
    splitter.connect(widthDelay, 1);
    widthDelay.connect(merger, 0, 1);
    merger.connect(wetGain);

    dryGain.connect(masterGain);
    wetGain.connect(masterGain);
    masterGain.connect(analyser);
    analyser.connect(ctx.destination);

    const noiseData = addVinylNoise(ctx, params.vinyl || 0, masterGain);
    let vGain = null;
    if (noiseData) {
      noiseData.source.start(0);
      noiseNodeRef.current = noiseData.source;
      vGain = noiseData.gain;
    }

    prevReverbParams.current = { size: params.reverbSize, decay: params.reverbDecay, preDelay: params.preDelay };

    audioNodesRef.current = {
      source, bass, warmFilter, compressor, convolver, dryGain, wetGain, preDelayNode, widthDelay, masterGain, vinylGain: vGain
    };

    source.start(0, pauseOffsetRef.current);
    startTimeRef.current = ctx.currentTime - pauseOffsetRef.current / params.speed;
    sourceNodeRef.current = source;

    const animateTime = () => {
      if (audioCtxRef.current && isPlaying) {
        const elapsed = (audioCtxRef.current.currentTime - startTimeRef.current) * params.speed;
        setCurrentTime(Math.min(elapsed, audioBuffer.duration));
      }
      requestRef.current = requestAnimationFrame(animateTime);
    }
    requestRef.current = requestAnimationFrame(animateTime);

    source.onended = () => {
      setIsPlaying(false);
      pauseOffsetRef.current = 0;
      setCurrentTime(0);

      if (studioQueue.length > 0) {
        playNextInQueue();
        return;
      }

      if (currentPlaylistIndex !== -1) {
        if (playbackContext.type === 'library' && currentPlaylistIndex < library.length - 1) {
          playFromLibrary(currentPlaylistIndex + 1);
        } else if (playbackContext.type === 'playlist') {
          const pl = playlists.find(p => p.id === playbackContext.playlistId);
          if (pl && currentPlaylistIndex < pl.itemIds.length - 1) {
            playFromPlaylist(currentPlaylistIndex + 1, pl.id);
          }
        }
      }
    };
    setIsPlaying(true);
  };

  const playNextInQueue = async () => {
    if (studioQueue.length === 0) return;
    const nextItem = studioQueue[0];
    
    // We do NOT remove the item from the queue automatically anymore.
    // The user must manually clear or remove it.
    
    // BUT we must prevent infinite loops if the queue is exactly 1 item and it finishes playing.
    // To handle "Any item that has been slowed and played in the Queue will be automatically kept in the queue",
    // we actually just load it and let the user decide when to remove it.
    // However, we should probably stop the queue from auto-advancing to the SAME item infinitely 
    // when it finishes. 
    
    // For this implementation, we will load the first item. If the current playing item IS the first item,
    // and it just ended, we should probably not auto-play it again instantly.
    // Let's pop it and push it to the back to cycle, OR just pause?
    // The instructions say: "will be automatically kept in the queue... until user clears queue or removes a specific one"
    // Let's cycle it to the back of the queue so it stays in the queue but we move to the next song.

    const newQueue = studioQueue.slice(1);
    newQueue.push(nextItem);
    setStudioQueue(newQueue);

    if (nextItem.type === 'file' && nextItem.file) {
      setShouldAutoPlay(true);
      await loadFile(nextItem.file, true); // true = force bypass queue
    } else if (nextItem.type === 'library' && nextItem.libraryItem) {
      const item = nextItem.libraryItem;
      if (!window.electronAPI) return;
      try {
        const buffer = await window.electronAPI.readFile(item.path || item.id);
        const isMacVid = item.name.endsWith(".mp4") || item.type === "video";
        const f = new File([buffer], item.name, { type: isMacVid ? "video/mp4" : "audio/wav" });
        f.path = item.path || item.id;
        setShouldAutoPlay(true);
        await loadFile(f, true);
      } catch (e) { console.error("Could not load queued library item", e); }
    }
  };

  const playFromLibrary = async (index) => {
    const item = library[index];
    if (!item || !window.electronAPI) return;
    setCurrentPlaylistIndex(index);
    setPlaybackContext({ type: 'library', playlistId: null });
    setCurrentTab("studio");

    try {
      const buffer = await window.electronAPI.readFile(item.path || item.id);
      const isMacVid = item.name.endsWith(".mp4") || item.type === "video";
      const f = new File([buffer], item.name, { type: isMacVid ? "video/mp4" : "audio/wav" });
      f.path = item.path || item.id;
      setShouldAutoPlay(true);
      await loadFile(f);
    } catch (e) {
      console.error("Failed to load library item", e);
      setIsProcessing(false);
    }
  };

  const playFromPlaylist = async (index, playlistId) => {
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl) return;
    const item = library.find(s => s.id === pl.itemIds[index]);
    if (!item || !window.electronAPI) return;

    setCurrentPlaylistIndex(index);
    setPlaybackContext({ type: 'playlist', playlistId });
    setCurrentTab("studio");

    try {
      const buffer = await window.electronAPI.readFile(item.path || item.id);
      const isMacVid = item.name.endsWith(".mp4") || item.type === "video";
      const f = new File([buffer], item.name, { type: isMacVid ? "video/mp4" : "audio/wav" });
      f.path = item.path || item.id;
      setShouldAutoPlay(true);
      await loadFile(f);
    } catch (e) {
      console.error("Failed to load playlist item", e);
      setIsProcessing(false);
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      const elapsed = (audioCtxRef.current.currentTime - startTimeRef.current) * params.speed;
      pauseOffsetRef.current = Math.min(elapsed, audioBuffer.duration);
      stopPlayback();
    } else {
      startPlayback();
    }
  };

  const handleExport = async () => {
    if (!audioBuffer) return;
    setIsExporting(true);
    setExportProgress(0);
    setExportDone(false);

    try {
      const slowedDuration = audioBuffer.duration / params.speed;
      const reverbTail = params.reverbSize + 1;
      const totalDuration = slowedDuration + reverbTail;
      const sampleRate = 44100;
      const offlineCtx = new OfflineAudioContext(2, Math.ceil(sampleRate * totalDuration), sampleRate);

      const source = buildChain(offlineCtx, audioBuffer, params);
      source.start(0);

      // Progress simulation
      const interval = setInterval(() => setExportProgress(p => Math.min(p + 3, 90)), 200);

      const rendered = await offlineCtx.startRendering();
      clearInterval(interval);
      setExportProgress(95);

      const wavData = encodeWAV(rendered);
      const wavBlob = new Blob([wavData], { type: "audio/wav" });

      let finalBlob = wavBlob;
      let ext = "wav";

      if (isVideo && originalVideoFile) {
        finalBlob = await muxAudioToVideo(originalVideoFile, wavBlob, (Math.floor));
        ext = "mp4";
      }

      const baseName = fileName.replace(/\.[^/.]+$/, "");
      const outputName = `${baseName}_slowed_reverb_${Date.now()}.${ext}`;

      if (window.electronAPI) {
        // Desktop Powerhouse: native save 
        const arrBuffer = await finalBlob.arrayBuffer();
        await window.electronAPI.saveGeneration(outputName, arrBuffer);

        // Add to main library as generated
        await window.electronAPI.addToLibrary({
          id: outputName,
          type: "generated",
          name: outputName,
          timestamp: Date.now()
        });

        await loadLocalData();
      } else {
        // Fallback Web Browser save
        const url = URL.createObjectURL(finalBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = outputName;
        a.click();
        URL.revokeObjectURL(url);
      }

      setExportProgress(100);
      setExportDone(true);
    } catch (e) {
      console.error(e);
    }
    setIsExporting(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  };

  const handleYoutubeLoad = async () => {
    if (!youtubeUrl || !window.electronAPI) return;
    setIsProcessing(true);
    setLoadingText("Downloading from YouTube...");
    setAudioBuffer(null);
    setIsPlaying(false);
    setProgress(30);
    try {
      const data = await window.electronAPI.fetchYoutube(youtubeUrl);
      setProgress(70);
      setLoadingText("Decoding YouTube audio...");
      const f = new File([data.buffer], `${data.title}.mp3`, { type: "audio/mp3" });
      f.path = `youtube_${Date.now()}`; // pseudo path for library
      await loadFile(f);
      setYoutubeUrl(""); // Clear input on success
    } catch (e) {
      console.error(e);
      alert("Failed to load YouTube video. Check URL.");
      setIsProcessing(false);
    }
  };

  const handleLoadFolder = async () => {
    if (!window.electronAPI) return;
    try {
      const files = await window.electronAPI.selectFolder();
      if (!files || files.length === 0) return;

      let currentLib = [...library];
      files.forEach(item => {
        if (!currentLib.find(l => l.id === item.id)) {
          currentLib.unshift(item);
        }
      });

      // Send multiple adds or just manually update state if backend handles it
      files.forEach(async item => await window.electronAPI.addToLibrary(item));
      await loadLocalData();
      alert(`Imported ${files.length} valid media files!`);
    } catch (e) {
      console.error(e);
    }
  };

  const [draggedItemIndex, setDraggedItemIndex] = useState(null);

  const handleDragStart = (index) => {
    setDraggedItemIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault(); // allow drop
  };

  const handleDropSort = async (index) => {
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    const newLib = [...library];
    const item = newLib.splice(draggedItemIndex, 1)[0];
    newLib.splice(index, 0, item);

    setLibrary(newLib);
    setDraggedItemIndex(null);
    if (window.electronAPI) {
      await window.electronAPI.updateLibraryOrder(newLib);
    }

    // adjust currently playing index if needed
    if (currentPlaylistIndex === draggedItemIndex) {
      setCurrentPlaylistIndex(index);
    } else if (draggedItemIndex < currentPlaylistIndex && index >= currentPlaylistIndex) {
      setCurrentPlaylistIndex(currentPlaylistIndex - 1);
    } else if (draggedItemIndex > currentPlaylistIndex && index <= currentPlaylistIndex) {
      setCurrentPlaylistIndex(currentPlaylistIndex + 1);
    }
  };

  const applyPreset = (name, isMultiSelect) => {
    let newPresets = [...activePresets];

    if (!isMultiSelect) {
      newPresets = [name];
    } else {
      if (name === "Original" || name === "Custom") {
        newPresets = [name];
      } else {
        if (newPresets.includes("Original") || newPresets.includes("Custom")) newPresets = [];
        if (newPresets.includes(name)) {
          newPresets = newPresets.filter(n => n !== name);
          if (newPresets.length === 0) newPresets = ["Original"];
        } else {
          newPresets.push(name);
        }
      }
    }
    setActivePresets(newPresets);

    if (newPresets.includes("Custom")) return;

    // Mathematically average the selected presets
    const allPresets = { ...PRESETS, ...savedPresets };
    if (newPresets.length === 1) {
      if (allPresets[newPresets[0]]) setParams(allPresets[newPresets[0]]);
    } else {
      const combined = {};
      const keys = Object.keys(PRESETS["Original"]);
      for (let key of keys) {
        let sum = 0;
        newPresets.forEach(presetName => {
          sum += parseFloat(allPresets[presetName][key]) || 0;
        });
        combined[key] = parseFloat((sum / newPresets.length).toFixed(4));
      }
      setParams(combined);
    }
  };

  const handlePresetClick = (e, name) => {
    const isMultiSelect = e.ctrlKey || e.shiftKey || e.metaKey;
    applyPreset(name, isMultiSelect);
  };

  const handleSavePreset = async () => {
    if (!window.electronAPI) {
      alert("Saving presets is only available in the Desktop App.");
      return;
    }
    const name = prompt("Enter a name for your preset:");
    if (!name || name.trim() === "") return;
    const updated = await window.electronAPI.savePreset(name, params);
    setSavedPresets(updated);
    setActivePresets([name]);
  };

  const skipTime = (seconds) => {
    if (!audioBuffer) return;
    const currentSpeed = params.speed;
    const elapsed = isPlaying
      ? (audioCtxRef.current.currentTime - startTimeRef.current) * currentSpeed
      : pauseOffsetRef.current;

    let newElapsed = elapsed + seconds;
    newElapsed = Math.max(0, Math.min(newElapsed, audioBuffer.duration));

    pauseOffsetRef.current = newElapsed;
    if (isPlaying) {
      // Re-trigger playback which natively picks up params due to effect hooks
      stopPlayback();
      startPlayback();
    }
  };

  const stopAudio = () => {
    stopPlayback();
    pauseOffsetRef.current = 0;
  };

  const handleSeek = (newTime) => {
    pauseOffsetRef.current = newTime;
    if (isPlaying) {
      stopPlayback();
      startPlayback();
    }
  }

  const handleDeleteHistory = async (name) => {
    if (window.electronAPI) {
      await window.electronAPI.deleteGeneration(name);
      await loadLocalData();
    }
  }

  const handleOpenFolder = (name) => {
    if (window.electronAPI) {
      window.electronAPI.openGeneration(name);
    }
  }

  const colors = {
    bg: isDark ? "#080810" : "#f8fafc",
    text: isDark ? "#e2e8f0" : "#1e293b",
    textMuted: isDark ? "#6b7280" : "#64748b",
    cardBg: isDark ? "rgba(10,10,25,0.7)" : "rgba(255,255,255,0.85)",
    cardBorder: isDark ? "rgba(100,100,150,0.2)" : "rgba(167,139,250,0.3)",
    dropBg: dragging ? (isDark ? "rgba(167,139,250,0.05)" : "rgba(167,139,250,0.15)") : (isDark ? "rgba(10,10,25,0.6)" : "rgba(255,255,255,0.7)"),
    gradient1: isDark ? "rgba(76,29,149,0.15)" : "rgba(167,139,250,0.15)",
    gradient2: isDark ? "rgba(49,46,129,0.1)" : "rgba(99,102,241,0.1)",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: colors.bg,
      backgroundImage: `radial-gradient(ellipse at 20% 50%, ${colors.gradient1} 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, ${colors.gradient2} 0%, transparent 50%)`,
      fontFamily: "'Space Mono', monospace",
      color: colors.text,
      padding: "32px 24px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      transition: "background 0.3s ease, color 0.3s ease"
    }}>
      {/* Header */}
      <div style={{ position: "relative", width: "100%", maxWidth: 680, textAlign: "center", marginBottom: 36 }}>
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          style={{ position: "absolute", right: 0, top: 0, background: "transparent", border: "1px solid " + colors.cardBorder, color: colors.text, padding: "6px 12px", borderRadius: 20, cursor: "pointer", fontFamily: "'Space Mono', monospace", fontSize: 11 }}
        >
          {isDark ? "☀️ Light Mode" : "🌙 Dark Mode"}
        </button>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 8 }}>
          <img src="/logo.png" alt="Sloverb Studio Logo" style={{ width: 48, height: 48, filter: "drop-shadow(0 0 8px rgba(167,139,250,0.6))", cursor: "pointer" }} onClick={() => window.location.reload()} />
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: "-0.02em", background: "linear-gradient(135deg, #a78bfa, #c4b5fd, #f472b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", cursor: "pointer" }} onClick={() => window.location.reload()}>
            SLOVERB STUDIO
          </h1>
        </div>
        <p style={{ color: colors.textMuted, fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", margin: 0 }}>
          Audio processing · Slowed · Reverb · Bass
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 24 }}>
          <button onClick={() => setCurrentTab("studio")} style={{ background: currentTab === "studio" ? "rgba(167,139,250,0.15)" : "transparent", color: currentTab === "studio" ? "#a78bfa" : colors.textMuted, border: `1px solid ${currentTab === "studio" ? "#a78bfa" : colors.cardBorder}`, padding: "8px 24px", borderRadius: 20, cursor: "pointer", fontFamily: "'Space Mono', monospace", fontSize: 12, transition: "all 0.2s" }}>
            Studio Editor
          </button>
          <button onClick={() => setCurrentTab("library")} style={{ background: currentTab === "library" ? "rgba(167,139,250,0.15)" : "transparent", color: currentTab === "library" ? "#a78bfa" : colors.textMuted, border: `1px solid ${currentTab === "library" ? "#a78bfa" : colors.cardBorder}`, padding: "8px 24px", borderRadius: 20, cursor: "pointer", fontFamily: "'Space Mono', monospace", fontSize: 12, transition: "all 0.2s" }}>
            Library & Playlists
          </button>
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 680, display: currentTab === "studio" ? "block" : "none" }}>

        {/* Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => document.getElementById("fileInput").click()}
          style={{
            border: `2px dashed ${dragging ? "#a78bfa" : audioBuffer ? colors.cardBorder : colors.dropBorder}`,
            borderRadius: 16,
            padding: audioBuffer ? "20px 24px" : "40px 24px",
            textAlign: "center",
            cursor: "pointer",
            background: colors.dropBg,
            transition: "all 0.2s ease",
            marginBottom: 20,
            backdropFilter: "blur(8px)",
          }}
        >
          <input id="fileInput" type="file" accept="audio/*,video/*" style={{ display: "none" }} onChange={(e) => loadFile(e.target.files[0])} />

          {!audioBuffer ? (
            <>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🎵</div>
              <p style={{ color: "#a78bfa", fontSize: 14, fontFamily: "'Syne', sans-serif", fontWeight: 700, margin: "0 0 4px" }}>
                {isProcessing ? loadingText : "Drop your audio or video here"}
              </p>
              <p style={{ color: "#4b5563", fontSize: 11, margin: 0 }}>MP3 · WAV · FLAC · M4A · OGG · MP4</p>
              {isProcessing && (
                <div style={{ marginTop: 16, background: "rgba(167,139,250,0.1)", borderRadius: 4, height: 3, overflow: "hidden" }}>
                  <div style={{ background: "#a78bfa", height: "100%", width: `${progress}%`, transition: "width 0.3s ease" }} />
                </div>
              )}

              {!isProcessing && window.electronAPI && (
                <div style={{ marginTop: 24, padding: "16px", background: "rgba(167,139,250,0.05)", borderRadius: 12, border: "1px dashed rgba(167,139,250,0.3)" }} onClick={e => e.stopPropagation()}>
                  <p style={{ margin: "0 0 8px 0", fontSize: 11, color: colors.textMuted, letterSpacing: "0.05em", textTransform: "uppercase" }}>Or Grab from YouTube</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      value={youtubeUrl}
                      onChange={e => setYoutubeUrl(e.target.value)}
                      placeholder="Paste YouTube link here..."
                      style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid " + colors.cardBorder, background: isDark ? "rgba(0,0,0,0.4)" : "#fff", color: colors.text, fontSize: 13 }}
                    />
                    <button onClick={handleYoutubeLoad} disabled={!youtubeUrl} style={{ background: youtubeUrl ? "linear-gradient(135deg, #7c3aed, #a855f7)" : "rgba(100,100,150,0.2)", color: youtubeUrl ? "#fff" : "#4b5563", border: "none", padding: "0 20px", borderRadius: 8, cursor: youtubeUrl ? "pointer" : "not-allowed", fontWeight: "bold", fontSize: 13 }}>
                      Load
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🎵</div>
                <div style={{ textAlign: "left" }}>
                  <p style={{ margin: 0, fontSize: 12, fontFamily: "'Syne', sans-serif", fontWeight: 700, color: colors.text, maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName}</p>
                  <p style={{ margin: 0, fontSize: 10, color: colors.textMuted }}>{(audioBuffer.duration / params.speed).toFixed(1)}s at {params.speed}x · {audioBuffer.numberOfChannels}ch</p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={async (e) => {
                  e.stopPropagation();
                  if (window.electronAPI) {
                    const newId = `imported_${Date.now()}`;
                    const realPath = file && file.path ? file.path : `In-Memory-${Date.now()}`;
                    const newItem = { id: newId, name: fileName, path: realPath, type: isVideo ? 'video' : 'raw', timestamp: Date.now() };
                    setLibrary([newItem, ...library]);
                    await window.electronAPI.addToLibrary(newItem);
                    alert("Added to Library!");
                  } else {
                    alert("Library requires desktop app.");
                  }
                }} style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.4)", color: "#a78bfa", padding: "6px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: "bold" }}>+ Add to Library</button>
                <button onClick={(e) => {
                  e.stopPropagation();
                  setAudioBuffer(null);
                  setFileName("");
                  setFile(null);
                  setIsPlaying(false);
                  setOriginalVideoFile(null);
                  playNextInQueue();
                }} style={{ background: "transparent", border: "1px solid rgba(244,114,182,0.4)", color: "#f472b6", padding: "6px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>Remove</button>
              </div>
            </div>
          )}
        </div>

        {/* Studio Queue */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: colors.text, fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>Next Up <span style={{ color: colors.textMuted, fontSize: 14, fontWeight: "normal" }}>({studioQueue.length})</span></h3>
          {(studioQueue.length > 0) && (
            <button onClick={() => {
              setStudioQueue([]);
            }} style={{ background: "rgba(244,114,182,0.1)", border: "1px solid rgba(244,114,182,0.3)", color: "#f472b6", padding: "6px 14px", borderRadius: 20, fontSize: 11, cursor: "pointer", fontWeight: "bold", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(244,114,182,0.2)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(244,114,182,0.1)"}>Clear Queue</button>
          )}
        </div>

        {studioQueue.length > 0 && (
          <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginBottom: 24, paddingRight: 8, scrollbarWidth: "thin", scrollbarColor: `${colors.cardBorder} transparent` }}>
            {studioQueue.map((item, index) => {
              const hue = (index * 40) % 360;
              return (
                <div key={`${item.name}_${index}`} className="queue-item" draggable onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", index.toString());
                  e.currentTarget.style.opacity = '0.5';
                }} onDragEnd={(e) => e.currentTarget.style.opacity = '1'} onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderTop = `2px solid #a78bfa`; }} onDragLeave={(e) => { e.currentTarget.style.borderTop = "1px solid transparent"; }} onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderTop = "1px solid transparent";
                  const fromIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
                  const toIdx = index;
                  if (fromIdx !== toIdx && !isNaN(fromIdx)) {
                    const newQueue = [...studioQueue];
                    const [moved] = newQueue.splice(fromIdx, 1);
                    newQueue.splice(toIdx, 0, moved);
                    setStudioQueue(newQueue);
                  }
                }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(10,10,25,0.6)", padding: "10px 16px", borderRadius: 12, border: "1px solid transparent", cursor: "grab", backdropFilter: "blur(8px)", transition: "background 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(167,139,250,0.1)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(10,10,25,0.6)"}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <span style={{ fontSize: 14, color: colors.textMuted, opacity: 0.5 }}>≡</span>
                    <div style={{ width: 32, height: 32, borderRadius: 6, background: `linear-gradient(135deg, hsl(${hue}, 60%, 50%), hsl(${(hue + 40) % 360}, 60%, 30%))` }}></div>
                    <p style={{ margin: 0, fontSize: 13, color: colors.text, fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300 }}>{item.name}</p>
                  </div>
                  <button onClick={() => {
                    const nq = [...studioQueue];
                    nq.splice(index, 1);
                    setStudioQueue(nq);
                  }} style={{ background: "transparent", border: "none", color: colors.textMuted, cursor: "pointer", fontSize: 18, transition: "color 0.2s" }} onMouseEnter={e => e.currentTarget.style.color = "#f472b6"} onMouseLeave={e => e.currentTarget.style.color = colors.textMuted}>×</button>
                </div>
              )
            })}

            {/* Quick Append Dropzone */}
            <div
              className="queue-dropzone"
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) {
                  setStudioQueue(q => [...q, { type: 'file', file: f, name: f.name }]);
                  alert(`Added "${f.name}" to the Studio Queue`);
                }
              }}
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.background = "rgba(167,139,250,0.15)"; }}
              onDragLeave={(e) => { e.currentTarget.style.background = "rgba(167,139,250,0.05)"; }}
              onClick={() => document.getElementById("queueFileInput").click()}
              style={{
                border: `1px dashed ${colors.cardBorder}`, borderRadius: 12, padding: "16px",
                textAlign: "center", cursor: "pointer", background: "rgba(167,139,250,0.05)",
                color: "#a78bfa", fontSize: 12, fontWeight: "bold", transition: "all 0.2s"
              }}
            >
              <input id="queueFileInput" type="file" accept="audio/*,video/*" style={{ display: "none" }} onChange={(e) => {
                const f = e.target.files[0];
                if (f) {
                  setStudioQueue(q => [...q, { type: 'file', file: f, name: f.name }]);
                  alert(`Added "${f.name}" to the Studio Queue`);
                }
              }} />
              + Drop or Click to Append Track
            </div>
          </div>
        )}

        {/* Waveform & Seeker & Playback Controls */}
        {audioBuffer && (
          <div style={{ marginBottom: 20 }}>
            <WaveformViz analyser={analyserRef.current} isPlaying={isPlaying} />
            <Seeker
              audioCtxRef={audioCtxRef}
              startTimeRef={startTimeRef}
              pauseOffsetRef={pauseOffsetRef}
              isPlaying={isPlaying}
              speed={params.speed}
              duration={audioBuffer.duration}
              onSeek={handleSeek}
            />

            <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
              <button onClick={() => skipTime(-15)} style={{ background: "rgba(100,100,150,0.1)", border: "1px solid " + colors.cardBorder, color: colors.text, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>-15s</button>
              <button onClick={() => skipTime(-5)} style={{ background: "rgba(100,100,150,0.1)", border: "1px solid " + colors.cardBorder, color: colors.text, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>-5s</button>
              <button onClick={togglePlay} style={{ background: isPlaying ? "rgba(167,139,250,0.2)" : "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.4)", color: "#a78bfa", padding: "8px 24px", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: "bold" }}>
                {isPlaying ? "⏸ Pause" : "▶ Play"}
              </button>
              <button onClick={stopAudio} style={{ background: "rgba(244,114,182,0.1)", border: "1px solid rgba(244,114,182,0.4)", color: "#f472b6", padding: "8px 24px", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: "bold" }}>
                ⏹ Stop
              </button>
              <button onClick={() => skipTime(5)} style={{ background: "rgba(100,100,150,0.1)", border: "1px solid " + colors.cardBorder, color: colors.text, padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>+5s</button>
              <div style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(0,0,0,0.3)", padding: "4px 12px", borderRadius: 8, border: "1px solid " + colors.cardBorder }}>
                <span style={{ fontSize: 12 }}>🔈</span>
                <input type="range" min="0" max="1" step="0.01" value={masterVolume} onChange={e => setMasterVolume(parseFloat(e.target.value))} style={{ width: 80, cursor: "pointer" }} />
              </div>
            </div>
          </div>
        )}

        {/* Presets */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ color: "#4b5563", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 10, margin: "0 0 10px" }}>Presets</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {Object.keys({ ...PRESETS, ...savedPresets }).map(name => {
              const isActive = activePresets.includes(name);
              return (
                <button
                  key={name}
                  onClick={(e) => handlePresetClick(e, name)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    border: `1px solid ${isActive ? "#a78bfa" : colors.cardBorder}`,
                    background: isActive ? "rgba(167,139,250,0.15)" : "transparent",
                    color: isActive ? "#a78bfa" : colors.textMuted,
                    fontSize: 11,
                    fontFamily: "'Space Mono', monospace",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    letterSpacing: "0.05em",
                  }}
                >{name}</button>
              );
            })}
            <button
              onClick={handleSavePreset}
              style={{ padding: "6px 14px", borderRadius: 20, border: "1px dashed " + colors.cardBorder, background: "transparent", color: colors.textMuted, cursor: "pointer", fontSize: 11, fontFamily: "'Space Mono', monospace" }}
            >
              + Save Preset
            </button>
            {activePresets.includes("Custom") && (
              <span style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid rgba(244,114,182,0.4)", background: "rgba(244,114,182,0.08)", color: "#f472b6", fontSize: 11, letterSpacing: "0.05em" }}>Custom</span>
            )}
          </div>
        </div>

        {/* Knob Controls */}
        <div style={{ background: colors.cardBg, border: "1px solid " + colors.cardBorder, borderRadius: 16, padding: "28px 24px", marginBottom: 20, backdropFilter: "blur(8px)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))", gap: 24, justifyItems: "center" }}>
            <Knob label="Speed" value={params.speed} min={0.4} max={1.0} step={0.01} onChange={v => setParam("speed", v)} unit="x" color="#a78bfa" isDark={isDark} />
            <Knob label="Reverb Mix" value={params.reverbMix} min={0} max={1} step={0.01} onChange={v => setParam("reverbMix", v)} unit="" color="#818cf8" isDark={isDark} />
            <Knob label="Rev Decay" value={params.reverbDecay} min={1} max={10} step={0.1} onChange={v => setParam("reverbDecay", v)} unit="" color="#6366f1" isDark={isDark} />
            <Knob label="Rev Size" value={params.reverbSize} min={0.5} max={8} step={0.1} onChange={v => setParam("reverbSize", v)} unit="s" color="#7c3aed" isDark={isDark} />
            <Knob label="Bass Boost" value={params.bassBoost} min={0} max={18} step={0.5} onChange={v => setParam("bassBoost", v)} unit="dB" color="#ec4899" isDark={isDark} />
            <Knob label="Warmth" value={params.warmth} min={0} max={12} step={0.5} onChange={v => setParam("warmth", v)} unit="" color="#f472b6" isDark={isDark} />
          </div>
        </div>

        {/* Sliders for fine control */}
        <div style={{ background: colors.cardBg, border: "1px solid " + colors.cardBorder, borderRadius: 16, padding: "20px 24px", marginBottom: 20, backdropFilter: "blur(8px)" }}>
          <p style={{ color: colors.textMuted, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 16, margin: "0 0 16px" }}>Fine Controls</p>
          {[
            { key: "speed", label: "Playback Speed", min: 0.4, max: 1.0, step: 0.01, unit: "x", color: "#a78bfa" },
            { key: "reverbMix", label: "Reverb Mix (Wet)", min: 0, max: 1, step: 0.01, unit: "%", mult: 100, color: "#818cf8" },
            { key: "preDelay", label: "Pre-Delay", min: 0, max: 0.2, step: 0.01, unit: " s", color: "#6366f1" },
            { key: "stereoWidth", label: "Stereo Width", min: 0, max: 1, step: 0.01, unit: "%", mult: 100, color: "#4f46e5" },
            { key: "bassBoost", label: "Bass Boost", min: 0, max: 18, step: 0.5, unit: " dB", color: "#ec4899" },
            { key: "warmth", label: "Warmth / HF Roll-off", min: 0, max: 12, step: 0.5, unit: " dB", color: "#f472b6" },
            { key: "vinyl", label: "Vinyl Crackle", min: 0, max: 1, step: 0.01, unit: "%", mult: 100, color: "#e879f9" },
          ].map(({ key, label, min, max, step, unit, mult = 1, color }) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: colors.textMuted, fontSize: 11 }}>{label}</span>
                <span style={{ color, fontSize: 11, fontWeight: 700 }}>{(params[key] * mult).toFixed(mult > 1 ? 0 : step < 0.1 ? 2 : 1)}{unit}</span>
              </div>
              <div style={{ position: "relative", height: 4, background: colors.cardBorder, borderRadius: 4 }}>
                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${((params[key] - min) / (max - min)) * 100}%`, background: `linear-gradient(90deg, ${color}80, ${color})`, borderRadius: 4, transition: "width 0.05s" }} />
                <input type="range" min={min} max={max} step={step} value={params[key]}
                  onChange={e => setParam(key, parseFloat(e.target.value))}
                  style={{ position: "absolute", inset: 0, width: "100%", opacity: 0, cursor: "pointer", height: "100%" }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Fine Controls removed playbacks spacing from here */}

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={handleExport}
            disabled={!audioBuffer || isExporting}
            style={{
              flex: 1, minWidth: 200, maxWidth: 400,
              padding: "16px 24px",
              borderRadius: 12,
              border: "none",
              background: !audioBuffer || isExporting ? "rgba(100,100,150,0.2)" : "linear-gradient(135deg, #7c3aed, #a855f7)",
              color: !audioBuffer || isExporting ? "#4b5563" : "#fff",
              fontSize: 15,
              fontFamily: "'Space Mono', monospace",
              cursor: !audioBuffer || isExporting ? "not-allowed" : "pointer",
              letterSpacing: "0.05em",
              fontWeight: 700,
              transition: "all 0.2s ease",
              position: "relative",
              overflow: "hidden",
              boxShadow: audioBuffer && !isExporting ? "0 4px 24px rgba(124,58,237,0.4)" : "none",
            }}
          >
            {isExporting ? (
              <span>
                {isVideo ? "Rendering Video" : "Rendering Audio"}... {exportProgress}%
                <div style={{ position: "absolute", bottom: 0, left: 0, height: 3, background: "rgba(255,255,255,0.4)", width: `${exportProgress}%`, transition: "width 0.2s ease" }} />
              </span>
            ) : exportDone ? "✓ Downloaded!" : (isVideo ? "⬇ Export MP4 Video" : "⬇ Export WAV Audio")}
          </button>
        </div>

        {/* Info */}
        <div style={{ marginTop: 20, padding: "14px 18px", borderRadius: 10, background: colors.dropBg, border: "1px solid " + colors.cardBorder }}>
          <p style={{ color: colors.textMuted, fontSize: 10, margin: 0, lineHeight: 1.8, letterSpacing: "0.05em" }}>
            ◈ All processing runs locally — no uploads to any server<br />
            ◈ Export renders in full quality (44.1kHz 16-bit stereo WAV)<br />
            ◈ Drag knobs up/down or use sliders for precise control<br />
            ◈ Preview plays in real-time with the current settings
          </p>
        </div>

        {/* History Tab */}
        {window.electronAPI && history.length > 0 && (
          <div style={{ marginTop: 24, background: colors.cardBg, border: "1px solid " + colors.cardBorder, borderRadius: 16, padding: "20px 24px", backdropFilter: "blur(8px)" }}>
            <p style={{ color: "#a78bfa", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 16, margin: "0 0 16px", fontWeight: 700 }}>Recent Generations</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {history.map(item => (
                <div key={item.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(100,100,150,0.05)", padding: "10px 16px", borderRadius: 8, border: "1px solid " + colors.cardBorder }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 18 }}>💿</span>
                    <div>
                      <p style={{ margin: 0, fontSize: 12, color: colors.text, fontWeight: "bold" }}>{item.name}</p>
                      <p style={{ margin: 0, fontSize: 10, color: colors.textMuted }}>{new Date(item.mtime).toLocaleString()}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => handleOpenFolder(item.name)} style={{ background: "transparent", border: "1px solid " + colors.cardBorder, color: colors.textMuted, padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>Locate</button>
                    <button onClick={() => handleDeleteHistory(item.name)} style={{ background: "rgba(244,114,182,0.1)", border: "1px solid rgba(244,114,182,0.4)", color: "#f472b6", padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer" }}>Delete</button>
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "rgba(100,100,150,0.05)", borderRadius: 8, border: "1px solid " + colors.cardBorder }}>
                <div>
                  <span style={{ color: colors.text, fontSize: 13, fontWeight: "bold", display: "block" }}>Tone / Pitch Engine</span>
                  <span style={{ color: colors.textMuted, fontSize: 11 }}>If enabled, slowing the track will preserve the original vocal pitch instead of deepening it.</span>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={params.preservePitch || false}
                    onChange={(e) => {
                      setParam("preservePitch", e.target.checked);
                      if (isPlaying) { stopPlayback(); startPlayback(); }
                    }}
                    style={{ width: 18, height: 18, accentColor: "#a78bfa", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: 12, color: (params.preservePitch || false) ? "#a78bfa" : colors.textMuted, fontWeight: "bold" }}>
                    {(params.preservePitch || false) ? "Original Pitch" : "Slowed Tone (Default)"}
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Library View */}
      <div style={{ width: "100%", maxWidth: 680, display: currentTab === "library" ? "block" : "none" }}>
        <div style={{ background: colors.cardBg, border: "1px solid " + colors.cardBorder, borderRadius: 16, padding: "28px 24px", backdropFilter: "blur(8px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 16 }}>
              <h2 onClick={() => setActiveLibraryTab("songs")} style={{ fontSize: 18, margin: 0, color: activeLibraryTab === "songs" ? "#a78bfa" : colors.textMuted, cursor: "pointer", transition: "color 0.2s" }}>All Songs</h2>
              <h2 onClick={() => setActiveLibraryTab("playlists")} style={{ fontSize: 18, margin: 0, color: activeLibraryTab === "playlists" ? "#a78bfa" : colors.textMuted, cursor: "pointer", transition: "color 0.2s" }}>Playlists</h2>
            </div>
            {window.electronAPI && activeLibraryTab === "songs" && library.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ background: "rgba(0,0,0,0.3)", color: colors.text, border: "1px solid " + colors.cardBorder, borderRadius: 6, padding: "6px 8px", fontSize: 11 }}>
                  <option value="dateDesc">Date (Newest)</option>
                  <option value="dateAsc">Date (Oldest)</option>
                  <option value="titleAsc">Title (A-Z)</option>
                  <option value="titleDesc">Title (Z-A)</option>
                  <option value="artistAsc">Artist (A-Z)</option>
                  <option value="albumAsc">Album (A-Z)</option>
                  <option value="random">Randomize</option>
                </select>
                <button onClick={() => { if (library.length > 0) playFromLibrary(0) }} disabled={library.length === 0} style={{ background: library.length > 0 ? "rgba(167,139,250,0.15)" : "transparent", color: library.length > 0 ? "#a78bfa" : colors.textMuted, border: `1px solid ${library.length > 0 ? "#a78bfa" : colors.cardBorder}`, padding: "6px 12px", borderRadius: 8, fontSize: 11, cursor: library.length > 0 ? "pointer" : "not-allowed", fontWeight: "bold" }}>
                  ▶ Play All
                </button>
                <button onClick={() => {
                  if (window.confirm("Are you sure you want to clear your entire library?")) {
                    setLibrary([]);
                    window.electronAPI.saveLibrary({ songs: [], playlists, queue: studioQueue });
                    setCurrentPlaylistIndex(-1);
                  }
                }} disabled={library.length === 0} style={{ background: "transparent", color: library.length > 0 ? "#f472b6" : colors.textMuted, border: `1px solid ${library.length > 0 ? "rgba(244,114,182,0.4)" : colors.cardBorder}`, padding: "6px 12px", borderRadius: 8, fontSize: 11, cursor: library.length > 0 ? "pointer" : "not-allowed", fontWeight: "bold" }}>
                  Clear All
                </button>
              </div>
            )}
          </div>

          {activeLibraryTab === "songs" && (
            library.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>🎵</div>
                <p style={{ color: colors.text, fontSize: 16, fontWeight: "bold", margin: "0 0 8px 0" }}>Your Library is Empty</p>
                <p style={{ color: colors.textMuted, fontSize: 13, margin: "0 0 24px 0" }}>Add tracks from the Studio or Import a Folder to get started.</p>
                {window.electronAPI && (
                  <button onClick={handleLoadFolder} style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.4)", color: "#a78bfa", padding: "10px 20px", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: "bold", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(167,139,250,0.2)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(167,139,250,0.1)"}>
                    + Import Folder
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {sortedLibrary.map((item) => {
                  const originalIndex = library.findIndex(l => l.id === item.id);
                  // Generate a pseudo-random gradient based on item.id to act as "Album Art"
                  const idHash = item.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
                  const hue1 = idHash % 360;
                  const hue2 = (hue1 + 40) % 360;

                  return (
                    <div
                      key={item.id}
                      className="library-item"
                      draggable={sortBy === "dateDesc" || sortBy === "dateAsc"}
                      onDragStart={() => handleDragStart(originalIndex)}
                      onDragOver={(e) => handleDragOver(e, originalIndex)}
                      onDrop={() => handleDropSort(originalIndex)}
                      style={{
                        position: "relative",
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        background: draggedItemIndex === originalIndex ? "rgba(167,139,250,0.1)" : "rgba(10,10,20,0.4)",
                        padding: "8px 16px", borderRadius: 12, border: "1px solid transparent",
                        cursor: (sortBy === "dateDesc" || sortBy === "dateAsc") ? "grab" : "default", opacity: draggedItemIndex === originalIndex ? 0.5 : 1, transition: "all 0.2s ease"
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(167,139,250,0.2)"; e.currentTarget.querySelector('.lib-actions').style.opacity = '1'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(10,10,20,0.4)"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.querySelector('.lib-actions').style.opacity = '0'; }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        {/* Album Art Placeholder */}
                        <div style={{ width: 44, height: 44, borderRadius: 8, background: `linear-gradient(135deg, hsl(${hue1}, 70%, 60%), hsl(${hue2}, 70%, 40%))`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
                          {item.type === "raw" ? "🎵" : item.type === "video" ? "🎥" : "💿"}
                        </div>
                        <div style={{ pointerEvents: "none" }}>
                          <p style={{ margin: 0, fontSize: 14, color: playbackContext.type === 'library' && currentPlaylistIndex === originalIndex ? "#a78bfa" : colors.text, fontWeight: "bold", letterSpacing: "0.02em" }}>{item.name}</p>
                          <p style={{ margin: 0, fontSize: 11, color: colors.textMuted, marginTop: 4 }}>{item.artist || 'Unknown Artist'} • {new Date(item.timestamp).toLocaleDateString()}</p>
                        </div>
                      </div>
                      
                      {/* Hover Actions */}
                      <div className="lib-actions" style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", opacity: 0, transition: "opacity 0.2s ease" }}>
                        <button onClick={() => playFromLibrary(originalIndex)} style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.4)", color: "#a78bfa", padding: "6px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer", fontWeight: "bold", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(167,139,250,0.2)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(167,139,250,0.1)"}>▶ Play</button>
                        <button onClick={() => {
                          setStudioQueue(q => [...q, { type: 'library', libraryItem: item, name: item.name }]);
                          alert(`Added "${item.name}" to the Studio Queue`);
                        }} style={{ background: "rgba(100,100,150,0.1)", border: "1px solid " + colors.cardBorder, color: colors.textMuted, padding: "6px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(100,100,150,0.2)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(100,100,150,0.1)"}>+ Queue</button>
                        <select onChange={async (e) => {
                          const pid = e.target.value;
                          if (pid && window.electronAPI) {
                            const newPlaylists = playlists.map(p => {
                              if (p.id === pid && !p.itemIds.includes(item.id)) return { ...p, itemIds: [...p.itemIds, item.id] };
                              return p;
                            });
                            setPlaylists(newPlaylists);
                            await window.electronAPI.saveLibrary({ songs: library, playlists: newPlaylists });
                            e.target.value = "";
                          }
                        }} style={{ background: "transparent", color: colors.textMuted, border: "1px solid " + colors.cardBorder, borderRadius: 20, padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>
                          <option value="">+ Playlist</option>
                          {playlists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        {window.electronAPI && (
                          <button onClick={() => window.electronAPI.locateFile(item.path || item.id)} style={{ background: "transparent", border: "1px solid " + colors.cardBorder, color: colors.textMuted, padding: "6px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer" }}>Locate</button>
                        )}
                        <button onClick={async () => {
                          if (window.electronAPI) {
                            await window.electronAPI.removeFromLibrary(item.id);
                            await loadLocalData();
                          }
                        }} style={{ background: "transparent", border: "1px solid rgba(244,114,182,0.4)", color: "#f472b6", padding: "6px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer" }}>Remove</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          )}

          {activeLibraryTab === "playlists" && (
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <button onClick={async () => {
                  const name = window.prompt("Playlist Name:");
                  if (name && window.electronAPI) {
                    const newPlaylist = { id: `pl_${Date.now()}`, name, itemIds: [] };
                    const newPlaylists = [...playlists, newPlaylist];
                    setPlaylists(newPlaylists);
                    await window.electronAPI.saveLibrary({ songs: library, playlists: newPlaylists });
                  }
                }} style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.4)", color: "#a78bfa", padding: "8px 16px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: "bold" }}>
                  + Create Playlist
                </button>
                {activePlaylistId && (
                  <button onClick={() => setActivePlaylistId(null)} style={{ background: "transparent", border: "1px solid " + colors.cardBorder, color: colors.textMuted, padding: "8px 16px", borderRadius: 8, fontSize: 12, cursor: "pointer" }}>
                    ← Back to Playlists
                  </button>
                )}
              </div>

              {!activePlaylistId ? (
                playlists.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "60px 20px" }}>
                    <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>💽</div>
                    <p style={{ color: colors.text, fontSize: 16, fontWeight: "bold", margin: "0 0 8px 0" }}>No Playlists Yet</p>
                    <p style={{ color: colors.textMuted, fontSize: 13, margin: 0 }}>Create your first playlist and start organizing your favorite slowed tracks.</p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 20 }}>
                    {playlists.map(pl => {
                      const idHash = pl.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
                      const h1 = (idHash * 13) % 360;
                      const h2 = (h1 + 60) % 360;
                      return (
                        <div key={pl.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          <div
                            onClick={() => setActivePlaylistId(pl.id)}
                            className="playlist-card"
                            style={{
                              aspectRatio: "1 / 1",
                              borderRadius: 12,
                              background: `linear-gradient(135deg, hsl(${h1}, 70%, 50%), hsl(${h2}, 70%, 20%))`,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              position: "relative", cursor: "pointer",
                              boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
                              overflow: "hidden", transition: "transform 0.2s ease, box-shadow 0.2s ease"
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(167,139,250,0.4)"; e.currentTarget.querySelector('.pl-overlay').style.opacity = '1'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)"; e.currentTarget.querySelector('.pl-overlay').style.opacity = '0'; }}
                          >
                            <span style={{ fontSize: 40, filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))" }}>💽</span>
                            <div className="pl-overlay" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.2s ease" }}>
                              <span style={{ color: "#fff", fontWeight: "bold", fontSize: 14, letterSpacing: "0.05em" }}>View Playlist</span>
                            </div>
                          </div>
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                              <p style={{ margin: 0, fontSize: 14, color: colors.text, fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{pl.name}</p>
                              <button onClick={async (e) => {
                                e.stopPropagation();
                                if (window.confirm("Delete this playlist?") && window.electronAPI) {
                                  const updated = playlists.filter(p => p.id !== pl.id);
                                  setPlaylists(updated);
                                  if (playbackContext.playlistId === pl.id) {
                                    setPlaybackContext({ type: 'library', playlistId: null });
                                  }
                                  await window.electronAPI.saveLibrary({ songs: library, playlists: updated });
                                }
                              }} style={{ background: "transparent", border: "none", color: colors.textMuted, fontSize: 14, cursor: "pointer", padding: "0 4px" }} title="Delete Playlist">×</button>
                            </div>
                            <p style={{ margin: 0, fontSize: 12, color: colors.textMuted }}>{pl.itemIds.length} tracks</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              ) : (
                (() => {
                  const pl = playlists.find(p => p.id === activePlaylistId);
                  if (!pl) return null;
                  const plSongs = pl.itemIds.map(id => library.find(s => s.id === id)).filter(Boolean);
                  
                  const idHash = pl.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
                  const h1 = (idHash * 13) % 360;
                  const h2 = (h1 + 60) % 360;

                  return (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 32, background: `linear-gradient(135deg, rgba(10,10,25,0.8), rgba(10,10,25,0.95)), linear-gradient(135deg, hsl(${h1}, 70%, 50%), hsl(${h2}, 70%, 20%))`, padding: 24, borderRadius: 16, border: "1px solid rgba(255,255,255,0.1)" }}>
                        <div style={{ width: 120, height: 120, borderRadius: 12, background: `linear-gradient(135deg, hsl(${h1}, 70%, 50%), hsl(${h2}, 70%, 20%))`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 48, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", flexShrink: 0 }}>💽</div>
                        <div style={{ flex: 1 }}>
                          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.2em", margin: "0 0 8px 0" }}>Playlist</p>
                          <h3 style={{ margin: "0 0 12px 0", color: "#fff", fontSize: 32, fontFamily: "'Syne', sans-serif" }}>{pl.name}</h3>
                          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, margin: "0 0 16px 0" }}>{plSongs.length} tracks • Created via Sloverb Studio</p>
                          <button onClick={() => { if (plSongs.length > 0) playFromPlaylist(0, pl.id) }} disabled={plSongs.length === 0} style={{ background: plSongs.length > 0 ? "linear-gradient(135deg, #7c3aed, #a855f7)" : "rgba(100,100,150,0.3)", color: plSongs.length > 0 ? "#fff" : "rgba(255,255,255,0.5)", border: "none", padding: "10px 24px", borderRadius: 24, fontSize: 13, cursor: plSongs.length > 0 ? "pointer" : "not-allowed", fontWeight: "bold", transition: "transform 0.2s" }} onMouseEnter={e => { if (plSongs.length > 0) e.currentTarget.style.transform = "scale(1.05)" }} onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
                            ▶ Play Playlist
                          </button>
                        </div>
                      </div>
                      
                      {plSongs.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "40px 20px" }}>
                          <p style={{ color: colors.textMuted, fontSize: 14 }}>This playlist is empty. Add songs from your Library.</p>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {plSongs.map((item, localIdx) => {
                            const songHash = item.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
                            const sh1 = songHash % 360;
                            const sh2 = (sh1 + 40) % 360;
                            return (
                              <div
                                key={`${item.id}_${localIdx}`}
                                className="playlist-item"
                                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(10,10,20,0.4)", padding: "8px 16px", borderRadius: 12, border: "1px solid transparent", transition: "all 0.2s ease" }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(167,139,250,0.2)"; e.currentTarget.querySelector('.pl-actions').style.opacity = '1'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(10,10,20,0.4)"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.querySelector('.pl-actions').style.opacity = '0'; }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                  <div style={{ color: colors.textMuted, fontSize: 12, width: 20, textAlign: "right", fontFamily: "Space Mono" }}>{localIdx + 1}</div>
                                  <div style={{ width: 36, height: 36, borderRadius: 6, background: `linear-gradient(135deg, hsl(${sh1}, 70%, 60%), hsl(${sh2}, 70%, 40%))` }}></div>
                                  <div>
                                    <p style={{ margin: 0, fontSize: 14, color: playbackContext.playlistId === pl.id && currentPlaylistIndex === localIdx ? "#a78bfa" : colors.text, fontWeight: "bold" }}>{item.name}</p>
                                    <p style={{ margin: 0, fontSize: 11, color: colors.textMuted, marginTop: 4 }}>{item.artist || 'Unknown Artist'}</p>
                                  </div>
                                </div>
                                <div className="pl-actions" style={{ display: "flex", gap: 6, opacity: 0, transition: "opacity 0.2s ease" }}>
                                  <button onClick={() => playFromPlaylist(localIdx, pl.id)} style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.4)", color: "#a78bfa", padding: "6px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer", fontWeight: "bold", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(167,139,250,0.2)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(167,139,250,0.1)"}>▶ Play</button>
                                  <button onClick={() => {
                                    setStudioQueue(q => [...q, { type: 'library', libraryItem: item, name: item.name }]);
                                    alert(`Added "${item.name}" to the Studio Queue`);
                                  }} style={{ background: "rgba(100,100,150,0.1)", border: "1px solid " + colors.cardBorder, color: colors.textMuted, padding: "6px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(100,100,150,0.2)"} onMouseLeave={e => e.currentTarget.style.background = "rgba(100,100,150,0.1)"}>+ Queue</button>
                                  <button onClick={async () => {
                                    if (window.electronAPI) {
                                      const updatedPlaylists = playlists.map(p => {
                                        if (p.id === pl.id) {
                                          const nt = [...p.itemIds];
                                          nt.splice(localIdx, 1);
                                          return { ...p, itemIds: nt };
                                        }
                                        return p;
                                      });
                                      setPlaylists(updatedPlaylists);
                                      await window.electronAPI.saveLibrary({ songs: library, playlists: updatedPlaylists });
                                    }
                                  }} style={{ background: "transparent", border: "1px solid rgba(244,114,182,0.4)", color: "#f472b6", padding: "6px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer" }}>Remove</button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
