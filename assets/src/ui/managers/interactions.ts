export interface InteractionState {
  pointer: { x: number; y: number } | null;
  pressStartPointer: { x: number; y: number } | null;
  clicked: boolean;
  isPressed: boolean;
  wheelDelta: number;
  consumed: boolean;
}

export function createInteractionState(): InteractionState {
  return {
    pointer: null,
    pressStartPointer: null,
    clicked: false,
    isPressed: false,
    wheelDelta: 0,
    consumed: false
  };
}

export function pointInRect(
  point: { x: number; y: number } | null,
  rect: { x: number; y: number; width: number; height: number }
): boolean {
  if (!point) return false;
  return point.x >= rect.x && point.x <= rect.x + rect.width &&
         point.y >= rect.y && point.y <= rect.y + rect.height;
}

export class Interactions {
  private currentPointer: { x: number; y: number } | null = null;
  private pressStartPointer: { x: number; y: number } | null = null;
  private isPointerPressed = false;
  private pendingClick = false;
  private pendingWheelDelta = 0;
  private hasActivityThisFrame = false;

  private readonly onMouseDownBound = (e: MouseEvent) => this.onMouseDown(e);
  private readonly onMouseUpBound = (e: MouseEvent) => this.onMouseUp(e);
  private readonly onMouseMoveBound = (e: MouseEvent) => this.onMouseMove(e);
  private readonly onWheelBound = (e: WheelEvent) => this.onWheel(e);
  private readonly onKeydownBound = (e: KeyboardEvent) => this.onKeydown(e);
  private readonly onMouseLeaveBound = () => { this.isPointerPressed = false; };

  private onKeydownCallback: ((e: KeyboardEvent) => void) | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {}

  public start(onKeydown?: (e: KeyboardEvent) => void) {
    this.onKeydownCallback = onKeydown || null;
    document.addEventListener("mousedown", this.onMouseDownBound);
    document.addEventListener("mouseup", this.onMouseUpBound);
    document.addEventListener("mousemove", this.onMouseMoveBound);
    document.addEventListener("keydown", this.onKeydownBound);
    this.canvas.addEventListener("wheel", this.onWheelBound, { passive: false });
    this.canvas.addEventListener("mouseleave", this.onMouseLeaveBound);
  }

  public stop() {
    document.removeEventListener("mousedown", this.onMouseDownBound);
    document.removeEventListener("mouseup", this.onMouseUpBound);
    document.removeEventListener("mousemove", this.onMouseMoveBound);
    document.removeEventListener("keydown", this.onKeydownBound);
    this.canvas.removeEventListener("wheel", this.onWheelBound);
    this.canvas.removeEventListener("mouseleave", this.onMouseLeaveBound);
  }

  /**
   * Captures the current state for the frame and resets one-shot flags.
   */
  public tick(): { state: InteractionState; activity: boolean } {
    const state: InteractionState = {
      pointer: this.currentPointer,
      pressStartPointer: this.pressStartPointer,
      clicked: this.pendingClick,
      isPressed: this.isPointerPressed,
      wheelDelta: this.pendingWheelDelta,
      consumed: false
    };

    const activity = this.hasActivityThisFrame;

    // Reset one-shots
    this.pendingClick = false;
    this.pendingWheelDelta = 0;
    this.hasActivityThisFrame = false;

    // Reset pressStartPointer after the click frame, or if the pointer is no longer pressed.
    if (!this.isPointerPressed) {
      this.pressStartPointer = null;
    }

    return { state, activity };
  }

  private onMouseDown(event: MouseEvent) {
    this.currentPointer = this.getCanvasPoint(event);
    this.isPointerPressed = true;
    this.pressStartPointer = this.currentPointer;
    this.hasActivityThisFrame = true;
  }

  private onMouseUp(event: MouseEvent) {
    this.currentPointer = this.getCanvasPoint(event);
    this.isPointerPressed = false;
    this.pendingClick = true;
    this.hasActivityThisFrame = true;
  }

  private onMouseMove(event: MouseEvent) {
    this.currentPointer = this.getCanvasPoint(event);
    this.hasActivityThisFrame = true;
  }

  private onWheel(event: WheelEvent) {
    this.currentPointer = this.getCanvasPoint(event);
    this.pendingWheelDelta += event.deltaY;
    this.hasActivityThisFrame = true;
    event.preventDefault();
  }

  private onKeydown(event: KeyboardEvent) {
    this.hasActivityThisFrame = true;
    if (this.onKeydownCallback) {
      this.onKeydownCallback(event);
    }
  }

  private getCanvasPoint(event: MouseEvent | TouchEvent): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    let clientX: number | null = null;
    let clientY: number | null = null;

    if (event instanceof MouseEvent) {
      clientX = event.clientX;
      clientY = event.clientY;
    } else if (typeof TouchEvent !== 'undefined' && event instanceof TouchEvent && event.touches.length > 0) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    }

    if (clientX === null || clientY === null) return null;

    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    return {
      x: Math.min(Math.max(0, x), this.canvas.width),
      y: Math.min(Math.max(0, y), this.canvas.height)
    };
  }
}
