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
import { getAreaViewModel } from "../view-model";
import { fromNumber, toNumber, type BigNum } from "../../../core/bignum";
import { drawCurrencyAmount } from "../../../render/currency-icons";
import { formatBigNum } from "../../../utils/format";
import { resolveUpdatingText } from "../../../utils/text";

type OrchardRuntime = {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  fillMesh: THREE.Mesh;
};

const ORCHARD_LOCKED_FILL_COLOR = 0x000000;
const ORCHARD_LOCKED_FILL_OPACITY = 0.52;
const ORCHARD_SOIL_TEXT_COLOR = "#f9e7af";
const ORCHARD_SOIL_TEXT_FONT = "bold 13px Inter";
const ORCHARD_SOIL_TEXT_LINE_HEIGHT = 29;

let orchardRuntime: OrchardRuntime | null = null;

function ensureOrchardRuntime(): OrchardRuntime {
  if (orchardRuntime) return orchardRuntime;

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
    color: ORCHARD_LOCKED_FILL_COLOR,
    transparent: true,
    opacity: 0.32,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false
  });
  const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);

  scene.add(fillMesh);

  orchardRuntime = {
    scene,
    camera,
    fillMesh
  };

  return orchardRuntime;
}

function setHexagonGeometry(runtime: OrchardRuntime, points: readonly { x: number; y: number }[]) {
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
}

export function renderOrchard(input?: InteractionState) {
  const renderer = getActiveWebGLRenderer();
  const orchard = getOrchardViewModel();

  if (orchard.hexagons.length === 0) return;

  const runtime = ensureOrchardRuntime();
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
      // Hovered unlocked plots get a soft pulse to communicate interactivity.
      const time = performance.now() * 0.0005;
      const fillPulse = 0.16 + 0.08 * Math.sin(time);

      fillMaterial.color.setHex(0xffffff);

      let sumX = 0;
      let sumY = 0;
      for (const pt of uvPoints) {
        sumX += pt[0];
        sumY += pt[1];
      }
      const centerX = sumX / uvPoints.length;
      const centerY = sumY / uvPoints.length;

      // Draw scaled layers to feather the edge instead of a hard single-fill highlight.
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
      setHexagonGeometry(runtime, points);

      if (isLocked) {
        fillMaterial.color.setHex(ORCHARD_LOCKED_FILL_COLOR);
        fillMaterial.opacity = ORCHARD_LOCKED_FILL_OPACITY;
      } else {
        // Unlocked plots stay visually transparent when idle.
        fillMaterial.opacity = 0;
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

    // Locked plots render their shard unlock price at the hex center.
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

  renderSoilStats();
}

function renderSoilStats() {
  const renderer = getActiveWebGLRenderer();
  const soil = getAreaViewModel().orchard.soil;
  if (!soil) return;

  const lines = [
    ["Nitrogen:", formatSoilBigNum(soil.nitrogen)],
    ["Phosporus:", formatSoilBigNum(soil.phosphorus)],
    ["Potassium:", formatSoilBigNum(soil.potassium)],
    ["Water:", `${formatSoilNumber(soil.water)}/${formatSoilNumber(soil.water_cap)}`],
    ["Organic Matter:", `${formatSoilBigNum(soil.organic_matter)}/${formatSoilNumber(soil.organic_matter_cap)}`]
  ];

  let y = DISPLAY_AREA_Y + 55;

  lines.forEach((line, index) => {
    let x = DISPLAY_AREA_X + DISPLAY_AREA_WIDTH - 236;
    const stableLine = resolveUpdatingText(`orchard.soil.line.${index}`, line[1], (candidate) =>
      renderer.isTextReady({
        text: candidate,
        font: ORCHARD_SOIL_TEXT_FONT,
        color: ORCHARD_SOIL_TEXT_COLOR,
        align: "left",
        baseline: "top"
      })
    );

    renderer.drawText({
      text: line[0],
      x,
      y,
      font: ORCHARD_SOIL_TEXT_FONT,
      color: ORCHARD_SOIL_TEXT_COLOR,
      align: "left",
      baseline: "top"
    });

    x += 203
    renderer.drawText({
      text: stableLine,
      x,
      y,
      font: ORCHARD_SOIL_TEXT_FONT,
      color: ORCHARD_SOIL_TEXT_COLOR,
      align: "right",
      baseline: "top"
    });
    y += ORCHARD_SOIL_TEXT_LINE_HEIGHT;
  });
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

function formatSoilBigNum(value: BigNum): string {
  const asNumber = toNumber(value);
  if (Number.isFinite(asNumber) && Math.abs(asNumber) < 100) {
    return asNumber.toFixed(1);
  }

  return formatBigNum(value);
}

function formatSoilNumber(value: number): string {
  const normalized = Math.max(0, value);
  if (normalized < 100) {
    return normalized.toFixed(1);
  }

  return Math.floor(normalized).toString();
}
