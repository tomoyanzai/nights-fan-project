import { EventBus } from "./events";
import { GameLoop } from "./gameLoop";
import { InputManager } from "@/game/engine/input";
import { gameStore } from "./gameStore";

/**
 * Composition root. Owns every system and the fixed-timestep loop; React
 * receives this object through context and only ever reads state from it or
 * calls its high-level actions.
 */
export class Game {
  readonly events = new EventBus();
  readonly input = new InputManager();
  readonly loop = new GameLoop();

  /** simulated seconds since start (prev kept for render interpolation) */
  time = 0;
  prevTime = 0;

  private constructor() {
    this.loop.addSystem((dt) => {
      this.prevTime = this.time;
      this.time += dt;
      this.input.update(dt);
    });
  }

  static create(): Game {
    return new Game();
  }

  /** Interpolated simulation time for rendering. */
  renderTime(alpha: number): number {
    return this.prevTime + (this.time - this.prevTime) * alpha;
  }

  start(): void {
    this.input.attach();
    this.loop.start();
  }

  setPaused(paused: boolean): void {
    this.loop.setPaused(paused);
    gameStore.setState({ phase: paused ? "paused" : "flying" });
  }

  dispose(): void {
    this.loop.stop();
    this.input.dispose();
    this.events.clear();
  }
}
