import * as THREE from "three";
import {
  DISPLAY_AREA_HEIGHT,
  DISPLAY_AREA_WIDTH,
  DISPLAY_AREA_X,
  DISPLAY_AREA_Y
} from "../../../config";
import { getActiveWebGLRenderer } from "../../../renderer/webgl";
import { pointInRect, type InteractionState } from "../../../ui/managers/interactions";
import { queueTooltip } from "../../../ui/components/tooltip";
import {
  orchardHexPoints,
  orchardHexState,
  getOrchardViewModel
} from "./view-model";
import { getAreaViewModel } from "../view-model";
import type { ClimateState, SoilState } from "../../../net/protocol";
import { fromNumber, toNumber, type BigNum } from "../../../core/bignum";
import { drawCurrencyAmount } from "../../../render/currency-icons";
import { formatBigNum } from "../../../utils/format";
import { resolveUpdatingText } from "../../../utils/text";
import orchardSharedConfig from "../../../../../shared/requirements/orchard.json";

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
const ORCHARD_SOIL_TOOLTIP_FONT = '12px "Courier New", monospace';
const ORCHARD_SOIL_STATS_X = DISPLAY_AREA_X + DISPLAY_AREA_WIDTH - 236;
const ORCHARD_SOIL_STATS_Y = DISPLAY_AREA_Y + 55;
const ORCHARD_SOIL_STATS_VALUE_X_OFFSET = 203;
const ORCHARD_SOIL_STATS_HOVER_RECT = {
  x: ORCHARD_SOIL_STATS_X - 10,
  y: ORCHARD_SOIL_STATS_Y - 8,
  width: 220,
  height: ORCHARD_SOIL_TEXT_LINE_HEIGHT * 5 + 16
} as const;

type SoilDelta = {
  water: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  organicMatter: number;
};
const ORCHARD_SOIL_OM_MAX = orchardSharedConfig.soil.organic_matter.max;
const ORCHARD_SOIL_RUNOFF_RETENTION_AT_MAX = orchardSharedConfig.soil.organic_matter.runoff_retention_factor_at_max;
const ORCHARD_SOIL_WATER_CAP_BASE = orchardSharedConfig.soil.organic_matter.water_cap_base;
const ORCHARD_SOIL_WATER_CAP_BONUS_AT_MAX = orchardSharedConfig.soil.organic_matter.water_cap_bonus_at_max;
const ORCHARD_SOIL_BASE_DRY_DOWN_PER_HOUR = orchardSharedConfig.soil.base_dry_down_per_hour;
const ORCHARD_SOIL_RAIN_MM_TO_WATER_RATIO = orchardSharedConfig.soil.rain_mm_to_water_ratio;
const ORCHARD_SOIL_NK_LEACH_PER_WATER_LOSS = orchardSharedConfig.soil.leach.nitrogen_and_potassium_per_water_loss;
const ORCHARD_SOIL_P_LEACH_MULTIPLIER = orchardSharedConfig.soil.leach.phosphorus_multiplier;
const ORCHARD_SOIL_OM_LEACH_PER_WATER_LOSS = orchardSharedConfig.soil.leach.organic_matter_per_water_loss;

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

  renderSoilStats(input);
}

function renderSoilStats(input?: InteractionState) {
  const renderer = getActiveWebGLRenderer();
  const { soil, climate } = getAreaViewModel().orchard;
  if (!soil) return;
  const deltaPerMinute = computeSoilDeltaPerMinute(soil, climate);

  const lines = [
    ["Nitrogen:", formatSoilBigNum(soil.nitrogen)],
    ["Phosporus:", formatSoilBigNum(soil.phosphorus)],
    ["Potassium:", formatSoilBigNum(soil.potassium)],
    ["Water:", `${formatSoilNumber(soil.water)}/${formatSoilNumber(soil.water_cap)}`],
    ["Organic Matter:", `${formatSoilBigNum(soil.organic_matter)}/${formatSoilNumber(soil.organic_matter_cap)}`]
  ];

  let y = ORCHARD_SOIL_STATS_Y;

  lines.forEach((line, index) => {
    let x = ORCHARD_SOIL_STATS_X;
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

    x += ORCHARD_SOIL_STATS_VALUE_X_OFFSET;
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

  if (input?.pointer && pointInRect(input.pointer, ORCHARD_SOIL_STATS_HOVER_RECT)) {
    const tooltipLines = buildSoilTooltipLines(soil, deltaPerMinute);
    queueTooltip(input.pointer, tooltipLines, {
      font: ORCHARD_SOIL_TOOLTIP_FONT,
      lineHeight: 16,
      textUpdateKey: "orchard.soil.tooltip",
      placement: "top-left"
    });
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

function buildSoilTooltipLines(soil: SoilState, delta: SoilDelta): string[] {
  const rows = [
    {
      label: "Nitrogen",
      value: buildTooltipValue(formatTooltipFixed(toNumber(soil.nitrogen)), delta.nitrogen)
    },
    {
      label: "Phosphorus",
      value: buildTooltipValue(formatTooltipFixed(toNumber(soil.phosphorus)), delta.phosphorus)
    },
    {
      label: "Potassium",
      value: buildTooltipValue(formatTooltipFixed(toNumber(soil.potassium)), delta.potassium)
    },
    {
      label: "Water",
      value: `${formatTooltipFixed(soil.water)}/${formatTooltipFixed(soil.water_cap)} ${formatTooltipDelta(delta.water)}`
    },
    {
      label: "Organic Matter",
      value: `${formatTooltipFixed(toNumber(soil.organic_matter))}/${formatTooltipFixed(soil.organic_matter_cap)} ${formatTooltipDelta(delta.organicMatter)}`
    }
  ];

  const labelWidth = rows.reduce((max, row) => Math.max(max, row.label.length), 0);
  const valueWidth = rows.reduce((max, row) => Math.max(max, row.value.length), 0);
  const baseWidth = labelWidth + 1 + valueWidth;
  const widenedWidth = Math.ceil(baseWidth * 1.2);

  return rows.map((row) => {
    const gapWidth = Math.max(1, widenedWidth - row.label.length - row.value.length);
    return `${row.label}${" ".repeat(gapWidth)}${row.value}`;
  });
}

function buildTooltipValue(formattedValue: string, delta: number): string {
  return `${formattedValue} ${formatTooltipDelta(delta)}`;
}

function formatTooltipFixed(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  return value.toFixed(2);
}

function formatTooltipDelta(delta: number): string {
  const sign = delta >= 0 ? "+" : "";
  return `(${sign}${delta.toFixed(3)}/min)`;
}

function computeSoilDeltaPerMinute(soil: SoilState, climate: ClimateState | null): SoilDelta {
  const rainMmPerMinute = Math.max(0, climate?.rain_mm ?? 0);
  const runoffRate = runoffRateFromOrganicMatter(soil.organic_matter);
  const waterCap = waterCapFromOrganicMatter(soil.organic_matter);
  const currentWater = clampNumber(soil.water, 0, waterCap);

  let nextWater = currentWater;
  let waterLost = 0;

  if (rainMmPerMinute > 0) {
    const gainedWater = rainMmPerMinute * ORCHARD_SOIL_RAIN_MM_TO_WATER_RATIO;
    const waterAfterRain = currentWater + gainedWater;
    const overflowLoss = Math.max(0, waterAfterRain - waterCap);
    nextWater = clampNumber(waterAfterRain - overflowLoss, 0, waterCap);
    waterLost = overflowLoss;
  } else {
    const dryDownLoss = (ORCHARD_SOIL_BASE_DRY_DOWN_PER_HOUR * runoffRate) / 60;
    const effectiveLoss = Math.min(currentWater, Math.max(0, dryDownLoss));
    nextWater = clampNumber(currentWater - effectiveLoss, 0, waterCap);
    waterLost = effectiveLoss;
  }

  const nkLoss = waterLost * ORCHARD_SOIL_NK_LEACH_PER_WATER_LOSS;
  const pLoss = nkLoss * ORCHARD_SOIL_P_LEACH_MULTIPLIER;
  const organicMatterLoss = waterLost * ORCHARD_SOIL_OM_LEACH_PER_WATER_LOSS;

  return {
    water: nextWater - currentWater,
    nitrogen: -Math.min(nonNegativeFiniteOrInfinity(toNumber(soil.nitrogen)), nkLoss),
    phosphorus: -Math.min(nonNegativeFiniteOrInfinity(toNumber(soil.phosphorus)), pLoss),
    potassium: -Math.min(nonNegativeFiniteOrInfinity(toNumber(soil.potassium)), nkLoss),
    organicMatter: -Math.min(nonNegativeFiniteOrInfinity(toNumber(soil.organic_matter)), organicMatterLoss)
  };
}

function runoffRateFromOrganicMatter(organicMatter: BigNum): number {
  const ratio = organicMatterRatio(organicMatter);
  return 1.0 - ORCHARD_SOIL_RUNOFF_RETENTION_AT_MAX * ratio;
}

function waterCapFromOrganicMatter(organicMatter: BigNum): number {
  const ratio = organicMatterRatio(organicMatter);
  return ORCHARD_SOIL_WATER_CAP_BASE + Math.trunc(Math.round(ORCHARD_SOIL_WATER_CAP_BONUS_AT_MAX * ratio));
}

function organicMatterRatio(organicMatter: BigNum): number {
  if (ORCHARD_SOIL_OM_MAX <= 0) return 0;
  const value = toNumber(organicMatter);
  if (!Number.isFinite(value)) return 1;
  return clampNumber(value / ORCHARD_SOIL_OM_MAX, 0, 1);
}

function nonNegativeFiniteOrInfinity(value: number): number {
  if (!Number.isFinite(value)) return Number.POSITIVE_INFINITY;
  return Math.max(0, value);
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
