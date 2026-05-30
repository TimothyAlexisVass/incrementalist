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
  orchardHexPlotRatio,
  orchardHexState,
  getOrchardViewModel
} from "./view-model";
import { getAreaViewModel } from "../view-model";
import type { ClimateState, SoilState } from "../../../net/protocol";
import { fromNumber, toNumber, type BigNum } from "../../../core/bignum";
import { drawCurrencyAmount } from "../../../render/currency-icons";
import { formatBigNum } from "../../../utils/format";
import { resolveStableText } from "../../../renderer/stable-text";
import { getOrchardHarvestParticleColor } from "../../../colors";
import orchardSharedConfig from "../../../../../shared/requirements/orchard.json";
import orchardPlantsConfig from "../../../../../shared/requirements/plants.json";
import orchardDecomposeConfig from "../../../../../shared/requirements/decompose.json";
import { spawnGpuHarvestParticle } from "../../../render/webgl-effects";
import { humanizeSystemKey } from "./names";

type OrchardRuntime = {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  fillMesh: THREE.Mesh;
};

type OrchardPlantRenderState = {
  currentStage: number;
  previousStage: number | null;
  stageBlend: number;
  stageBlendUpdatedAt: number;
  hoverOpacityFrom: number;
  hoverOpacityTarget: number;
  hoverTransitionStartedAt: number;
};

type OrchardPlantRenderRequest = {
  uvPoints: readonly (readonly [number, number])[];
  plotId: string;
  plantId: string;
  growth: number;
  isPlotHovered: boolean;
  plotRatio: number;
};

type OrchardDecompRenderRequest = {
  uvPoints: readonly (readonly [number, number])[];
  plotId: string;
  plantType: string;
  progress: number;
  isPlotHovered: boolean;
  plotRatio: number;
};

type OrchardPlantRenderOptions = {
  w: number;
  h: number;
  y: number;
};

type OrchardPlantSpec = {
  renderOptions: OrchardPlantRenderOptions;
};

const ORCHARD_LOCKED_FILL_COLOR = 0x000000;
const ORCHARD_LOCKED_FILL_OPACITY = 0.52;
const ORCHARD_PLANT_STAGE_COUNT = 8;
const ORCHARD_PLANT_STAGE_FADE_MS = 1000;
const ORCHARD_PLANT_HOVER_OPACITY = 0.4;
const ORCHARD_PLANT_HOVER_FADE_MS = 200;
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
const ORCHARD_SOIL_NK_LEACH_PER_WATER_LOSS = orchardSharedConfig.soil.leach.nitrogen_and_potassium_per_water_loss;
const ORCHARD_SOIL_P_LEACH_MULTIPLIER = orchardSharedConfig.soil.leach.phosphorus_multiplier;
const ORCHARD_SOIL_OM_LEACH_PER_WATER_LOSS = orchardSharedConfig.soil.leach.organic_matter_per_water_loss;
const orchardPlantSpecs = orchardPlantsConfig as Record<string, OrchardPlantSpec>;

const orchardPlantImages = new Map<string, HTMLImageElement>();
const orchardPlantRenderStates = new Map<string, OrchardPlantRenderState>();

let orchardRuntime: OrchardRuntime | null = null;
let orchardPlantVisibility = false;

export function setOrchardPlantVisibility(isVisible: boolean) {
  if (!isVisible) {
    if (orchardPlantVisibility) {
      orchardPlantRenderStates.clear();
    }

    orchardPlantVisibility = false;
    return;
  }

  orchardPlantVisibility = true;
}

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

function resolvePlantStage(growth: number) {
  const normalizedGrowth = Number.isFinite(growth) ? growth : 0;
  const stage = Math.ceil(normalizedGrowth / (100 / ORCHARD_PLANT_STAGE_COUNT));
  return Math.min(ORCHARD_PLANT_STAGE_COUNT, Math.max(1, stage));
}

function getOrchardPlantImage(plantId: string, stage: number) {
  if (typeof Image === "undefined") return null;

  const normalizedStage = Math.min(ORCHARD_PLANT_STAGE_COUNT, Math.max(1, Math.floor(stage)));
  const imageKey = `${plantId}-${normalizedStage}`;

  if (!orchardPlantImages.has(imageKey)) {
    const image = new Image();
    image.src = `images/plants/${imageKey}.png`;
    orchardPlantImages.set(imageKey, image);
  }

  return orchardPlantImages.get(imageKey) ?? null;
}

function isRenderablePlantImage(image: HTMLImageElement | null): image is HTMLImageElement {
  return !!image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
}

function isBrokenPlantImage(image: HTMLImageElement | null) {
  return !!image && image.complete && (image.naturalWidth <= 0 || image.naturalHeight <= 0);
}

function updatePlantRenderState(plotId: string, currentStage: number, now: number) {
  let state = orchardPlantRenderStates.get(plotId);

  if (!state) {
    state = {
      currentStage,
      previousStage: null,
      stageBlend: 1,
      stageBlendUpdatedAt: now,
      hoverOpacityFrom: 1,
      hoverOpacityTarget: 1,
      hoverTransitionStartedAt: 0
    };
    orchardPlantRenderStates.set(plotId, state);
    return state;
  }

  if (state.currentStage !== currentStage) {
    state.previousStage = state.currentStage;
    state.currentStage = currentStage;
    state.stageBlend = 0;
    state.stageBlendUpdatedAt = now;
  }

  return state;
}

function advancePlantStageBlend(state: OrchardPlantRenderState, canAdvance: boolean, now: number) {
  if (!canAdvance || state.previousStage === null) {
    state.stageBlendUpdatedAt = now;
    return state.stageBlend;
  }

  const elapsed = Math.max(0, now - state.stageBlendUpdatedAt);
  state.stageBlendUpdatedAt = now;
  const transitionStep = ORCHARD_PLANT_STAGE_FADE_MS > 0 ? elapsed / ORCHARD_PLANT_STAGE_FADE_MS : 1;
  state.stageBlend = Math.min(1, state.stageBlend + transitionStep);
  return state.stageBlend;
}

function getPlantHoverOpacity(state: OrchardPlantRenderState, now: number) {
  const elapsed = Math.max(0, now - state.hoverTransitionStartedAt);
  const progress = Math.min(1, elapsed / ORCHARD_PLANT_HOVER_FADE_MS);
  return state.hoverOpacityFrom + ((state.hoverOpacityTarget - state.hoverOpacityFrom) * progress);
}

function getPlantImageFrame(
  uvPoints: readonly (readonly [number, number])[],
  image: HTMLImageElement,
  renderOptions: OrchardPlantRenderOptions,
  rawPlotRatio: number
) {
  let minX = uvPoints[0][0];
  let maxX = uvPoints[0][0];
  let minY = uvPoints[0][1];
  let maxY = uvPoints[0][1];

  for (let i = 1; i < uvPoints.length; i += 1) {
    const [u, v] = uvPoints[i];
    if (u < minX) minX = u;
    if (u > maxX) maxX = u;
    if (v < minY) minY = v;
    if (v > maxY) maxY = v;
  }

  const plotRatio = Number.isFinite(rawPlotRatio) && rawPlotRatio > 0
    ? rawPlotRatio
    : 1;
  const widthRatio = 1 + ((plotRatio - 1) * 0.5);
  const centerX = ((minX + maxX) / 2) * DISPLAY_AREA_WIDTH;
  const width = image.naturalWidth * renderOptions.w * widthRatio;
  const height = image.naturalHeight * renderOptions.h * plotRatio;
  const bottomY = DISPLAY_AREA_Y + maxY * DISPLAY_AREA_HEIGHT + renderOptions.y * plotRatio;

  return {
    x: DISPLAY_AREA_X + centerX - width / 2,
    y: bottomY - height,
    width,
    height
  };
}

function resolvePlantSpriteOpacity(
  state: OrchardPlantRenderState,
  input: InteractionState | undefined,
  isPlotHovered: boolean,
  frame: { x: number; y: number; width: number; height: number },
  now: number
) {
  const shouldDim = !!input?.pointer && !isPlotHovered && pointInRect(input.pointer, frame);
  const targetOpacity = shouldDim ? ORCHARD_PLANT_HOVER_OPACITY : 1;
  const currentOpacity = getPlantHoverOpacity(state, now);

  if (state.hoverOpacityTarget !== targetOpacity) {
    state.hoverOpacityFrom = currentOpacity;
    state.hoverOpacityTarget = targetOpacity;
    state.hoverTransitionStartedAt = now;
  }

  return getPlantHoverOpacity(state, now);
}

function renderPlantImage(
  renderer: ReturnType<typeof getActiveWebGLRenderer>,
  input: InteractionState | undefined,
  uvPoints: readonly (readonly [number, number])[],
  plotId: string,
  plantId: string,
  growth: number,
  isPlotHovered: boolean,
  plotRatio: number
) {
  const now = performance.now();
  const currentStage = resolvePlantStage(growth);
  const currentImage = getOrchardPlantImage(plantId, currentStage);
  const plantOptions = orchardPlantSpecs[plantId].renderOptions;
  if (isBrokenPlantImage(currentImage)) {
    orchardPlantRenderStates.delete(plotId);
    return;
  }

  const state = updatePlantRenderState(plotId, currentStage, now);
  const previousStage = state.previousStage;
  const previousImage = previousStage !== null ? getOrchardPlantImage(plantId, previousStage) : null;
  const currentImageReady = isRenderablePlantImage(currentImage);
  const previousImageReady = isRenderablePlantImage(previousImage);

  if (previousStage !== null) {
    const stageBlend = advancePlantStageBlend(state, currentImageReady, now);

    if (currentImageReady && previousImageReady) {
      const frame = getPlantImageFrame(uvPoints, currentImage, plantOptions, plotRatio);
      const alpha = resolvePlantSpriteOpacity(state, input, isPlotHovered, frame, now);
      renderer.drawImage({
        image: previousImage,
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
        alpha: alpha * (1 - stageBlend)
      });
      renderer.drawImage({
        image: currentImage,
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
        alpha: alpha * stageBlend
      });
      if (stageBlend >= 1) {
        state.previousStage = null;
      }
      return;
    }

    if (currentImageReady) {
      const frame = getPlantImageFrame(uvPoints, currentImage, plantOptions, plotRatio);
      const alpha = resolvePlantSpriteOpacity(state, input, isPlotHovered, frame, now);
      renderer.drawImage({
        image: currentImage,
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
        alpha
      });
      if (stageBlend >= 1) {
        state.previousStage = null;
      }
      return;
    }

    if (previousImageReady) {
      const frame = getPlantImageFrame(uvPoints, previousImage, plantOptions, plotRatio);
      const alpha = resolvePlantSpriteOpacity(state, input, isPlotHovered, frame, now);
      renderer.drawImage({
        image: previousImage,
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
        alpha
      });
      return;
    }

    return;
  }

  if (!currentImageReady) {
    return;
  }

  const frame = getPlantImageFrame(uvPoints, currentImage, plantOptions, plotRatio);
  const alpha = resolvePlantSpriteOpacity(state, input, isPlotHovered, frame, now);
  renderer.drawImage({
    image: currentImage,
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
    alpha
  });
}

const orchardDecomposeSpecs = orchardDecomposeConfig as Record<string, OrchardPlantSpec>;

function resolveDecompStage(progress: number) {
  const normalized = Math.max(0, Math.min(100, progress));
  return Math.min(3, Math.max(1, Math.ceil(normalized / (100 / 3))));
}

function getNutrientRatio(soilVal: any, limit: { min: number; max: number } | null | undefined): number {
  if (!limit) return 0;
  const maxVal = limit.max;
  if (!maxVal) return 0;
  const soilFloat = toNumber(soilVal);
  if (maxVal > 0) {
    return Math.min(1.0, soilFloat / maxVal);
  }
  return 0;
}

function renderDecompositionImage(
  renderer: ReturnType<typeof getActiveWebGLRenderer>,
  input: InteractionState | undefined,
  uvPoints: readonly (readonly [number, number])[],
  plotId: string,
  plantType: string,
  progress: number,
  isPlotHovered: boolean,
  plotRatio: number
) {
  const now = performance.now();
  const currentStage = resolveDecompStage(progress);
  const currentImage = getOrchardPlantImage(plantType, currentStage);
  const decompOptions = orchardDecomposeSpecs[plantType]?.renderOptions || { w: 0.4, h: 0.4, y: 0 };
  if (isBrokenPlantImage(currentImage)) {
    orchardPlantRenderStates.delete(plotId);
    return;
  }

  const state = updatePlantRenderState(plotId, currentStage, now);
  const previousStage = state.previousStage;
  const previousImage = previousStage !== null ? getOrchardPlantImage(plantType, previousStage) : null;
  const currentImageReady = isRenderablePlantImage(currentImage);
  const previousImageReady = isRenderablePlantImage(previousImage);

  if (previousStage !== null) {
    const stageBlend = advancePlantStageBlend(state, currentImageReady, now);

    if (currentImageReady && previousImageReady) {
      const frame = getPlantImageFrame(uvPoints, currentImage, decompOptions, plotRatio);
      const alpha = resolvePlantSpriteOpacity(state, input, isPlotHovered, frame, now);
      renderer.drawImage({
        image: previousImage,
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
        alpha: alpha * (1 - stageBlend)
      });
      renderer.drawImage({
        image: currentImage,
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
        alpha: alpha * stageBlend
      });
      if (stageBlend >= 1) {
        state.previousStage = null;
      }
      return;
    }

    if (currentImageReady) {
      const frame = getPlantImageFrame(uvPoints, currentImage, decompOptions, plotRatio);
      const alpha = resolvePlantSpriteOpacity(state, input, isPlotHovered, frame, now);
      renderer.drawImage({
        image: currentImage,
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
        alpha
      });
      if (stageBlend >= 1) {
        state.previousStage = null;
      }
      return;
    }

    if (previousImageReady) {
      const frame = getPlantImageFrame(uvPoints, previousImage, decompOptions, plotRatio);
      const alpha = resolvePlantSpriteOpacity(state, input, isPlotHovered, frame, now);
      renderer.drawImage({
        image: previousImage,
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
        alpha
      });
      return;
    }

    return;
  }

  if (!currentImageReady) {
    return;
  }

  const frame = getPlantImageFrame(uvPoints, currentImage, decompOptions, plotRatio);
  const alpha = resolvePlantSpriteOpacity(state, input, isPlotHovered, frame, now);
  renderer.drawImage({
    image: currentImage,
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
    alpha
  });
}

export function renderOrchard(input?: InteractionState, allowAmbientHarvestParticles = true) {
  const renderer = getActiveWebGLRenderer();
  const orchard = getOrchardViewModel();
  const plantRenderRequests: OrchardPlantRenderRequest[] = [];
  const decompRenderRequests: OrchardDecompRenderRequest[] = [];

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
    } else if (hex.plotData) {
      const plot = hex.plotData;
      if (plot.plant) {
        const plant = plot.plant;
        const isReady = plant.growth >= 100.0;
        plantRenderRequests.push({
          uvPoints,
          plotId: hex.id,
          plantId: plant.plant_id,
          growth: plant.growth,
          isPlotHovered: isHovered,
          plotRatio: orchardHexPlotRatio(hex)
        });

        // Spawn slowly rising particles from the plot when ready for harvest
        if (allowAmbientHarvestParticles && isReady && Math.random() < 0.08) {
          const vertices = uvPoints.map((point) => [
            DISPLAY_AREA_X + point[0] * DISPLAY_AREA_WIDTH,
            DISPLAY_AREA_Y + point[1] * DISPLAY_AREA_HEIGHT
          ] as const);

          let minX = vertices[0][0];
          let maxX = vertices[0][0];
          let minY = vertices[0][1];
          let maxY = vertices[0][1];
          for (let i = 1; i < vertices.length; i++) {
            const vx = vertices[i][0];
            const vy = vertices[i][1];
            if (vx < minX) minX = vx;
            if (vx > maxX) maxX = vx;
            if (vy < minY) minY = vy;
            if (vy > maxY) maxY = vy;
          }

          let spawnX = pixelX;
          let spawnY = pixelY;
          let found = false;
          for (let attempt = 0; attempt < 5; attempt++) {
            const rx = minX + Math.random() * (maxX - minX);
            const ry = minY + Math.random() * (maxY - minY);
            if (isPointInPolygon(rx, ry, vertices)) {
              spawnX = rx;
              spawnY = ry;
              found = true;
              break;
            }
          }

          spawnGpuHarvestParticle(spawnX, spawnY, getOrchardHarvestParticleColor(plant.plant_id));
        }

        // Show tooltip on hover
        if (isHovered && input?.pointer) {
          const label = humanizeSystemKey(plant.plant_id);
          let progressText = isReady ? "Harvest" : `${plant.growth.toFixed(1)}%`;

          if (!isReady) {
            const { soil, climate } = getAreaViewModel().orchard;
            if (soil && climate) {
              const spec = orchardPlantSpecs[plant.plant_id];
              if (spec) {
                const minTemp = (spec as any).minTemp ?? 0.0;
                const minWater = (spec as any).minWater ?? 0.0;

                if (climate.temperature_c >= minTemp && soil.water >= minWater) {
                  const nRatio = getNutrientRatio(soil.nitrogen, (spec as any).nitrogen);
                  const kRatio = getNutrientRatio(soil.potassium, (spec as any).potassium);

                  const growthBoost = 1.0 + nRatio * 0.5 + kRatio * 0.5;
                  const baseRate = ((spec as any).baseGrowthTime ?? 100.0) / 60.0;
                  const ratePerSecond = (baseRate / 60.0) * growthBoost;

                  if (ratePerSecond > 0) {
                    const secondsLeft = (100.0 - plant.growth) / ratePerSecond;
                    progressText += `\nTime left: ${secondsLeft.toFixed(1)}`;
                  }
                } else {
                  progressText += `\nTime left: Stalled`;
                }
              }
            }
          }

          queueTooltip(input.pointer, [label, progressText], {
            font: "13px Arial",
            lineFonts: ["bold 13px Arial", "13px Arial"],
            lineColors: ["#ffffff", isReady ? "#4caf50" : "#ffffff"],
            textUpdateKey: `orchard.plot.${hex.id}.tooltip`,
            placement: "top-left",
            align: "center"
          });
        }
      } else if (plot.decomposition) {
        const decomp = plot.decomposition;
        const plantType = decomp.plant_type || "herbaceous";
        decompRenderRequests.push({
          uvPoints,
          plotId: hex.id,
          plantType,
          progress: decomp.progress,
          isPlotHovered: isHovered,
          plotRatio: orchardHexPlotRatio(hex)
        });

        // Show tooltip on hover
        if (isHovered && input?.pointer) {
          const label = decomp.resource_id === "fruit" ? "Fruit Pile" : "Plant Matter";
          const secondsLeft = (100.0 - decomp.progress) * 6.0;
          const progressText = `${decomp.progress.toFixed(0)}%\nTime left: ${secondsLeft.toFixed(1)}`;

          queueTooltip(input.pointer, [label, progressText], {
            font: "13px Arial",
            lineFonts: ["bold 13px Arial", "13px Arial"],
            lineColors: ["#ffffff", "#ffffff"],
            textUpdateKey: `orchard.plot.${hex.id}.tooltip`,
            placement: "top-left",
            align: "center"
          });
        }
      } else {
        orchardPlantRenderStates.delete(hex.id);
      }
    }
  }

  for (const request of plantRenderRequests) {
    renderPlantImage(
      renderer,
      input,
      request.uvPoints,
      request.plotId,
      request.plantId,
      request.growth,
      request.isPlotHovered,
      request.plotRatio
    );
  }

  for (const request of decompRenderRequests) {
    renderDecompositionImage(
      renderer,
      input,
      request.uvPoints,
      request.plotId,
      request.plantType,
      request.progress,
      request.isPlotHovered,
      request.plotRatio
    );
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
    const stableLine = resolveStableText(`orchard.soil.line.${index}`, line[1], {
      font: ORCHARD_SOIL_TEXT_FONT,
      color: ORCHARD_SOIL_TEXT_COLOR,
      align: "left",
      baseline: "top"
    });

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
    const normalized = Math.max(0, asNumber);
    const floored = Math.floor(normalized * 10) / 10;
    return floored.toFixed(1);
  }

  return formatBigNum(value);
}

function formatSoilNumber(value: number): string {
  const normalized = Math.max(0, value);
  if (normalized < 100) {
    const floored = Math.floor(normalized * 10) / 10;
    return floored.toFixed(1);
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
    const gainedWater = rainMmPerMinute;
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
