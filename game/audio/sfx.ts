import type { EventBus } from "@/game/core/events";
import type { AudioEngine } from "./audioEngine";
import { fmBell, glissando, noiseBurst, pentatonic, pluck } from "./synthNodes";

/**
 * Maps game events to synth patches. The signature NiGHTS cue: ring pitch
 * climbs a pentatonic scale with the link count, so a long chain literally
 * plays a rising melody.
 */
export class SfxDirector {
  private boostSource: AudioBufferSourceNode | null = null;
  private boostGain: GainNode | null = null;

  constructor(
    events: EventBus,
    private readonly engine: AudioEngine,
  ) {
    events.on("ring:collected", (e) => {
      const { ctx, dest } = this.io();
      if (!ctx || !dest) return;
      fmBell(ctx, dest, pentatonic(Math.min(e.link - 1, 9)), { decay: 0.6, gain: 0.22 });
    });

    events.on("chip:collected", (e) => {
      const { ctx, dest } = this.io();
      if (!ctx || !dest) return;
      const base = pentatonic(Math.min(e.link - 1, 9), 550);
      pluck(ctx, dest, base, { when: 0 });
      pluck(ctx, dest, base * 1.25, { when: 0.05 });
      pluck(ctx, dest, base * 1.5, { when: 0.1 });
    });

    events.on("link:broken", (e) => {
      const { ctx, dest } = this.io();
      if (!ctx || !dest || e.finalLink < 3) return;
      // soft resolving fifth
      fmBell(ctx, dest, 330, { decay: 0.5, gain: 0.12, ratio: 1.5, index: 40 });
      fmBell(ctx, dest, 495, { decay: 0.7, gain: 0.1, ratio: 1.5, index: 40, when: 0.07 });
    });

    events.on("paraloop", () => {
      const { ctx, dest } = this.io();
      if (!ctx || !dest) return;
      glissando(ctx, dest, 300, 1800, { duration: 0.5, gain: 0.18 });
      for (let i = 0; i < 6; i += 1) {
        fmBell(ctx, dest, pentatonic(4 + i, 660) * (1 + (i % 2) * 0.005), {
          decay: 1.1,
          gain: 0.07,
          when: 0.08 * i,
        });
      }
    });

    events.on("boost:start", () => this.startBoostWhoosh());
    events.on("boost:end", () => this.stopBoostWhoosh());

    events.on("bounds:hit", () => {
      const { ctx, dest } = this.io();
      if (!ctx || !dest || !this.engine.noise) return;
      noiseBurst(ctx, dest, this.engine.noise, { filterHz: 260, q: 1.4, decay: 0.25, gain: 0.2 });
    });

    events.on("player:hit", () => {
      const { ctx, dest } = this.io();
      if (!ctx || !dest) return;
      // a soft dissonant thud — this is a dream, not a death
      if (this.engine.noise) {
        noiseBurst(ctx, dest, this.engine.noise, { filterHz: 180, q: 1.2, decay: 0.35, gain: 0.22 });
      }
      fmBell(ctx, dest, 130, { ratio: 1.41, index: 30, decay: 0.5, gain: 0.2 });
    });

    events.on("enemy:destroyed", () => {
      const { ctx, dest } = this.io();
      if (!ctx || !dest) return;
      // quick descending zap plus a little shimmer bell
      glissando(ctx, dest, 900, 220, { duration: 0.18, gain: 0.18 });
      fmBell(ctx, dest, 1320, { decay: 0.35, gain: 0.1, ratio: 2.01, index: 60, when: 0.05 });
    });

    events.on("goal:unlocked", () => {
      const { ctx, dest } = this.io();
      if (!ctx || !dest) return;
      [0, 2, 4, 5].forEach((d, i) => fmBell(ctx, dest, pentatonic(d, 660), { when: i * 0.09, gain: 0.2, decay: 0.8 }));
    });

    events.on("boss:intro", () => {
      const { ctx, dest } = this.io();
      if (!ctx || !dest) return;
      // a rising dread swell + a deep bell toll as the Maelstrom surfaces
      glissando(ctx, dest, 80, 220, { duration: 1.6, gain: 0.25 });
      fmBell(ctx, dest, 82, { ratio: 1.41, index: 40, decay: 1.8, gain: 0.28 });
    });

    events.on("boss:hit", () => {
      const { ctx, dest } = this.io();
      if (!ctx || !dest) return;
      // a big gold impact: a bright noise smack + a descending bell pair
      if (this.engine.noise) {
        noiseBurst(ctx, dest, this.engine.noise, { filterHz: 700, q: 1.1, decay: 0.3, gain: 0.26 });
      }
      fmBell(ctx, dest, 660, { decay: 0.5, gain: 0.2, ratio: 2.01, index: 80 });
      fmBell(ctx, dest, 440, { decay: 0.6, gain: 0.16, ratio: 2.01, index: 80, when: 0.09 });
    });

    events.on("boss:defeated", () => {
      const { ctx, dest } = this.io();
      if (!ctx || !dest) return;
      // short, bright ascending arpeggio (mare:complete fires right after)
      [0, 4, 7, 12].forEach((st, i) =>
        fmBell(ctx, dest, 660 * 2 ** (st / 12), { when: i * 0.06, gain: 0.18, decay: 0.5 }),
      );
    });

    events.on("mare:complete", () => {
      const { ctx, dest } = this.io();
      if (!ctx || !dest) return;
      [0, 2, 4, 7, 9, 12].forEach((st, i) =>
        fmBell(ctx, dest, 440 * 2 ** (st / 12), { when: i * 0.12, gain: 0.2, decay: 1.4 }),
      );
    });

    events.on("mare:timeout", () => {
      const { ctx, dest } = this.io();
      if (!ctx || !dest) return;
      glissando(ctx, dest, 500, 180, { duration: 1.1, gain: 0.15 });
    });

    events.on("ui:select", () => {
      const { ctx, dest } = this.io();
      if (!ctx || !dest) return;
      pluck(ctx, dest, 880, { decay: 0.15, gain: 0.15 });
    });
  }

  private io(): { ctx: AudioContext | null; dest: GainNode | null } {
    return { ctx: this.engine.context, dest: this.engine.sfx };
  }

  private startBoostWhoosh(): void {
    const ctx = this.engine.context;
    const dest = this.engine.sfx;
    const noise = this.engine.noise;
    if (!ctx || !dest || !noise || this.boostSource) return;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(400, ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(1400, ctx.currentTime + 0.6);
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.12);
    src.connect(filter).connect(gain).connect(dest);
    src.start();
    this.boostSource = src;
    this.boostGain = gain;
  }

  private stopBoostWhoosh(): void {
    const ctx = this.engine.context;
    if (!ctx || !this.boostSource || !this.boostGain) return;
    const src = this.boostSource;
    this.boostGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    src.stop(ctx.currentTime + 0.4);
    this.boostSource = null;
    this.boostGain = null;
  }
}
