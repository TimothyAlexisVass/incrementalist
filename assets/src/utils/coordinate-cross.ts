import { type RGBA, getActiveWebGLRenderer } from "../renderer/webgl";
import { queueTooltip } from "../ui/components/tooltip";
import type { InteractionState } from "../ui/managers/interactions";

export type CoordinateCross = {
  id: string;
  x: number;
  y: number;
  lineLength: number;
  lineThickness: number;
  grabRadius: number;
  isDragging: boolean;
  dragOffsetX: number;
  dragOffsetY: number;
};

export type CoordinateCrossDragBounds = {
  originX: number;
  originY: number;
  width: number;
  height: number;
  coordinateSpace?: "pixel" | "uv";
  blocked?: boolean;
};

export type CoordinateCrossRenderOptions = {
  originX: number;
  originY: number;
  width?: number;
  height?: number;
  coordinateSpace?: "pixel" | "uv";
  tooltipCoordinateSpace?: "pixel" | "uv";
  lineColor?: RGBA;
};

const DEFAULT_LINE_COLOR: RGBA = [1, 1, 1, 1];

export function createCoordinateCross(
  id: string,
  x: number,
  y: number,
  options?: {
    lineLength?: number;
    lineThickness?: number;
    grabRadius?: number;
  }
): CoordinateCross {
  return {
    id,
    x,
    y,
    lineLength: options?.lineLength ?? 42,
    lineThickness: options?.lineThickness ?? 2,
    grabRadius: options?.grabRadius ?? 20,
    isDragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0
  };
}

export function updateCoordinateCrossDrag(
  cross: CoordinateCross,
  input: InteractionState,
  bounds: CoordinateCrossDragBounds
) {
  const coordinateSpace = bounds.coordinateSpace ?? "pixel";
  const center = toScreenPoint(cross, bounds, coordinateSpace);
  const centerX = center.x;
  const centerY = center.y;

  if (
    input.clicked &&
    !input.consumed &&
    input.pressStartPointer &&
    distance(input.pressStartPointer.x, input.pressStartPointer.y, centerX, centerY) <= cross.grabRadius
  ) {
    input.consumed = true;
  }

  if (bounds.blocked || !input.isPressed || !input.pointer) {
    cross.isDragging = false;
    return;
  }

  if (!cross.isDragging) {
    if (input.consumed || !input.pressStartPointer) return;

    const startedOnCross =
      distance(input.pressStartPointer.x, input.pressStartPointer.y, centerX, centerY) <= cross.grabRadius;

    if (!startedOnCross) return;

    cross.isDragging = true;
    cross.dragOffsetX = centerX - input.pointer.x;
    cross.dragOffsetY = centerY - input.pointer.y;
  }

  const minX = bounds.originX;
  const maxX = bounds.originX + bounds.width;
  const minY = bounds.originY;
  const maxY = bounds.originY + bounds.height;

  const nextCenterX = clamp(input.pointer.x + cross.dragOffsetX, minX, maxX);
  const nextCenterY = clamp(input.pointer.y + cross.dragOffsetY, minY, maxY);

  if (coordinateSpace === "uv") {
    const width = Math.max(1, bounds.width);
    const height = Math.max(1, bounds.height);
    cross.x = clamp((nextCenterX - bounds.originX) / width, 0, 1);
    cross.y = clamp((nextCenterY - bounds.originY) / height, 0, 1);
  } else {
    cross.x = nextCenterX - bounds.originX;
    cross.y = nextCenterY - bounds.originY;
  }

  input.consumed = true;
}

export function renderCoordinateCross(
  cross: CoordinateCross,
  options: CoordinateCrossRenderOptions
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const color = options.lineColor ?? DEFAULT_LINE_COLOR;
  const coordinateSpace = options.coordinateSpace ?? "pixel";
  const tooltipCoordinateSpace = options.tooltipCoordinateSpace ?? coordinateSpace;
  const width = options.width ?? 1;
  const height = options.height ?? 1;
  const center = toScreenPoint(
    cross,
    {
      originX: options.originX,
      originY: options.originY,
      width,
      height
    },
    coordinateSpace
  );
  const centerX = center.x;
  const centerY = center.y;
  const half = cross.lineLength / 2;
  const thickness = Math.max(1, cross.lineThickness);

  renderer.drawRect({
    x: centerX - half,
    y: centerY - thickness / 2,
    width: cross.lineLength,
    height: thickness,
    color
  });

  renderer.drawRect({
    x: centerX - thickness / 2,
    y: centerY - half,
    width: thickness,
    height: cross.lineLength,
    color
  });

  const tooltipLines =
    tooltipCoordinateSpace === "uv"
      ? [`u: ${formatCoord(cross.x, 4)}`, `v: ${formatCoord(cross.y, 4)}`]
      : [`x: ${formatCoord(cross.x)}`, `y: ${formatCoord(cross.y)}`];

  queueTooltip({ x: centerX, y: centerY }, tooltipLines, {
    textUpdateKey: `coordinate-cross-${cross.id}`
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distance(x1: number, y1: number, x2: number, y2: number) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

function formatCoord(value: number, decimals = 2) {
  return value.toFixed(decimals);
}

function toScreenPoint(
  cross: CoordinateCross,
  bounds: {
    originX: number;
    originY: number;
    width: number;
    height: number;
  },
  coordinateSpace: "pixel" | "uv"
) {
  if (coordinateSpace === "uv") {
    return {
      x: bounds.originX + cross.x * bounds.width,
      y: bounds.originY + cross.y * bounds.height
    };
  }

  return {
    x: bounds.originX + cross.x,
    y: bounds.originY + cross.y
  };
}
