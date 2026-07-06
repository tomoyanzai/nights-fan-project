/**
 * Web Audio plumbing. The AudioContext can only start after a user gesture,
 * so everything is lazy: systems call methods freely and they no-op until
 * ensureStarted() has run (wired to the first keydown/pointerdown).
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  get context(): AudioContext | null {
    return this.ctx;
  }

  get sfx(): GainNode | null {
    return this.sfxBus;
  }

  get music(): GainNode | null {
    return this.musicBus;
  }

  /** shared 1s white-noise buffer for whooshes and bursts */
  get noise(): AudioBuffer | null {
    return this.noiseBuffer;
  }

  ensureStarted(): void {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? null;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.9;
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.55;
      this.musicBus.connect(this.master);

      const len = this.ctx.sampleRate;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  /** lower the mix while paused / in menus */
  setDucked(ducked: boolean): void {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(ducked ? 0.18 : 0.5, this.ctx.currentTime, 0.15);
  }

  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
  }
}
