import { createRng, type Rng } from "@/game/engine/rng";
import { gameStore } from "@/game/core/gameStore";
import { lerp } from "@/game/engine/math";
import type { AudioEngine } from "./audioEngine";
import { fmBell, pentatonic } from "./synthNodes";

export type MusicMode = "dream" | "boss";

/** Imaj7 – vi – IVmaj7 – V in A major, as semitone offsets from A2 */
const DREAM_CHORDS: number[][] = [
  [0, 4, 7, 11],
  [9, 12, 16, 21],
  [5, 9, 12, 16],
  [7, 11, 14, 19],
];
/** Am-family voicings from the same A2 root — darker, restless boss mood */
const BOSS_CHORDS: number[][] = [
  [0, 3, 7, 10],
  [8, 12, 15],
  [5, 8, 12],
  [7, 10, 14],
];
const DREAM_CHORD_SECONDS = 4;
const BOSS_CHORD_SECONDS = 2.5;
const BASE_HZ = 110; // A2
const DREAM_MELODY_HZ = 880;
const BOSS_MELODY_HZ = 440;

/** persistent pad-filter cutoff range; flight speed/boost drive it in free run */
const PAD_CUTOFF_MIN = 750;
const PAD_CUTOFF_MAX = 2400;
/** free-run melody register floor/ceiling, lerped by altitude */
const FREERUN_MELODY_LOW = 660;
const FREERUN_MELODY_HIGH = 1320;

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
  private mode: MusicMode = "dream";
  private rng: Rng;

  /** persistent lowpass on the pad path; free-run flight opens/closes it */
  private padFilter: BiquadFilterNode | null = null;
  /** free-run melody controls (null density = fall back to the link scheme) */
  private melodyDensity: number | null = null;
  private melodyRegister = DREAM_MELODY_HZ;

  constructor(
    private readonly engine: AudioEngine,
    seed = 1,
  ) {
    this.rng = createRng(seed);
  }

  /** Switch the generative palette; the running scheduler picks it up live. */
  setMode(mode: MusicMode): void {
    this.mode = mode;
  }

  start(): void {
    const ctx = this.engine.context;
    if (!ctx || this.timer) return;
    const dest = this.engine.music;
    // (re)build the persistent pad filter against the current context
    if (dest && (!this.padFilter || this.padFilter.context !== ctx)) {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = PAD_CUTOFF_MIN;
      filter.connect(dest);
      this.padFilter = filter;
    }
    this.nextChordTime = ctx.currentTime + 0.1;
    this.nextNoteTime = ctx.currentTime + 1.2;
    this.chordIndex = 0;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * Free-run: map flight to the music. Speed (or a held boost) opens the pad
   * filter and thickens the melody; altitude lifts the melody register.
   */
  setExpression({
    speed01,
    altitude01,
    boosting,
  }: {
    speed01: number;
    altitude01: number;
    boosting: boolean;
  }): void {
    const drive = Math.max(speed01, boosting ? 1 : 0);
    const cutoff = PAD_CUTOFF_MIN + (PAD_CUTOFF_MAX - PAD_CUTOFF_MIN) * drive;
    const ctx = this.engine.context;
    if (ctx && this.padFilter) {
      this.padFilter.frequency.setTargetAtTime(cutoff, ctx.currentTime, 0.25);
    }
    this.melodyDensity = 0.45 + 0.4 * speed01;
    this.melodyRegister = lerp(FREERUN_MELODY_LOW, FREERUN_MELODY_HIGH, altitude01);
  }

  /** Return the pad filter and melody to their defaults (mare mode). */
  clearExpression(): void {
    this.melodyDensity = null;
    this.melodyRegister = DREAM_MELODY_HZ;
    const ctx = this.engine.context;
    if (ctx && this.padFilter) {
      this.padFilter.frequency.setTargetAtTime(PAD_CUTOFF_MIN, ctx.currentTime, 0.25);
    }
  }

  /** Paraloop payoff: jump the progression forward with a louder pad stab now. */
  swell(): void {
    const ctx = this.engine.context;
    const dest = this.engine.music;
    if (!ctx || !dest) return;
    const boss = this.mode === "boss";
    const chords = boss ? BOSS_CHORDS : DREAM_CHORDS;
    const chordSecs = boss ? BOSS_CHORD_SECONDS : DREAM_CHORD_SECONDS;
    this.chordIndex %= chords.length;
    const chord = chords[this.chordIndex]!;
    // advance so the running scheduler continues from the following chord
    this.chordIndex = (this.chordIndex + 1) % chords.length;
    this.nextChordTime = ctx.currentTime + chordSecs;
    this.playPad(ctx, dest, chord, ctx.currentTime, chordSecs, 0.09);
  }

  private schedule(): void {
    const ctx = this.engine.context;
    const dest = this.engine.music;
    if (!ctx || !dest) return;
    const horizon = ctx.currentTime + 0.15;
    const boss = this.mode === "boss";
    const chords = boss ? BOSS_CHORDS : DREAM_CHORDS;
    const chordSecs = boss ? BOSS_CHORD_SECONDS : DREAM_CHORD_SECONDS;

    while (this.nextChordTime < horizon) {
      this.chordIndex %= chords.length;
      this.playPad(ctx, dest, chords[this.chordIndex]!, this.nextChordTime, chordSecs);
      this.chordIndex = (this.chordIndex + 1) % chords.length;
      this.nextChordTime += chordSecs;
    }

    while (this.nextNoteTime < horizon) {
      const link = gameStore.getState().link;
      // free-run expression overrides the link-based density/register
      const expressive = this.melodyDensity !== null;
      const density = expressive ? this.melodyDensity! : boss ? 0.7 : link >= 4 ? 0.8 : 0.45;
      const melodyBase = expressive ? this.melodyRegister : boss ? BOSS_MELODY_HZ : DREAM_MELODY_HZ;
      const interval = 0.5 + this.rng() * 1.2;
      if (this.rng() < density) {
        const degree = Math.floor(this.rng() * 10);
        fmBell(ctx, dest, pentatonic(degree, melodyBase), {
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

  private playPad(
    ctx: AudioContext,
    dest: AudioNode,
    chord: number[],
    when: number,
    chordSecs: number,
    peak = 0.028,
  ): void {
    // route through the persistent moving pad filter (falls back to dest)
    const sink = this.padFilter ?? dest;
    const dur = chordSecs + 1.2; // overlap into the next chord
    for (const semis of chord) {
      const freq = BASE_HZ * 2 ** (semis / 12);
      for (const detune of [-4, 3]) {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = freq;
        osc.detune.value = detune;
        const amp = ctx.createGain();
        amp.gain.setValueAtTime(0, when);
        amp.gain.linearRampToValueAtTime(peak, when + 1.4);
        amp.gain.setValueAtTime(peak, when + dur - 1.4);
        amp.gain.linearRampToValueAtTime(0, when + dur);
        osc.connect(amp).connect(sink);
        osc.start(when);
        osc.stop(when + dur + 0.1);
      }
    }
  }
}
