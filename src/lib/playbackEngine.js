import { usePlayerStore } from '../stores/playerStore.js';
import { useLibraryStore } from '../stores/libraryStore.js';
import { generateImpulseResponse, addVinylNoise } from './audioEngine.js';

class PlaybackEngine {
  constructor() {
    this.audioCtx = null;
    this.source = null;
    this.noiseSource = null;
    this.nodes = {};
    this.analyser = null;
    this.startTime = 0;
    this.pauseOffset = 0;
    this.raf = null;
    this.prevReverb = { size: 0, decay: 0, preDelay: 0 };
    this.isInitialized = false;

    // Subscribe to param and volume changes to update live audio nodes.
    // Standard Zustand subscribe (no selector middleware needed).
    let prevParams = null;
    let prevVol = null;
    usePlayerStore.subscribe((state) => {
      const changed = state.params !== prevParams || state.masterVolume !== prevVol;
      if (changed && this.source && state.isPlaying) {
        this.updateParams(state.params, state.masterVolume);
      }
      prevParams = state.params;
      prevVol = state.masterVolume;
    });
  }

  ensureCtx() {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 2048;
      // Provide analyser reference to the store so the visualizer can read it
      usePlayerStore.getState().analyserRef.current = this.analyser;
    }
    return this.audioCtx;
  }

  updateParams(params, masterVolume) {
    if (!this.audioCtx) return;
    const n = this.nodes;
    const t = this.audioCtx.currentTime;
    try {
      if (n.masterGain) n.masterGain.gain.setTargetAtTime(masterVolume, t, 0.05);
      if (n.source) n.source.playbackRate.setTargetAtTime(params.speed, t, 0.05);
      if (n.bass) n.bass.gain.setTargetAtTime(params.bassBoost, t, 0.05);
      if (n.warmFilter) n.warmFilter.gain.setTargetAtTime(-params.warmth, t, 0.05);
      if (n.dryGain) n.dryGain.gain.setTargetAtTime(1 - params.reverbMix * 0.6, t, 0.05);
      if (n.wetGain) n.wetGain.gain.setTargetAtTime(params.reverbMix * 1.4, t, 0.05);
      if (n.preDelayNode) n.preDelayNode.delayTime.setTargetAtTime(params.preDelay || 0, t, 0.05);
      if (n.widthDelay) n.widthDelay.delayTime.setTargetAtTime((params.stereoWidth || 0) * 0.02, t, 0.05);
      if (n.vinylGain) n.vinylGain.gain.setTargetAtTime((params.vinyl || 0) * 0.05, t, 0.05);
      if (n.convolver) {
        if (this.prevReverb.size !== params.reverbSize || this.prevReverb.decay !== params.reverbDecay || this.prevReverb.preDelay !== params.preDelay) {
          n.convolver.buffer = generateImpulseResponse(this.audioCtx, params.reverbSize, params.reverbDecay, params.preDelay || 0);
          this.prevReverb = { size: params.reverbSize, decay: params.reverbDecay, preDelay: params.preDelay };
        }
      }
    } catch (e) {
      console.error("Param update error", e);
    }
  }

  stop() {
    try { this.source?.stop(); } catch {}
    try { this.noiseSource?.stop(); } catch {}
    this.source = null;
    this.noiseSource = null;
    if (this.raf) cancelAnimationFrame(this.raf);
    usePlayerStore.getState().setIsPlaying(false);
  }

  play() {
    const state = usePlayerStore.getState();
    const buf = state.audioBuffer;
    const p = state.params;
    if (!buf) return;
    
    this.stop();
    const ctx = this.ensureCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.playbackRate.value = p.speed;
    if ('preservesPitch' in source) source.preservesPitch = p.preservePitch || false;

    const bass = ctx.createBiquadFilter();
    bass.type = 'lowshelf'; bass.frequency.value = 200; bass.gain.value = p.bassBoost;
    const warmFilter = ctx.createBiquadFilter();
    warmFilter.type = 'highshelf'; warmFilter.frequency.value = 6000; warmFilter.gain.value = -p.warmth;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24; compressor.knee.value = 12; compressor.ratio.value = 4;
    compressor.attack.value = 0.003; compressor.release.value = 0.25;
    const convolver = ctx.createConvolver();
    convolver.buffer = generateImpulseResponse(ctx, p.reverbSize, p.reverbDecay, p.preDelay || 0);
    const dryGain = ctx.createGain(); dryGain.gain.value = 1 - p.reverbMix * 0.6;
    const wetGain = ctx.createGain(); wetGain.gain.value = p.reverbMix * 1.4;
    const preDelayNode = ctx.createDelay(); preDelayNode.delayTime.value = p.preDelay || 0;
    const splitter = ctx.createChannelSplitter(2);
    const merger = ctx.createChannelMerger(2);
    const widthDelay = ctx.createDelay(); widthDelay.delayTime.value = (p.stereoWidth || 0) * 0.02;
    const masterGain = ctx.createGain(); masterGain.gain.value = state.masterVolume;

    source.connect(bass); bass.connect(warmFilter); warmFilter.connect(compressor);
    compressor.connect(dryGain);
    compressor.connect(preDelayNode); preDelayNode.connect(convolver);
    convolver.connect(splitter); splitter.connect(merger, 0, 0);
    splitter.connect(widthDelay, 1); widthDelay.connect(merger, 0, 1);
    merger.connect(wetGain);
    dryGain.connect(masterGain); wetGain.connect(masterGain);
    masterGain.connect(this.analyser); this.analyser.connect(ctx.destination);

    const noise = addVinylNoise(ctx, p.vinyl || 0, masterGain);
    let vGain = null;
    if (noise) { noise.source.start(0); this.noiseSource = noise.source; vGain = noise.gain; }

    this.prevReverb = { size: p.reverbSize, decay: p.reverbDecay, preDelay: p.preDelay };
    this.nodes = { source, bass, warmFilter, compressor, convolver, dryGain, wetGain, preDelayNode, widthDelay, masterGain, vinylGain: vGain };

    source.start(0, this.pauseOffset);
    this.startTime = ctx.currentTime - this.pauseOffset / p.speed;
    this.source = source;

    const tick = () => {
      if (this.audioCtx && usePlayerStore.getState().isPlaying) {
        const elapsed = (this.audioCtx.currentTime - this.startTime) * usePlayerStore.getState().params.speed;
        usePlayerStore.getState().setCurrentTime(Math.min(elapsed, buf.duration));
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);

    source.onended = () => {
      if (this.source !== source) return; // Prevent stop if we manually sought/replayed
      this.stop();
      this.pauseOffset = 0;
      usePlayerStore.getState().setCurrentTime(0);
      
      const s = usePlayerStore.getState();
      if (s.isRepeat) {
        this.play();
      } else if (s.queue.length > 0) {
        // Auto play next in queue
        this.playNext();
      }
    };

    usePlayerStore.getState().setIsPlaying(true);
    // Record play in history
    const track = usePlayerStore.getState().currentTrack;
    if (track) useLibraryStore.getState().addPlayToHistory(track);
  }

  togglePlay() {
    const s = usePlayerStore.getState();
    if (s.isPlaying) {
      this.stop();
      if (this.audioCtx) {
        this.pauseOffset = (this.audioCtx.currentTime - this.startTime) * s.params.speed;
      }
    } else {
      this.play();
    }
  }

  seek(time) {
    this.pauseOffset = time;
    if (usePlayerStore.getState().isPlaying) {
      this.play();
    } else {
      usePlayerStore.getState().setCurrentTime(time);
    }
  }

  async loadFileAndPlay(file, trackMeta = null) {
    const store = usePlayerStore.getState();
    store.setIsProcessing(true);
    store.setLoadingText('Reading file...');
    store.setAudioBuffer(null);
    this.stop();
    this.pauseOffset = 0;
    store.setCurrentTime(0);
    store.setExportDone(false);
    store.setProgress(0);
    store.setFileName(file.name);
    store.setAlbumArt(null);
    if (trackMeta) store.setTrack(trackMeta);

    // Fetch album art if local file
    if (window.electronAPI && file.path && !file.type?.startsWith('video/')) {
        window.electronAPI.getAlbumArt(file.path).then(art => {
            if (art) store.setAlbumArt(art);
        }).catch(() => {});
    }

    let arrBuf;
    if (file.type?.startsWith('video/')) {
      store.setIsVideo(true);
      store.setOriginalVideoFile(file);
      store.setLoadingText('Extracting audio...');
      try {
        const { extractAudioFromVideo } = await import('../../src/ffmpegProcessor.js');
        const blob = await extractAudioFromVideo(file, (p) => store.setProgress(p));
        arrBuf = await blob.arrayBuffer();
      } catch (e) {
        store.setIsProcessing(false);
        return;
      }
    } else {
      store.setIsVideo(false);
      store.setOriginalVideoFile(null);
      arrBuf = await file.arrayBuffer();
    }

    const ctx = this.ensureCtx();
    const decoded = await ctx.decodeAudioData(arrBuf);
    store.setAudioBuffer(decoded);
    store.setIsProcessing(false);
    store.setProgress(100);
    this.play();
  }

  async playNext() {
    const store = usePlayerStore.getState();
    let nextItem = null;

    if (store.queue.length > 0) {
      nextItem = store.queue[0];
      store.removeFromQueue(0);
    } else if (store.autoPlay) {
      // Auto-play: pick random song from library
      const songs = useLibraryStore.getState().songs;
      if (songs.length === 0) return;
      const current = store.currentTrack;
      const candidates = songs.filter(s => s.path !== current?.path && s.id !== current?.id);
      const pick = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : songs[Math.floor(Math.random() * songs.length)];
      nextItem = { type: 'library', name: pick.name, path: pick.path, id: pick.id, artist: pick.artist, album: pick.album };
    } else {
      return; // autoPlay off, stop
    }

    if (window.electronAPI && nextItem) {
      try {
        const buffer = await window.electronAPI.readFile(nextItem.path || nextItem.id);
        const isVid = nextItem.name?.endsWith('.mp4') || nextItem.type === 'video';
        const f = new File([buffer], nextItem.name, { type: isVid ? 'video/mp4' : 'audio/wav' });
        f.path = nextItem.path || nextItem.id;
        await this.loadFileAndPlay(f, nextItem);
      } catch (e) { console.error('Failed to play next item', e); }
    }
  }

  async playPrev() {
    const store = usePlayerStore.getState();
    const hist = useLibraryStore.getState().playHistory;
    
    // If we've listened for more than 3 seconds, just restart current song
    if (store.currentTime > 3) {
      this.seek(0);
      return;
    }

    // `playHistory[0]` is usually the current song, so `playHistory[1]` is the previous.
    if (hist && hist.length > 1) {
      const prevItem = hist[1];
      if (window.electronAPI && prevItem) {
        try {
          const buffer = await window.electronAPI.readFile(prevItem.path || prevItem.id);
          const isVid = prevItem.name?.endsWith('.mp4') || prevItem.type === 'video';
          const f = new File([buffer], prevItem.name, { type: isVid ? 'video/mp4' : 'audio/wav' });
          f.path = prevItem.path || prevItem.id;
          
          // Re-queue the current song to the top of the queue so it's not lost
          const currentTrack = store.currentTrack;
          if (currentTrack) {
             store.setQueue([currentTrack, ...store.queue]);
          }

          await this.loadFileAndPlay(f, prevItem);
        } catch (e) { console.error('Failed to play previous item', e); }
      }
    } else {
      this.seek(0);
    }
  }
}

export const playbackEngine = new PlaybackEngine();
