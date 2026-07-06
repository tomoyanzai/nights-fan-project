import { COMBO } from "@/game/core/constants";
import type { EventBus } from "@/game/core/events";
import { gameStore } from "@/game/core/gameStore";

/**
 * Link chain: every pickup within the link window of the previous one grows
 * the chain; the chain multiplies score. This is the heartbeat of NiGHTS
 * scoring — collectible systems call registerPickup() and stamp the returned
 * link count on their events (audio pitches climb with it).
 */
export class ComboSystem {
  private link = 0;
  private lastPickupAt = -Infinity;
  private now = 0;

  constructor(private readonly events: EventBus) {}

  reset(): void {
    this.link = 0;
    this.lastPickupAt = -Infinity;
    this.now = 0;
    gameStore.setState({ link: 0, bestLink: 0, linkTimer01: 0 });
  }

  get currentLink(): number {
    return this.link;
  }

  registerPickup(): number {
    if (this.now - this.lastPickupAt <= COMBO.linkWindow) {
      this.link += 1;
    } else {
      this.link = 1;
    }
    this.lastPickupAt = this.now;
    const best = Math.max(gameStore.getState().bestLink, this.link);
    gameStore.setState({ link: this.link, bestLink: best, linkTimer01: 1 });
    this.events.emit({ type: "link:changed", link: this.link });
    return this.link;
  }

  update(dt: number): void {
    this.now += dt;
    if (this.link === 0) return;
    const elapsed = this.now - this.lastPickupAt;
    if (elapsed > COMBO.linkWindow) {
      const finalLink = this.link;
      this.link = 0;
      gameStore.setState({ link: 0, linkTimer01: 0 });
      this.events.emit({ type: "link:broken", finalLink });
    } else {
      // transient-subscribed by the HUD drain bar; selector equality keeps
      // other components from re-rendering
      gameStore.setState({ linkTimer01: 1 - elapsed / COMBO.linkWindow });
    }
  }
}
