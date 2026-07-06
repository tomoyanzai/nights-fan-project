/**
 * Collision seam. The vertical slice does all overlap queries in track space
 * (2D distance checks against sorted collectible arrays inside each system),
 * so the only implementation lives there. When free-flying entities (enemies,
 * bosses, projectiles) arrive, implement this interface with a real broadphase
 * (or Rapier) and register entities against it — gameplay systems only ever
 * see `CollisionWorld`.
 */
export type EntityId = number;

export interface CollisionWorld {
  /** Entity ids whose bounding sphere overlaps the query sphere. */
  queryOverlaps(x: number, y: number, z: number, radius: number): EntityId[];
}
