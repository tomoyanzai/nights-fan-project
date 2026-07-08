import type { Rank, Vec2 } from "./types";
import type { EnemyKind } from "@/game/gameplay/enemies/enemyTypes";

export type GameEvent =
  | { type: "ring:collected"; index: number; worldPos: [number, number, number]; link: number; s: number; y: number }
  | { type: "chip:collected"; index: number; worldPos: [number, number, number]; link: number; s: number; y: number }
  | { type: "link:changed"; link: number }
  | { type: "link:broken"; finalLink: number }
  | { type: "paraloop"; polygon: Vec2[]; itemCount: number }
  | { type: "boost:start" }
  | { type: "boost:end" }
  | { type: "bounds:hit" }
  | { type: "player:hit"; worldPos: [number, number, number] }
  | { type: "enemy:destroyed"; kind: EnemyKind; worldPos: [number, number, number] }
  | { type: "goal:unlocked" }
  | { type: "boss:intro" }
  | { type: "boss:hit"; hitsLeft: number; worldPos: [number, number, number] }
  | { type: "boss:defeated" }
  | { type: "mare:complete"; rank: Rank; score: number }
  | { type: "mare:timeout" }
  | { type: "ui:select" };

type EventOf<T extends GameEvent["type"]> = Extract<GameEvent, { type: T }>;
type Listener<T extends GameEvent["type"]> = (event: EventOf<T>) => void;

export class EventBus {
  private readonly listeners = new Map<GameEvent["type"], Set<(e: GameEvent) => void>>();

  on<T extends GameEvent["type"]>(type: T, fn: Listener<T>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    const erased = fn as (e: GameEvent) => void;
    set.add(erased);
    return () => set.delete(erased);
  }

  emit(event: GameEvent): void {
    const set = this.listeners.get(event.type);
    if (!set) return;
    for (const fn of set) fn(event);
  }

  clear(): void {
    this.listeners.clear();
  }
}
