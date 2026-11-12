export interface GridEntity {
  id: string | number;
  x: number;
  y: number;
  radius: number;
}

export class SpatialGrid<T extends GridEntity> {
  private cellSize: number;
  private cells: Map<string, T[]> = new Map();

  constructor(cellSize: number = 100) {
    this.cellSize = cellSize;
  }

  private getKey(cx: number, cy: number): string {
    return `${cx}:${cy}`;
  }

  clear(): void {
    this.cells.clear();
  }

  insert(entity: T): void {
    const cx = Math.floor(entity.x / this.cellSize);
    const cy = Math.floor(entity.y / this.cellSize);
    const key = this.getKey(cx, cy);

    let cell = this.cells.get(key);
    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
    }
    cell.push(entity);
  }

  queryRadius(x: number, y: number, radius: number): T[] {
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);

    const results: T[] = [];
    const radSq = radius * radius;

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const cell = this.cells.get(this.getKey(cx, cy));
        if (!cell) continue;

        for (let i = 0; i < cell.length; i++) {
          const item = cell[i];
          const dx = item.x - x;
          const dy = item.y - y;
          if (dx * dx + dy * dy <= radSq) {
            results.push(item);
          }
        }
      }
    }
    return results;
  }

  /**
   * Applies soft separation force between neighboring entities to prevent them from stacking.
   */
  applySeparation(entity: T, radius: number, forceMultiplier: number = 0.5): { vx: number; vy: number } {
    let sepX = 0;
    let sepY = 0;
    const minX = Math.floor((entity.x - radius) / this.cellSize);
    const maxX = Math.floor((entity.x + radius) / this.cellSize);
    const minY = Math.floor((entity.y - radius) / this.cellSize);
    const maxY = Math.floor((entity.y + radius) / this.cellSize);
    // Same cell and entity order as queryRadius, without allocating a list per enemy.
    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const cell = this.cells.get(this.getKey(cx, cy));
        if (!cell) continue;
        for (const other of cell) {
          if (other.id === entity.id) continue;
          const dx = entity.x - other.x;
          const dy = entity.y - other.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > 0 && distSq < radius * radius) {
            const dist = Math.sqrt(distSq);
            const push = (radius - dist) / radius;
            sepX += (dx / dist) * push;
            sepY += (dy / dist) * push;
          }
        }
      }
    }

    return {
      vx: sepX * forceMultiplier,
      vy: sepY * forceMultiplier,
    };
  }
}
