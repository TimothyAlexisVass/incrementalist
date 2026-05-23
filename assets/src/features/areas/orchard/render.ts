import * as THREE from "three";
import {
  DISPLAY_AREA_HEIGHT,
  DISPLAY_AREA_WIDTH,
  DISPLAY_AREA_X,
  DISPLAY_AREA_Y
} from "../../../config";
import { getActiveWebGLRenderer } from "../../../renderer/webgl";
import type { InteractionState } from "../../../ui/managers/interactions";
import {
  orchardHexPoints,
  orchardHexState,
  getOrchardViewModel
} from "./view-model";
import { fromNumber } from "../../../core/bignum";
import { drawCurrencyAmount } from "../../../render/currency-icons";

type OrchardDebugRuntime = {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  fillMesh: THREE.Mesh;
  outline: THREE.LineLoop;
};

const ORCHARD_DEBUG_FILL_COLOR = 0xff4da6;
const ORCHARD_DEBUG_OUTLINE_COLOR = 0xa6ff4d;
const ORCHARD_LOCKED_FILL_COLOR = 0x000000;
const ORCHARD_DEBUG_FILL_OPACITY = 0.32;
const ORCHARD_LOCKED_FILL_OPACITY = 0.52;

let orchardDebugRuntime: OrchardDebugRuntime | null = null;

function ensureOrchardDebugRuntime(): OrchardDebugRuntime {
  if (orchardDebugRuntime) return orchardDebugRuntime;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(
    0,
    DISPLAY_AREA_WIDTH,
    0,
    DISPLAY_AREA_HEIGHT,
    -10,
    10
  );
  camera.position.set(0, 0, 1);

  const fillGeometry = new THREE.BufferGeometry();
  const fillMaterial = new THREE.MeshBasicMaterial({
    color: ORCHARD_DEBUG_FILL_COLOR,
    transparent: true,
    opacity: 0.32,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false
  });
  const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);

  const outlineGeometry = new THREE.BufferGeometry();
  const outlineMaterial = new THREE.LineBasicMaterial({
    color: ORCHARD_DEBUG_OUTLINE_COLOR,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
    depthWrite: false
  });
  const outline = new THREE.LineLoop(outlineGeometry, outlineMaterial);

  scene.add(fillMesh);
  scene.add(outline);

  orchardDebugRuntime = {
    scene,
    camera,
    fillMesh,
    outline
  };

  return orchardDebugRuntime;
}

function setHexagonGeometry(runtime: OrchardDebugRuntime, points: readonly { x: number; y: number }[]) {
  if (points.length < 3) return;

  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].y);

  for (let i = 1; i < points.length; i += 1) {
    shape.lineTo(points[i].x, points[i].y);
  }

  shape.closePath();

  const fillGeometry = new THREE.ShapeGeometry(shape);
  runtime.fillMesh.geometry.dispose();
  runtime.fillMesh.geometry = fillGeometry;

  const outlinePositions = new Float32Array(points.length * 3);
  for (let i = 0; i < points.length; i += 1) {
    const offset = i * 3;
    outlinePositions[offset] = points[i].x;
    outlinePositions[offset + 1] = points[i].y;
    outlinePositions[offset + 2] = 0;
  }

  const outlineGeometry = new THREE.BufferGeometry();
  outlineGeometry.setAttribute("position", new THREE.BufferAttribute(outlinePositions, 3));

  runtime.outline.geometry.dispose();
  runtime.outline.geometry = outlineGeometry;
}

export function renderOrchard(input?: InteractionState) {
  const renderer = getActiveWebGLRenderer();
  const orchard = getOrchardViewModel();

  if (orchard.hexagons.length === 0) return;

  const runtime = ensureOrchardDebugRuntime();
  const fillMaterial = runtime.fillMesh.material as THREE.MeshBasicMaterial;

  for (const hex of orchard.hexagons) {
    const uvPoints = orchardHexPoints(hex);
    const points = uvPoints.map((point) => ({
      x: point[0] * DISPLAY_AREA_WIDTH,
      y: point[1] * DISPLAY_AREA_HEIGHT
    }));

    const isLocked = orchardHexState(hex) === "locked";

    let isHovered = false;
    if (!isLocked && input && input.pointer) {
      const vertices = uvPoints.map((point) => [
        DISPLAY_AREA_X + point[0] * DISPLAY_AREA_WIDTH,
        DISPLAY_AREA_Y + point[1] * DISPLAY_AREA_HEIGHT
      ] as const);
      if (isPointInPolygon(input.pointer.x, input.pointer.y, vertices)) {
        isHovered = true;
      }
    }

    if (isHovered) {
      // Dynamic white slow pulsing shine with a beautiful WebGL blur/glow effect!
      const time = performance.now() * 0.0025;
      const fillPulse = 0.16 + 0.08 * Math.sin(time);

      runtime.outline.visible = false;
      fillMaterial.color.setHex(0xffffff);

      let sumX = 0;
      let sumY = 0;
      for (const pt of uvPoints) {
        sumX += pt[0];
        sumY += pt[1];
      }
      const centerX = sumX / uvPoints.length;
      const centerY = sumY / uvPoints.length;

      // concentric scaling layers from 0.94 to 1.06 to feather/blur the WebGL hexagon edges
      const scales = [0.94, 0.97, 1.0, 1.03, 1.06];
      const opacities = [0.25, 0.6, 1.0, 0.6, 0.25];

      for (let layer = 0; layer < scales.length; layer++) {
        const s = scales[layer];
        const layerOpacity = fillPulse * opacities[layer];

        const layerPoints = uvPoints.map((point) => {
          const vx = point[0] - centerX;
          const vy = point[1] - centerY;
          return {
            x: (centerX + vx * s) * DISPLAY_AREA_WIDTH,
            y: (centerY + vy * s) * DISPLAY_AREA_HEIGHT
          };
        });

        setHexagonGeometry(runtime, layerPoints);
        fillMaterial.opacity = layerOpacity;

        renderer.drawThreeScene({
          scene: runtime.scene,
          camera: runtime.camera,
          x: DISPLAY_AREA_X,
          y: DISPLAY_AREA_Y,
          width: DISPLAY_AREA_WIDTH,
          height: DISPLAY_AREA_HEIGHT
        });
      }
    } else {
      // Regular locked or non-hovered rendering
      setHexagonGeometry(runtime, points);

      if (isLocked) {
        runtime.outline.visible = false;
        fillMaterial.color.setHex(ORCHARD_LOCKED_FILL_COLOR);
        fillMaterial.opacity = ORCHARD_LOCKED_FILL_OPACITY;
      } else {
        runtime.outline.visible = false; // No border/outline for unlocked plots!
        fillMaterial.color.setHex(ORCHARD_DEBUG_FILL_COLOR);
        fillMaterial.opacity = 0; // Transparent fill for unlocked plots!
      }

      renderer.drawThreeScene({
        scene: runtime.scene,
        camera: runtime.camera,
        x: DISPLAY_AREA_X,
        y: DISPLAY_AREA_Y,
        width: DISPLAY_AREA_WIDTH,
        height: DISPLAY_AREA_HEIGHT
      });
    }

    // If locked, render the price in shards at the center of the hexagon
    if (isLocked) {
      const match = hex.id.match(/^plot_(\d+)$/);
      const plotIdNum = match ? parseInt(match[1], 10) : 0;
      const price = 100 * plotIdNum;

      let sumX = 0;
      let sumY = 0;
      for (const pt of uvPoints) {
        sumX += pt[0];
        sumY += pt[1];
      }
      const centerX = sumX / uvPoints.length;
      const centerY = sumY / uvPoints.length;

      const pixelX = DISPLAY_AREA_X + centerX * DISPLAY_AREA_WIDTH;
      const pixelY = DISPLAY_AREA_Y + centerY * DISPLAY_AREA_HEIGHT;

      drawCurrencyAmount(
        "shards",
        fromNumber(price),
        pixelX,
        pixelY,
        14, // icon size
        {
          align: "center",
          font: "bold 11px Arial",
          textColor: "#ffffff",
          baseline: "middle",
          iconGap: 4
        }
      );
    }
  }
}

function isPointInPolygon(px: number, py: number, polygon: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect = ((yi > py) !== (yj > py))
      && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
