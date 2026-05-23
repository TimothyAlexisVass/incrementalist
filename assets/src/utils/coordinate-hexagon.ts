import { type RGBA, getActiveWebGLRenderer } from "../renderer/webgl";
import { queueTooltip } from "../ui/components/tooltip";
import type { InteractionState } from "../ui/managers/interactions";

export type CoordinateHexagonPointRole =
  | "top-right"
  | "right"
  | "bottom-right"
  | "bottom-left"
  | "left"
  | "top-left";

export type CoordinateHexagonPoint = {
  role: CoordinateHexagonPointRole;
  x: number;
  y: number;
};

export type CoordinateHexagon = {
  id: string;
  points: CoordinateHexagonPoint[];
  markerLength: number;
  markerThickness: number;
  grabRadius: number;
  isDragging: boolean;
  draggingPointIndex: number | null;
  dragOffsetX: number;
  dragOffsetY: number;
};

export type CoordinateHexagonDragBounds = {
  originX: number;
  originY: number;
  width: number;
  height: number;
  coordinateSpace?: "pixel" | "uv";
  blocked?: boolean;
};

export type CoordinateHexagonRenderOptions = {
  originX: number;
  originY: number;
  width?: number;
  height?: number;
  coordinateSpace?: "pixel" | "uv";
  tooltipCoordinateSpace?: "pixel" | "uv";
  markerColor?: RGBA;
};

const DEFAULT_MARKER_COLOR: RGBA = [1, 1, 1, 1];
const POINT_ROLES: readonly CoordinateHexagonPointRole[] = [
  "top-right",
  "right",
  "bottom-right",
  "bottom-left",
  "left",
  "top-left"
];

const TOOLTIP_PLACEMENT_BY_ROLE = {
  "top-right": "top-right",
  right: "right",
  "bottom-right": "bottom-right",
  "bottom-left": "bottom-left",
  left: "left",
  "top-left": "top-left"
} as const;

export function createCoordinateHexagon(
  id: string,
  points: readonly (readonly [number, number])[],
  options?: {
    markerLength?: number;
    markerThickness?: number;
    grabRadius?: number;
  }
): CoordinateHexagon {
  const normalizedPoints = points
    .slice(0, POINT_ROLES.length)
    .map((point, index): CoordinateHexagonPoint => ({
      role: POINT_ROLES[index],
      x: point[0],
      y: point[1]
    }));

  return {
    id,
    points: normalizedPoints,
    markerLength: options?.markerLength ?? 12,
    markerThickness: options?.markerThickness ?? 2,
    grabRadius: options?.grabRadius ?? 20,
    isDragging: false,
    draggingPointIndex: null,
    dragOffsetX: 0,
    dragOffsetY: 0
  };
}

export function updateCoordinateHexagonDrag(
  hexagon: CoordinateHexagon,
  input: InteractionState,
  bounds: CoordinateHexagonDragBounds
) {
  const coordinateSpace = bounds.coordinateSpace ?? "pixel";
  const hitIndex = findNearestPointIndex(hexagon, input.pressStartPointer, bounds, coordinateSpace);

  if (input.clicked && !input.consumed && hitIndex !== null) {
    input.consumed = true;
  }

  if (bounds.blocked || !input.isPressed || !input.pointer) {
    hexagon.isDragging = false;
    hexagon.draggingPointIndex = null;
    return;
  }

  if (!hexagon.isDragging) {
    if (input.consumed || !input.pressStartPointer || hitIndex === null) return;

    const center = toScreenPoint(hexagon.points[hitIndex], bounds, coordinateSpace);
    hexagon.isDragging = true;
    hexagon.draggingPointIndex = hitIndex;
    hexagon.dragOffsetX = center.x - input.pointer.x;
    hexagon.dragOffsetY = center.y - input.pointer.y;
  }

  const draggingPointIndex = hexagon.draggingPointIndex;
  if (draggingPointIndex === null) return;

  const minX = bounds.originX;
  const maxX = bounds.originX + bounds.width;
  const minY = bounds.originY;
  const maxY = bounds.originY + bounds.height;

  const nextCenterX = clamp(input.pointer.x + hexagon.dragOffsetX, minX, maxX);
  const nextCenterY = clamp(input.pointer.y + hexagon.dragOffsetY, minY, maxY);

  const draggingPoint = hexagon.points[draggingPointIndex];
  if (!draggingPoint) return;

  if (coordinateSpace === "uv") {
    const width = Math.max(1, bounds.width);
    const height = Math.max(1, bounds.height);
    draggingPoint.x = clamp((nextCenterX - bounds.originX) / width, 0, 1);
    draggingPoint.y = clamp((nextCenterY - bounds.originY) / height, 0, 1);
  } else {
    draggingPoint.x = nextCenterX - bounds.originX;
    draggingPoint.y = nextCenterY - bounds.originY;
  }

  input.consumed = true;
}

export function renderCoordinateHexagon(
  hexagon: CoordinateHexagon,
  options: CoordinateHexagonRenderOptions
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const markerColor = options.markerColor ?? DEFAULT_MARKER_COLOR;
  const coordinateSpace = options.coordinateSpace ?? "pixel";
  const tooltipCoordinateSpace = options.tooltipCoordinateSpace ?? coordinateSpace;
  const width = options.width ?? 1;
  const height = options.height ?? 1;
  const half = hexagon.markerLength / 2;
  const thickness = Math.max(1, hexagon.markerThickness);

  for (const point of hexagon.points) {
    const center = toScreenPoint(
      point,
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

    renderer.drawRect({
      x: centerX - half,
      y: centerY - thickness / 2,
      width: hexagon.markerLength,
      height: thickness,
      color: markerColor
    });

    renderer.drawRect({
      x: centerX - thickness / 2,
      y: centerY - half,
      width: thickness,
      height: hexagon.markerLength,
      color: markerColor
    });

    const tooltipCoordinate = tooltipCoordinateSpace === "uv"
      ? `(${formatCoord(point.x, 4)}, ${formatCoord(point.y, 4)})`
      : `(${formatCoord(point.x, 1)}, ${formatCoord(point.y, 1)})`;

    queueTooltip({ x: centerX, y: centerY }, [point.role, tooltipCoordinate], {
      placement: TOOLTIP_PLACEMENT_BY_ROLE[point.role],
      offsetX: 10,
      offsetY: 10,
      textUpdateKey: `coordinate-hexagon-${hexagon.id}-${point.role}`
    });
  }
}

function findNearestPointIndex(
  hexagon: CoordinateHexagon,
  pointer: { x: number; y: number } | null,
  bounds: {
    originX: number;
    originY: number;
    width: number;
    height: number;
  },
  coordinateSpace: "pixel" | "uv"
): number | null {
  if (!pointer) return null;

  let nearestIndex: number | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < hexagon.points.length; i += 1) {
    const center = toScreenPoint(hexagon.points[i], bounds, coordinateSpace);
    const dist = distance(pointer.x, pointer.y, center.x, center.y);
    if (dist <= hexagon.grabRadius && dist < nearestDistance) {
      nearestIndex = i;
      nearestDistance = dist;
    }
  }

  return nearestIndex;
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
  point: CoordinateHexagonPoint,
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
      x: bounds.originX + point.x * bounds.width,
      y: bounds.originY + point.y * bounds.height
    };
  }

  return {
    x: bounds.originX + point.x,
    y: bounds.originY + point.y
  };
}
