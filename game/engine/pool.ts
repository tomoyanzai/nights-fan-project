/**
 * Minimal object pool. Collectibles use flat typed arrays and never allocate;
 * this pool serves burst-y transient objects (particle emissions, vacuum
 * tweens) and is the pattern future enemy projectiles reuse.
 */
export class Pool<T> {
  private readonly free: T[] = [];

  constructor(
    private readonly factory: () => T,
    private readonly reset?: (item: T) => void,
    preallocate = 0,
  ) {
    for (let i = 0; i < preallocate; i += 1) this.free.push(factory());
  }

  acquire(): T {
    return this.free.pop() ?? this.factory();
  }

  release(item: T): void {
    this.reset?.(item);
    this.free.push(item);
  }
}
