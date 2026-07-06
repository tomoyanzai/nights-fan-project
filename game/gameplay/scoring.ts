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

export function computeRank(score: number, timeLeft: number): Rank {
  const total = score + Math.round(timeLeft) * 10; // time bonus
  if (total >= 30000) return "S";
  if (total >= 18000) return "A";
  if (total >= 8000) return "B";
  return "C";
}
