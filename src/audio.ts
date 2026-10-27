import { band, online, settings, strength, type Device } from "./state";
interface Voice {
  osc: OscillatorNode;
  noise: AudioBufferSourceNode;
  source: GainNode;
  ng: GainNode;
  filter: BiquadFilterNode;
  drive: WaveShaperNode;
  gain: GainNode;
  pan: StereoPannerNode;
}
export class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  voices = new Map<string, Voice>();
  async start() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.45;
      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.ratio.value = 12;
      this.master.connect(limiter).connect(this.ctx.destination);
    }
    await this.ctx.resume();
  }
  async stop() {
    await this.ctx?.suspend();
  }
  update(devices: Map<string, Device>, now: number) {
    const c = this.ctx;
    if (!c || !this.master) return;
    for (const [id, v] of this.voices)
      if (!devices.has(id)) {
        v.osc.stop();
        v.noise.stop();
        v.gain.disconnect();
        this.voices.delete(id);
      }
    for (const d of devices.values()) {
      let v = this.voices.get(d.id);
      if (!v) {
        const osc = c.createOscillator(),
          noise = c.createBufferSource(),
          source = c.createGain(),
          ng = c.createGain(),
          filter = c.createBiquadFilter(),
          drive = c.createWaveShaper(),
          gain = c.createGain(),
          pan = c.createStereoPanner();
        const buffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;
        noise.loop = true;
        osc.connect(source).connect(filter);
        noise.connect(ng).connect(filter);
        filter.connect(drive).connect(gain).connect(pan).connect(this.master);
        gain.gain.value = 0;
        osc.start();
        noise.start();
        v = { osc, noise, source, ng, filter, drive, gain, pan };
        this.voices.set(d.id, v);
      }
      const t = c.currentTime,
        s = strength(d.smooth, settings.thresholds),
        b = band(d.smooth, settings.thresholds),
        active = d.enabled && online(d, now, settings.timeout);
      v.osc.type =
        d.timbre === "drone"
          ? "sawtooth"
          : d.timbre === "percussion"
            ? "triangle"
            : "sine";
      v.osc.frequency.setTargetAtTime(d.pitch * (0.75 + s * 0.5), t, 0.12);
      v.source.gain.setTargetAtTime(d.timbre === "noise" ? 0 : 0.65, t, 0.1);
      v.ng.gain.setTargetAtTime(
        d.timbre === "noise" ? 0.5 : b >= 3 ? (1 - s) * 0.25 : 0,
        t,
        0.1,
      );
      v.filter.frequency.setTargetAtTime(
        Math.max(80, d.filter * (b === 0 ? 1 : 0.08 + s * 0.7)),
        t,
        0.12,
      );
      const amount = b === 0 ? 0 : d.distortion * Math.min(b, 3);
      const curve = new Float32Array(128);
      for (let i = 0; i < 128; i++) {
        const x = (i * 2) / 127 - 1;
        curve[i] =
          amount === 0 ? x : Math.tanh(x * (1 + amount * 20)) / (1 + amount);
      }
      v.drive.curve = curve;
      const pulse =
        d.timbre === "percussion"
          ? Math.pow(Math.max(0, Math.sin(t * 8)), 12)
          : 1;
      const gate =
        b === 4
          ? Math.sin(t * 9) > 0
            ? 1
            : 0
          : b >= 3 && Math.random() < d.glitch * 0.3
            ? 0
            : 1;
      v.gain.gain.setTargetAtTime(
        active ? d.volume * (0.25 + s * 0.75) * gate * pulse : 0,
        t,
        0.07,
      );
      v.pan.pan.setTargetAtTime(d.pan, t, 0.1);
    }
  }
}
