import { Vector3 } from "three";
import { FLIGHT, FREERUN, SCORING } from "@/game/core/constants";
import type { EventBus } from "@/game/core/events";
import { gameStore } from "@/game/core/gameStore";
import { wrapDelta } from "@/game/engine/math";
import type { SplineTrack } from "@/game/spline/splineTrack";
import type { PlayerSystem } from "@/game/player/playerSystem";
import type { ComboSystem } from "../combo/comboSystem";
import type { Scoring } from "../scoring";
import { CollectibleField, type TrackPoint } from "../collectibleField";

const CHIP_PICKUP_RADIUS = 2.0;
const CHIP_S_WINDOW = 1.6;

const _pos = new Vector3();

export class ChipSystem {
  readonly field: CollectibleField;
  private collected = 0;
  private freeRun = false;
  private now = 0;

  constructor(
    items: readonly TrackPoint[],
    private readonly track: SplineTrack,
    private readonly player: PlayerSystem,
    private readonly combo: ComboSystem,
    private readonly scoring: Scoring,
    private readonly events: EventBus,
  ) {
    this.field = new CollectibleField(items, track.totalLength);
  }

  reset(): void {
    this.field.reset();
    this.collected = 0;
    this.now = 0;
    gameStore.setState({ chips: 0 });
  }

  setFreeRun(on: boolean): void {
    this.freeRun = on;
  }

  get chipCount(): number {
    return this.collected;
  }

  update(dt: number): void {
    this.now += dt;
    const st = this.player.state;
    this.field.forEachInWindow(st.s, CHIP_S_WINDOW + Math.abs(st.vs) * dt, (i) => {
      if (Math.abs(wrapDelta(this.field.s[i]!, st.s, this.track.totalLength)) > CHIP_S_WINDOW) return;
      if (Math.abs(this.field.y[i]! - st.y) > CHIP_PICKUP_RADIUS) return;
      this.field.state[i] = 2;
      this.collect(i);
    });
    this.field.updateVacuums(dt, (i) => this.collect(i));
    if (this.freeRun) this.field.updateRespawns(this.now);
  }

  private collect(index: number): void {
    // free-run is scoreless: no combo, no points, and no chip counter, so the
    // goal gate never unlocks — just the note and the boost refill
    const link = this.freeRun ? 0 : this.combo.registerPickup();
    if (!this.freeRun) {
      this.scoring.addPickup(SCORING.chipPoints, link);
      this.collected += 1;
      gameStore.setState({ chips: this.collected });
    }
    this.player.addBoost(FLIGHT.boostRefillChip);
    if (this.freeRun) this.field.respawnAt[index] = this.now + FREERUN.respawnDelay;
    this.track.worldPos(this.field.s[index]!, this.field.y[index]!, _pos);
    this.events.emit({
      type: "chip:collected",
      index,
      worldPos: [_pos.x, _pos.y, _pos.z],
      link,
      s: this.field.s[index]!,
      y: this.field.y[index]!,
    });
  }
}
