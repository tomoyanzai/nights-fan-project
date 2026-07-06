import { createRng, type Rng } from "@/game/engine/rng";
import { gameStore } from "@/game/core/gameStore";
import type { AudioEngine } from "./audioEngine";
import { fmBell, pentatonic } from "./synthNodes";

/** Imaj7 – vi – IVmaj7 – V in A major, as semitone offsets from A2 */
const CHORDS: number[][] = [
  [0, 4, 7, 11],
  [9, 12, 16, 21],
  [5, 9, 12, 16],
  [7, 11, 14, 19],
];
const CHORD_SECONDS = 4;
const BASE_HZ = 110; // A2

/**
 * Generative dream ambience: a slow detuned pad walks a four-chord
 * progression while a seeded pentatonic bell melody floats on top. Melody
 * density rises while the player holds a link — cheap dynamic music.
 * Scheduling uses the standard lookahead pattern (25 ms tick, 150 ms ahead
 * on the AudioContext clock).
 */
export class MusicDirector {
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextChordTime = 0;
  private nextNoteTime = 0;
  private chordIndex = 0;
  private rng: Rng;

  constructor(
    private readonly engine: AudioEngine,
    seed = 1,
  ) {
    this.rng = createRng(seed);
  }

  start(): void {
    const ctx = this.engine.context;
    if (!ctx || this.timer) return;
    this.nextChordTime = ctx.currentTime + 0.1;
    this.nextNoteTime = ctx.currentTime + 1.2;
    this.chordIndex = 0;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private schedule(): void {
    const ctx = this.engine.context;
    const dest = this.engine.music;
    if (!ctx || !dest) return;
    const horizon = ctx.currentTime + 0.15;

    while (this.nextChordTime < horizon) {
      this.playPad(ctx, dest, CHORDS[this.chordIndex]!, this.nextChordTime);
      this.chordIndex = (this.chordIndex + 1) % CHORDS.length;
      this.nextChordTime += CHORD_SECONDS;
    }

    while (this.nextNoteTime < horizon) {
      const link = gameStore.getState().link;
      const density = link >= 4 ? 0.8 : 0.45;
      const interval = 0.5 + this.rng() * 1.2;
      if (this.rng() < density) {
        const degree = Math.floor(this.rng() * 10);
        fmBell(ctx, dest, pentatonic(degree, 880), {
          when: this.nextNoteTime - ctx.currentTime,
          gain: 0.05 + this.rng() * 0.04,
          decay: 1.6,
          ratio: 3.01,
          index: 60,
        });
      }
      this.nextNoteTime += interval;
    }
  }

  private playPad(ctx: AudioContext, dest: AudioNode, chord: number[], when: number): void {
    const dur = CHORD_SECONDS + 1.2; // overlap into the next chord
    for (const semis of chord) {
      const freq = BASE_HZ * 2 ** (semis / 12);
      for (const detune of [-4, 3]) {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = freq;
        osc.detune.value = detune;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 750;
        const amp = ctx.createGain();
        amp.gain.setValueAtTime(0, when);
        amp.gain.linearRampToValueAtTime(0.028, when + 1.4);
        amp.gain.setValueAtTime(0.028, when + dur - 1.4);
        amp.gain.linearRampToValueAtTime(0, when + dur);
        osc.connect(filter).connect(amp).connect(dest);
        osc.start(when);
        osc.stop(when + dur + 0.1);
      }
    }
  }
}
