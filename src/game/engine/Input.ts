export interface VirtualJoystickState {
  active: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  radius: number;
}

export class InputManager {
  private keys: Record<string, boolean> = {};
  public dx: number = 0;
  public dy: number = 0;
  public facingX: number = 1;
  public facingY: number = 0;

  // Virtual Joystick for touch / mouse
  public joystick: VirtualJoystickState = {
    active: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    radius: 50,
  };

  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundBlur: () => void;

  public onPauseToggle?: () => void;
  public onOptionSelect?: (index: number) => void;

  constructor() {
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundKeyUp = this.handleKeyUp.bind(this);
    this.boundBlur = this.handleBlur.bind(this);

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.boundKeyDown);
      window.addEventListener('keyup', this.boundKeyUp);
      window.addEventListener('blur', this.boundBlur);
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    this.keys[e.code] = true;
    this.updateVector();

    if (e.code === 'Escape' || e.code === 'KeyP') {
      this.onPauseToggle?.();
    }
    if (e.code === 'Digit1') this.onOptionSelect?.(0);
    if (e.code === 'Digit2') this.onOptionSelect?.(1);
    if (e.code === 'Digit3') this.onOptionSelect?.(2);
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.keys[e.code] = false;
    this.updateVector();
  }

  private handleBlur(): void {
    this.keys = {};
    this.joystick.active = false;
    this.dx = 0;
    this.dy = 0;
  }

  public handlePointerDown(x: number, y: number): void {
    this.joystick.active = true;
    this.joystick.startX = x;
    this.joystick.startY = y;
    this.joystick.currentX = x;
    this.joystick.currentY = y;
    this.updateVector();
  }

  public handlePointerMove(x: number, y: number): void {
    if (!this.joystick.active) return;
    this.joystick.currentX = x;
    this.joystick.currentY = y;
    this.updateVector();
  }

  public handlePointerUp(): void {
    this.joystick.active = false;
    this.updateVector();
  }

  private updateVector(): void {
    let kx = 0;
    let ky = 0;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) ky -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) ky += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) kx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) kx += 1;

    let finalDx = kx;
    let finalDy = ky;

    if (this.joystick.active) {
      const jdx = this.joystick.currentX - this.joystick.startX;
      const jdy = this.joystick.currentY - this.joystick.startY;
      const dist = Math.sqrt(jdx * jdx + jdy * jdy);

      if (dist > 8) {
        const factor = Math.min(dist / this.joystick.radius, 1);
        finalDx = (jdx / dist) * factor;
        finalDy = (jdy / dist) * factor;
      }
    }

    const mag = Math.sqrt(finalDx * finalDx + finalDy * finalDy);
    if (mag > 1) {
      this.dx = finalDx / mag;
      this.dy = finalDy / mag;
    } else {
      this.dx = finalDx;
      this.dy = finalDy;
    }

    // Update facing direction when actively moving
    if (Math.abs(this.dx) > 0.1 || Math.abs(this.dy) > 0.1) {
      this.facingX = this.dx;
      this.facingY = this.dy;
    }
  }

  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.boundKeyDown);
      window.removeEventListener('keyup', this.boundKeyUp);
      window.removeEventListener('blur', this.boundBlur);
    }
  }
}
