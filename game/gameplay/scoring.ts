import { SCORING } from "@/game/core/constants";
import { gameStore } from "@/game/core/gameStore";
import type { Rank } from "@/game/core/types";

export class Scoring {
  private score = 0;

  reset(): void {
    this.score = 0;
    gameStore.setState({ score: 0 });
  }

  get total(): number {
    return this.score;
  }

  addPickup(base: number, link: number): void {
    this.add(base * Math.max(link, 1));
  }

  addParaloop(itemCount: number): void {
    this.add(SCORING.paraloopBase + SCORING.paraloopPerItem * itemCount);
  }

  private add(points: number): void {
    this.score += points;
    gameStore.setState({ score: this.score });
  }
}

/**
 * @param bossBonus doubles the time-bonus term (mirrors NiGHTS' boss-clear
 *   time multiplier) so beating the Maelstrom with seconds to spare rewards
 *   the same way a fast lap does.
 */
export function computeRank(score: number, timeLeft: number, bossBonus = false): Rank {
  const total = score + Math.round(timeLeft) * (bossBonus ? 20 : 10); // time bonus
  if (total >= 30000) return "S";
  if (total >= 18000) return "A";
  if (total >= 8000) return "B";
  return "C";
}
