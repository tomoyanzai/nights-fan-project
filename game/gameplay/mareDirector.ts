import type { EventBus } from "@/game/core/events";
import { gameStore } from "@/game/core/gameStore";
import { BOSS, ENEMIES } from "@/game/core/constants";
import { wrapDelta } from "@/game/engine/math";
import type { SplineTrack } from "@/game/spline/splineTrack";
import type { PlayerSystem } from "@/game/player/playerSystem";
import type { StageDefinition } from "@/game/stages/stageTypes";
import { computeRank, type Scoring } from "./scoring";

/** where the goal gate sits on the course */
export const GOAL_S = 0;
const GOAL_S_WINDOW = 3;
/** how long the "NIGHTMARE" intro plays before the boss can be fought */
const BOSS_INTRO_TIME = 3.0;

type MarePhase = "flying" | "goalUnlocked" | "bossIntro" | "boss" | "done";

/**
 * Runs one Mare (dream visit): collect the required Blue Chips to unlock the
 * goal gate, fly through it, then fight the Maelstrom on the remaining mare
 * time. The timer keeps draining through the whole fight — hitting zero at any
 * point is still a timeout.
 */
export class MareDirector {
  private phase: MarePhase = "flying";
  private timeLeft: number;
  private chips = 0;
  private bossIntroTimer = 0;

  constructor(
    private readonly stage: StageDefinition,
    private readonly track: SplineTrack,
    private readonly player: PlayerSystem,
    private readonly scoring: Scoring,
    private readonly events: EventBus,
  ) {
    this.timeLeft = stage.timeLimit;
    events.on("chip:collected", () => {
      this.chips += 1;
      if (this.phase === "flying" && this.chips >= stage.chipsRequired) {
        this.phase = "goalUnlocked";
        gameStore.setState({ goalUnlocked: true });
        this.events.emit({ type: "goal:unlocked" });
      }
    });

    // the elegant NiGHTS penalty: a hit costs seconds, not health. Clamp above
    // zero so the normal timeout path still fires from update() next step.
    events.on("player:hit", () => {
      this.timeLeft = Math.max(this.timeLeft - ENEMIES.damageTimeCost, 0.01);
    });

    // the boss reports its own defeat; clear the Mare with a boss time bonus.
    events.on("boss:defeated", () => this.clearByBoss());
  }

  reset(): void {
    this.phase = "flying";
    this.timeLeft = this.stage.timeLimit;
    this.chips = 0;
    this.bossIntroTimer = 0;
    gameStore.setState({
      timeLeft: this.stage.timeLimit,
      goalUnlocked: false,
      bossActive: false,
      bossHitsLeft: 0,
      rank: null,
      resultsKind: null,
    });
  }

  /** debug cheat: open the goal gate immediately */
  debugUnlockGoal(): void {
    if (this.phase !== "flying") return;
    this.phase = "goalUnlocked";
    gameStore.setState({ goalUnlocked: true });
    this.events.emit({ type: "goal:unlocked" });
  }

  update(dt: number): void {
    if (this.phase === "done") return;

    this.timeLeft -= dt;
    const shown = Math.max(Math.round(this.timeLeft * 10) / 10, 0);
    if (gameStore.getState().timeLeft !== shown) {
      gameStore.setState({ timeLeft: shown });
    }

    if (this.timeLeft <= 0) {
      this.phase = "done";
      gameStore.setState({ phase: "results", resultsKind: "timeout", rank: null, bossActive: false });
      this.events.emit({ type: "mare:timeout" });
      return;
    }

    if (this.phase === "goalUnlocked") {
      const st = this.player.state;
      if (Math.abs(wrapDelta(st.s, GOAL_S, this.track.totalLength)) < GOAL_S_WINDOW) {
        // gate crossed → the Maelstrom rises; the UI phase stays "flying".
        this.phase = "bossIntro";
        this.bossIntroTimer = BOSS_INTRO_TIME;
        gameStore.setState({ goalUnlocked: false, bossActive: true, bossHitsLeft: BOSS.hits });
        this.events.emit({ type: "boss:intro" });
      }
    } else if (this.phase === "bossIntro") {
      this.bossIntroTimer -= dt;
      if (this.bossIntroTimer <= 0) this.phase = "boss";
    }
    // phase "boss": defeat arrives via the boss:defeated listener.
  }

  /** boss:defeated → Dream Clear with the doubled boss time bonus. */
  private clearByBoss(): void {
    if (this.phase === "done") return;
    this.phase = "done";
    const rank = computeRank(this.scoring.total, this.timeLeft, true);
    gameStore.setState({ phase: "results", resultsKind: "clear", rank, bossActive: false });
    this.events.emit({ type: "mare:complete", rank, score: this.scoring.total });
  }
}
