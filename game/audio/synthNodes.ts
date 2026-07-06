/** Small synth patches. Every one-shot builds its own nodes and lets the
 * graph garbage-collect them — fine at gameplay trigger rates. */

export function fmBell(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  {
    ratio = 2.01,
    index = 120,
    decay = 0.9,
    gain = 0.25,
    when = 0,
  }: { ratio?: number; index?: number; decay?: number; gain?: number; when?: number } = {},
): void {
  const t = ctx.currentTime + when;
  const carrier = ctx.createOscillator();
  carrier.frequency.value = freq;
  const mod = ctx.createOscillator();
  mod.frequency.value = freq * ratio;
  const modGain = ctx.createGain();
  modGain.gain.setValueAtTime(index, t);
  modGain.gain.exponentialRampToValueAtTime(1, t + decay);
  mod.connect(modGain).connect(carrier.frequency);

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(gain, t + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  carrier.connect(amp).connect(dest);

  carrier.start(t);
  mod.start(t);
  carrier.stop(t + decay + 0.05);
  mod.stop(t + decay + 0.05);
}

export function pluck(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  { decay = 0.35, gain = 0.2, when = 0 }: { decay?: number; gain?: number; when?: number } = {},
): void {
  const t = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = freq;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(freq * 6, t);
  filter.frequency.exponentialRampToValueAtTime(freq * 1.5, t + decay);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  osc.connect(filter).connect(amp).connect(dest);
  osc.start(t);
  osc.stop(t + decay + 0.05);
}

export function noiseBurst(
  ctx: AudioContext,
  dest: AudioNode,
  noise: AudioBuffer,
  {
    filterHz = 1200,
    q = 1,
    decay = 0.3,
    gain = 0.25,
    when = 0,
  }: { filterHz?: number; q?: number; decay?: number; gain?: number; when?: number } = {},
): void {
  const t = ctx.currentTime + when;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = filterHz;
  filter.Q.value = q;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  src.connect(filter).connect(amp).connect(dest);
  src.start(t);
  src.stop(t + decay + 0.05);
}

export function glissando(
  ctx: AudioContext,
  dest: AudioNode,
  fromHz: number,
  toHz: number,
  { duration = 0.5, gain = 0.2, when = 0 }: { duration?: number; gain?: number; when?: number } = {},
): void {
  const t = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(fromHz, t);
  osc.frequency.exponentialRampToValueAtTime(toHz, t + duration);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(gain, t + 0.05);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + duration + 0.2);
  osc.connect(amp).connect(dest);
  osc.start(t);
  osc.stop(t + duration + 0.3);
}

/** pentatonic degree → frequency, base A4 */
export function pentatonic(degree: number, base = 440): number {
  const steps = [0, 2, 4, 7, 9];
  const octave = Math.floor(degree / steps.length);
  const idx = ((degree % steps.length) + steps.length) % steps.length;
  return base * 2 ** ((steps[idx]! + octave * 12) / 12);
}
