export interface InputState {
  pointer: { x: number; y: number } | null;
  pressStartPointer: { x: number; y: number } | null;
  clicked: boolean;
  isPressed: boolean;
  consumed: boolean;
}

export function createInputState(): InputState {
  return {
    pointer: null,
    pressStartPointer: null,
    clicked: false,
    isPressed: false,
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
