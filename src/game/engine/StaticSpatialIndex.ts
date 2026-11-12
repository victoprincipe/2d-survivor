/** Broad phase for immutable scenery. Exact collision predicates stay with the caller. */
export class StaticSpatialIndex<T> {
  private readonly cells = new Map<string, T[]>();

  constructor(private readonly items: readonly T[], bounds: (item: T) => { x: number; y: number; radius: number }, private readonly cellSize = 128) {
    for (const item of items) {
      const { x, y, radius } = bounds(item);
      for (let cx = Math.floor((x - radius) / cellSize); cx <= Math.floor((x + radius) / cellSize); cx++) {
        for (let cy = Math.floor((y - radius) / cellSize); cy <= Math.floor((y + radius) / cellSize); cy++) {
          const key = `${cx}:${cy}`;
          const cell = this.cells.get(key);
          if (cell) cell.push(item); else this.cells.set(key, [item]);
        }
      }
    }
  }

  some(x: number, y: number, radius: number, predicate: (item: T) => boolean): boolean {
    // Predators can grow indefinitely. A giant query must not walk millions of
    // empty cells; for that exceptional case the bounded scenery scan is cheaper.
    if (radius > this.cellSize * 4) return this.items.some(predicate);
    // Repeated candidates across cells are harmless for a pure boolean predicate.
    for (let cx = Math.floor((x - radius) / this.cellSize); cx <= Math.floor((x + radius) / this.cellSize); cx++) {
      for (let cy = Math.floor((y - radius) / this.cellSize); cy <= Math.floor((y + radius) / this.cellSize); cy++) {
        const cell = this.cells.get(`${cx}:${cy}`);
        if (cell) for (const item of cell) if (predicate(item)) return true;
      }
    }
    return false;
  }
}
