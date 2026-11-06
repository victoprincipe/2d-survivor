export class Camera {
  public x: number = 0;
  public y: number = 0;
  public viewportWidth: number = 800;
  public viewportHeight: number = 600;

  private shakeDuration: number = 0;
  private shakeIntensity: number = 0;
  public shakeOffsetX: number = 0;
  public shakeOffsetY: number = 0;

  constructor(viewportWidth: number = 800, viewportHeight: number = 600) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
  }

  resize(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  follow(targetX: number, targetY: number, dt: number, smooth: number = 8): void {
    const factor = Math.min(1, smooth * dt);
    this.x += (targetX - this.x) * factor;
    this.y += (targetY - this.y) * factor;

    // Handle screen shake
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      const angle = Math.random() * Math.PI * 2;
      const currentIntensity = this.shakeIntensity * (this.shakeDuration > 0 ? 1 : 0);
      this.shakeOffsetX = Math.cos(angle) * currentIntensity;
      this.shakeOffsetY = Math.sin(angle) * currentIntensity;
      this.shakeIntensity = Math.max(0, this.shakeIntensity - 20 * dt);
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
    }
  }

  shake(duration: number = 0.25, intensity: number = 6): void {
    this.shakeDuration = duration;
    this.shakeIntensity = intensity;
  }

  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX - this.x + this.viewportWidth / 2 + this.shakeOffsetX,
      y: worldY - this.y + this.viewportHeight / 2 + this.shakeOffsetY,
    };
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: screenX - this.viewportWidth / 2 + this.x - this.shakeOffsetX,
      y: screenY - this.viewportHeight / 2 + this.y - this.shakeOffsetY,
    };
  }

  isInView(worldX: number, worldY: number, margin: number = 100): boolean {
    const left = this.x - this.viewportWidth / 2 - margin;
    const right = this.x + this.viewportWidth / 2 + margin;
    const top = this.y - this.viewportHeight / 2 - margin;
    const bottom = this.y + this.viewportHeight / 2 + margin;

    return worldX >= left && worldX <= right && worldY >= top && worldY <= bottom;
  }
}
