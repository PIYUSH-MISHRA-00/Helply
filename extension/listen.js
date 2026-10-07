// Automatic speech chunks for one audio stream.
// ponytail: ScriptProcessorNode. Move to AudioWorklet if Chromium removes it.

const TARGET_RATE = 16000;

function rms(samples) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length) || 0;
}

function stepVad(state, rmsValue, dtMs, options) {
  const threshold = options.threshold;
  const hot = rmsValue >= threshold;

  if (!state.speaking) {
    if (hot) {
      state.speechMs += dtMs;
      if (state.speechMs >= options.startMs) {
        state.speaking = true;
        state.silenceMs = 0;
        return 'start';
      }
    } else {
      state.speechMs = 0;
    }
    return 'idle';
  }

  if (hot) {
    state.silenceMs = 0;
    return 'voice';
  }

  state.silenceMs += dtMs;
  if (state.silenceMs >= options.endMs) {
    state.speaking = false;
    state.speechMs = 0;
    state.silenceMs = 0;
    return 'end';
  }
  return 'trail';
}

function downsample(input, inRate, outRate) {
  if (inRate === outRate) return input;
  const ratio = inRate / outRate;
  const length = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      sum += input[j];
      count++;
    }
    out[i] = count ? sum / count : 0;
  }
  return out;
}

function encodeWav(samples, sampleRate) {
  const n = samples.length;
  const buffer = new ArrayBuffer(44 + n * 2);
  const view = new DataView(buffer);
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + n * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, n * 2, true);

  let offset = 44;
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Uint8Array(buffer);
}

function concatFloat32(chunks) {
  let length = 0;
  for (const chunk of chunks) length += chunk.length;
  const out = new Float32Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function toBase64(bytes) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + size));
  }
  return btoa(binary);
}

function attachListener(stream, options) {
  const settings = {
    threshold: 0.015,
    startMs: 160,
    endMs: 800,
    minMs: 500,
    maxMs: 18000,
    onUtterance: () => {},
    onActivity: () => {},
    isBlocked: () => false,
    ...options
  };

  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const mute = ctx.createGain();
  mute.gain.value = 0;
  source.connect(processor);
  processor.connect(mute);
  mute.connect(ctx.destination);

  const state = { speaking: false, speechMs: 0, silenceMs: 0 };
  let preRoll = [];
  let preRollSamples = 0;
  const preRollMax = Math.floor(ctx.sampleRate * 0.3);
  let utterance = [];
  let utteranceSamples = 0;
  let collecting = false;
  let stopped = false;

  function resetCollect() {
    collecting = false;
    utterance = [];
    utteranceSamples = 0;
    state.speaking = false;
    state.speechMs = 0;
    state.silenceMs = 0;
  }

  function pushPreRoll(frame) {
    preRoll.push(frame);
    preRollSamples += frame.length;
    while (preRollSamples > preRollMax && preRoll.length) {
      preRollSamples -= preRoll[0].length;
      preRoll.shift();
    }
  }

  // cut is true when the speaker was still talking and the chunk was split only for length.
  function emit(cut) {
    const frames = utterance;
    const samples = utteranceSamples;
    const rate = ctx.sampleRate;
    resetCollect();
    if (samples < (rate * settings.minMs) / 1000) return;

    const pcm = downsample(concatFloat32(frames), rate, TARGET_RATE);
    const wav = encodeWav(pcm, TARGET_RATE);
    settings.onUtterance(toBase64(wav), Boolean(cut));
  }

  processor.onaudioprocess = (event) => {
    if (stopped) return;
    const input = event.inputBuffer.getChannelData(0);
    const output = event.outputBuffer.getChannelData(0);
    output.fill(0);
    const frame = new Float32Array(input);
    const dtMs = (frame.length / ctx.sampleRate) * 1000;

    if (settings.isBlocked()) {
      if (collecting || state.speaking) {
        settings.onActivity(false);
        resetCollect();
      }
      pushPreRoll(frame);
      return;
    }

    const level = rms(frame);
    if (settings.onHot) settings.onHot(level >= settings.threshold);
    const phase = stepVad(state, level, dtMs, settings);
    if (phase === 'start') {
      collecting = true;
      utterance = preRoll.slice();
      utteranceSamples = preRollSamples;
      settings.onActivity(true);
    }

    if (collecting) {
      utterance.push(frame);
      utteranceSamples += frame.length;
      if (phase === 'end') {
        settings.onActivity(false);
        emit();
      } else if ((utteranceSamples / ctx.sampleRate) * 1000 >= settings.maxMs) {
        const stillSpeaking = state.speaking;
        emit(stillSpeaking);
        if (stillSpeaking) {
          collecting = true;
          state.speaking = true;
        } else {
          settings.onActivity(false);
        }
      }
    }

    pushPreRoll(frame);
  };

  ctx.resume().catch(() => {});

  return {
    stop() {
      stopped = true;
      processor.onaudioprocess = null;
      try { processor.disconnect(); } catch (e) { /* already stopped */ }
      try { source.disconnect(); } catch (e) { /* already stopped */ }
      try { mute.disconnect(); } catch (e) { /* already stopped */ }
      stream.getTracks().forEach((track) => track.stop());
      ctx.close().catch(() => {});
    }
  };
}

class AutoListen {
  constructor(hooks) {
    this.hooks = hooks || {};
    this.handles = [];
    this.streams = [];
    this.speakerHot = false;
    this.speakerQuietUntil = 0;
    this.paused = false;
  }

  get running() {
    return this.handles.length > 0;
  }

  // Pausing keeps the captures open. Asking for screen audio again on every resume
  // re-runs the capture prompt and has crashed the window on some Windows builds.
  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  start() {
    if (this.running) {
      this.resume();
      return Promise.resolve({ errors: [] });
    }
    if (!this.starting) {
      this.starting = this.open().finally(() => { this.starting = null; });
    }
    return this.starting.then((result) => {
      this.resume();
      return result;
    });
  }

  async open() {
    this.stop();
    this.paused = false;
    const errors = [];

    // Fire both captures in the same turn so the click still counts as the user gesture.
    const micPromise = navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false
    }).then((stream) => ({ stream })).catch((error) => ({ error }));

    const speakerPromise = navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: true
    }).then((stream) => ({ stream })).catch((error) => ({ error }));

    const [micResult, speakerResult] = await Promise.all([micPromise, speakerPromise]);

    if (micResult.stream) {
      this.streams.push(micResult.stream);
      this.handles.push(attachListener(micResult.stream, {
        threshold: 0.018,
        onUtterance: (audio) => this.hooks.onUtterance && this.hooks.onUtterance('mic', audio, false),
        onActivity: (active) => this.hooks.onActivity && this.hooks.onActivity('mic', active),
        isBlocked: () => this.paused || this.speakerHot || Date.now() < this.speakerQuietUntil
      }));
    } else {
      errors.push(`Microphone: ${micResult.error.message}`);
    }

    if (speakerResult.stream) {
      const display = speakerResult.stream;
      const audioTracks = display.getAudioTracks();
      // ponytail: keep the video track alive. Stopping it ends loopback audio on Chromium.
      if (!audioTracks.length) {
        display.getTracks().forEach((track) => track.stop());
        errors.push('Speaker: no speaker audio on this device');
      } else {
        this.streams.push(display);
        const speakerStream = new MediaStream(audioTracks);
        this.handles.push(attachListener(speakerStream, {
          threshold: 0.01,
          maxMs: 30000,
          isBlocked: () => this.paused,
          onUtterance: (audio, cut) => this.hooks.onUtterance && this.hooks.onUtterance('speaker', audio, cut),
          onHot: (hot) => {
            if (hot) {
              this.speakerHot = true;
              return;
            }
            if (this.speakerHot) this.speakerQuietUntil = Date.now() + 600;
            this.speakerHot = false;
          },
          onActivity: (active) => {
            if (this.hooks.onActivity) this.hooks.onActivity('speaker', active);
          }
        }));
      }
    } else {
      errors.push(`Speaker: ${speakerResult.error.message}`);
    }

    if (!this.handles.length) {
      throw new Error(errors.join(' ') || 'No audio source available');
    }

    if (this.hooks.onStatus) this.hooks.onStatus(errors);
    return { errors };
  }

  stop() {
    this.handles.forEach((handle) => handle.stop());
    this.streams.forEach((stream) => stream.getTracks().forEach((track) => track.stop()));
    this.handles = [];
    this.streams = [];
    this.speakerHot = false;
    this.paused = false;
  }
}

const api = { rms, stepVad, downsample, encodeWav, toBase64, attachListener, AutoListen, TARGET_RATE };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
if (typeof window !== 'undefined') {
  window.HelplyListen = api;
}

if (typeof require !== 'undefined' && require.main === module) {
  const quiet = { speaking: false, speechMs: 0, silenceMs: 0 };
  const opts = { threshold: 0.015, startMs: 160, endMs: 800 };
  const started = stepVad(quiet, 0.05, 200, opts);
  if (started !== 'start' || !quiet.speaking) {
    throw new Error('vad should open on sustained speech');
  }
  const ended = stepVad(quiet, 0, 900, opts);
  if (ended !== 'end' || quiet.speaking) {
    throw new Error('vad should close after silence');
  }

  const tone = new Float32Array(160);
  for (let i = 0; i < tone.length; i++) tone[i] = Math.sin(i / 8) * 0.5;
  const wav = encodeWav(tone, 16000);
  const header = String.fromCharCode(wav[0], wav[1], wav[2], wav[3]);
  if (header !== 'RIFF' || wav.length !== 44 + 320) {
    throw new Error('wav header mismatch');
  }
  const down = downsample(tone, 16000, 8000);
  if (down.length !== 80) throw new Error('downsample length mismatch');
  console.log('listen ok');
}
