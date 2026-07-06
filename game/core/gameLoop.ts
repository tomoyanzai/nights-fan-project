export type UpdateFn = (dt: number) => void;
export type RenderFn = (alpha: number, frameDt: number) => void;

/**
 * Fixed-timestep simulation loop. Owns its own requestAnimationFrame so game
 * logic runs independently of the renderer (R3F components read state from
 * their own useFrame and interpolate with `alpha`).
 */
export class GameLoop {
  /** debug: multiplies simulated time */
  timeScale = 1;
  /** debug: count of frames where the accumulator had to be dropped */
  overruns = 0;

  private readonly updates: UpdateFn[] = [];
  private readonly renders: RenderFn[] = [];
  private accumulator = 0;
  private lastTime: number | null = null;
  private rafId = 0;
  private running = false;
  private paused = false;
  private alphaValue = 0;

  constructor(
    readonly fixedDt = 1 / 60,
    private readonly maxSubSteps = 5,
  ) {}

  /** Interpolation factor for rendering between the previous and current step. */
  get alpha(): number {
    return this.alphaValue;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  addSystem(fn: UpdateFn): void {
    this.updates.push(fn);
  }

  addRender(fn: RenderFn): void {
    this.renders.push(fn);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = null;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (!paused) this.lastTime = null; // avoid a giant dt on resume
  }

  private readonly tick = (nowMs: number) => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick);

    const now = nowMs / 1000;
    // Clamp the frame delta so a background tab doesn't explode the sim.
    const frameDt = this.lastTime === null ? this.fixedDt : Math.min(now - this.lastTime, 0.25);
    this.lastTime = now;

    if (!this.paused) {
      this.accumulator += frameDt * this.timeScale;
      let steps = 0;
      while (this.accumulator >= this.fixedDt && steps < this.maxSubSteps) {
        for (const update of this.updates) update(this.fixedDt);
        this.accumulator -= this.fixedDt;
        steps += 1;
      }
      if (this.accumulator >= this.fixedDt) {
        // Can't catch up — drop the remainder rather than spiral.
        this.overruns += 1;
        this.accumulator %= this.fixedDt;
      }
      this.alphaValue = this.accumulator / this.fixedDt;
    }

    for (const render of this.renders) render(this.alphaValue, frameDt);
  };
}
