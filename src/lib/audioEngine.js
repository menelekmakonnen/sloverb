import { create } from 'zustand';

// ═══════════════════════════════════════════════
// Audio Engine — Core processing chain
// ═══════════════════════════════════════════════

export function generateImpulseResponse(audioCtx, duration, decay, preDelay = 0.01) {
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

export function addVinylNoise(ctx, vinylAmount, masterGain) {
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

export function buildOfflineChain(offlineCtx, sourceBuffer, params) {
  const { speed, reverbMix, reverbDecay, reverbSize, bassBoost, warmth, stereoWidth, normalize } = params;
  const source = offlineCtx.createBufferSource();
  source.buffer = sourceBuffer;
  source.playbackRate.value = speed;
  if ('preservesPitch' in source) {
    source.preservesPitch = params.preservePitch || false;
  }
  const bass = offlineCtx.createBiquadFilter();
  bass.type = "lowshelf"; bass.frequency.value = 200; bass.gain.value = bassBoost;
  const warmFilter = offlineCtx.createBiquadFilter();
  warmFilter.type = "highshelf"; warmFilter.frequency.value = 6000; warmFilter.gain.value = -warmth;
  const presenceFilter = offlineCtx.createBiquadFilter();
  presenceFilter.type = "peaking"; presenceFilter.frequency.value = 800;
  presenceFilter.Q.value = 0.8; presenceFilter.gain.value = Math.min(bassBoost * 0.3, 4);
  const compressor = offlineCtx.createDynamicsCompressor();
  compressor.threshold.value = -24; compressor.knee.value = 12;
  compressor.ratio.value = 4; compressor.attack.value = 0.003; compressor.release.value = 0.25;
  const convolver = offlineCtx.createConvolver();
  convolver.buffer = generateImpulseResponse(offlineCtx, reverbSize, reverbDecay, params.preDelay || 0);
  const dryGain = offlineCtx.createGain();
  dryGain.gain.value = 1 - reverbMix * 0.6;
  const wetGain = offlineCtx.createGain();
  wetGain.gain.value = reverbMix * 1.4;
  const preDelayNode = offlineCtx.createDelay();
  preDelayNode.delayTime.value = params.preDelay || 0;
  const splitter = offlineCtx.createChannelSplitter(2);
  const merger = offlineCtx.createChannelMerger(2);
  const widthDelay = offlineCtx.createDelay();
  widthDelay.delayTime.value = (stereoWidth || 0) * 0.02;
  const masterGain = offlineCtx.createGain();
  masterGain.gain.value = normalize ? 0.85 : 0.9;
  source.connect(bass); bass.connect(warmFilter); warmFilter.connect(presenceFilter);
  presenceFilter.connect(compressor); compressor.connect(dryGain);
  compressor.connect(preDelayNode); preDelayNode.connect(convolver);
  convolver.connect(splitter); splitter.connect(merger, 0, 0);
  splitter.connect(widthDelay, 1); widthDelay.connect(merger, 0, 1);
  merger.connect(wetGain); dryGain.connect(masterGain); wetGain.connect(masterGain);
  masterGain.connect(offlineCtx.destination);
  const noiseSrc = addVinylNoise(offlineCtx, params.vinyl || 0, masterGain);
  if (noiseSrc) noiseSrc.source.start(0);
  return source;
}

export function encodeWAV(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1;
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
  writeStr(0, "RIFF"); view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE"); writeStr(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true); view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true); writeStr(36, "data");
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

export const PRESETS = {
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
