import { Vector3 } from "three";
import { FLIGHT, FREERUN, SCORING } from "@/game/core/constants";
import type { EventBus } from "@/game/core/events";
import { wrapDelta } from "@/game/engine/math";
import type { SplineTrack } from "@/game/spline/splineTrack";
import type { PlayerSystem } from "@/game/player/playerSystem";
import type { ComboSystem } from "../combo/comboSystem";
import type { Scoring } from "../scoring";
import { CollectibleField, type TrackPoint } from "../collectibleField";

/** in-plane radius within which flying past counts as "through the ring" */
export const RING_RADIUS = 2.4;
/** how close along s the player must pass */
const RING_S_WINDOW = 1.6;

const _pos = new Vector3();

export class RingSystem {
  readonly field: CollectibleField;
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
    this.now = 0;
  }

  setFreeRun(on: boolean): void {
    this.freeRun = on;
  }

  update(dt: number): void {
    this.now += dt;
    const st = this.player.state;
    this.field.forEachInWindow(st.s, RING_S_WINDOW + Math.abs(st.vs) * dt, (i) => {
      if (Math.abs(wrapDelta(this.field.s[i]!, st.s, this.track.totalLength)) > RING_S_WINDOW) return;
      if (Math.abs(this.field.y[i]! - st.y) > RING_RADIUS) return;
      this.field.state[i] = 2; // collected
      this.collect(i);
    });
    this.field.updateVacuums(dt, (i) => this.collect(i));
    if (this.freeRun) this.field.updateRespawns(this.now);
  }

  private collect(index: number): void {
    // free-run is scoreless and linkless: no combo, no points, just the note
    const link = this.freeRun ? 0 : this.combo.registerPickup();
    if (!this.freeRun) this.scoring.addPickup(SCORING.ringPoints, link);
    this.player.addBoost(FLIGHT.boostRefillRing);
    if (this.freeRun) this.field.respawnAt[index] = this.now + FREERUN.respawnDelay;
    this.track.worldPos(this.field.s[index]!, this.field.y[index]!, _pos);
    this.events.emit({
      type: "ring:collected",
      index,
      worldPos: [_pos.x, _pos.y, _pos.z],
      link,
      s: this.field.s[index]!,
      y: this.field.y[index]!,
    });
  }
}
