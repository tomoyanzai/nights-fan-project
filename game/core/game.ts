import { EventBus } from "./events";
import { GameLoop } from "./gameLoop";
import { InputManager } from "@/game/engine/input";
import { SplineTrack } from "@/game/spline/splineTrack";
import { PlayerSystem } from "@/game/player/playerSystem";
import { ParaloopDetector } from "@/game/player/paraloop";
import { CameraRig } from "@/game/camera/cameraRig";
import { ComboSystem } from "@/game/gameplay/combo/comboSystem";
import { Scoring } from "@/game/gameplay/scoring";
import { RingSystem } from "@/game/gameplay/rings/ringSystem";
import { ChipSystem } from "@/game/gameplay/bluechips/chipSystem";
import { MareDirector } from "@/game/gameplay/mareDirector";
import { AudioEngine } from "@/game/audio/audioEngine";
import { SfxDirector } from "@/game/audio/sfx";
import { MusicDirector } from "@/game/audio/music";
import type { StageDefinition } from "@/game/stages/stageTypes";
import { gameStore, resetGameUi } from "./gameStore";

/**
 * Composition root. Owns every system and the fixed-timestep loop; React
 * receives this object through context and only ever reads state from it or
 * calls its high-level actions.
 *
 * Fixed-step update order:
 *   time/input → player → paraloop → rings/chips → combo → mare → camera
 */
export class Game {
  readonly events = new EventBus();
  readonly input = new InputManager();
  readonly loop = new GameLoop();
  readonly stage: StageDefinition;
  readonly track: SplineTrack;
  readonly player: PlayerSystem;
  readonly paraloop: ParaloopDetector;
  readonly cameraRig: CameraRig;
  readonly combo: ComboSystem;
  readonly scoring: Scoring;
  readonly rings: RingSystem;
  readonly chips: ChipSystem;
  readonly mare: MareDirector;
  readonly audio = new AudioEngine();
  readonly sfx: SfxDirector;
  readonly music: MusicDirector;

  private readonly audioGesture = () => {
    this.audio.ensureStarted();
    this.music.start();
  };

  /** simulated seconds since start (prev kept for render interpolation) */
  time = 0;
  prevTime = 0;

  private constructor(stage: StageDefinition) {
    this.stage = stage;
    this.track = new SplineTrack(stage.course);
    this.player = new PlayerSystem(this.track, this.input, this.events);
    this.paraloop = new ParaloopDetector();
    this.cameraRig = new CameraRig(this.track, this.player, this.events);
    this.combo = new ComboSystem(this.events);
    this.scoring = new Scoring();
    this.rings = new RingSystem(
      stage.layout.rings,
      this.track,
      this.player,
      this.combo,
      this.scoring,
      this.events,
    );
    this.chips = new ChipSystem(
      stage.layout.chips,
      this.track,
      this.player,
      this.combo,
      this.scoring,
      this.events,
    );
    this.mare = new MareDirector(stage, this.track, this.player, this.scoring, this.events);
    this.sfx = new SfxDirector(this.events, this.audio);
    this.music = new MusicDirector(this.audio, 20260706);

    this.paraloop.onLoop = (polygon) => {
      const count = this.rings.field.vacuumInPolygon(polygon) + this.chips.field.vacuumInPolygon(polygon);
      this.scoring.addParaloop(count);
      this.events.emit({ type: "paraloop", polygon, itemCount: count });
    };

    this.loop.addSystem((dt) => {
      this.prevTime = this.time;
      this.time += dt;
      this.input.update(dt);
    });
    this.loop.addSystem((dt) => {
      if (gameStore.getState().phase !== "flying") return;
      this.player.update(dt);
      this.paraloop.update(dt, this.player.state);
      this.rings.update(dt);
      this.chips.update(dt);
      this.combo.update(dt);
      this.mare.update(dt);
      const meter = Math.round(this.player.state.boostMeter * 100) / 100;
      if (gameStore.getState().boostMeter !== meter) {
        gameStore.setState({ boostMeter: meter });
      }
    });
    // camera runs in every phase so title/results keep a live backdrop
    this.loop.addSystem((dt) => this.cameraRig.update(dt));
  }

  static create(stage: StageDefinition): Game {
    return new Game(stage);
  }

  /** Interpolated simulation time for rendering. */
  renderTime(alpha: number): number {
    return this.prevTime + (this.time - this.prevTime) * alpha;
  }

  start(): void {
    this.input.attach();
    this.loop.start();
    // browsers only allow audio after a user gesture; hook the first one
    window.addEventListener("keydown", this.audioGesture, { once: true });
    window.addEventListener("pointerdown", this.audioGesture, { once: true });
  }

  /** Begin (or restart) a run of the stage. */
  startRun(): void {
    this.player.reset();
    this.paraloop.reset();
    this.cameraRig.reset();
    this.combo.reset();
    this.scoring.reset();
    this.rings.reset();
    this.chips.reset();
    this.mare.reset();
    resetGameUi();
    this.loop.setPaused(false);
    gameStore.setState({ phase: "flying" });
  }

  setPaused(paused: boolean): void {
    this.loop.setPaused(paused);
    this.audio.setDucked(paused);
    gameStore.setState({ phase: paused ? "paused" : "flying" });
  }

  quitToTitle(): void {
    this.loop.setPaused(false);
    gameStore.setState({ phase: "title" });
  }

  dispose(): void {
    this.loop.stop();
    this.input.dispose();
    this.music.stop();
    this.audio.dispose();
    window.removeEventListener("keydown", this.audioGesture);
    window.removeEventListener("pointerdown", this.audioGesture);
    this.events.clear();
  }
}
