import bonusTimeConfig from "../../../../../shared/requirements/bonustime.json";
import { getActiveWebGLRenderer, type DrawPointParticle } from "../../../renderer/webgl";
import { hexToRgba, to255 } from "../../../utils";
import { getRewardTierLabelColor } from "../../../colors";
import { BONUSTIME_BODY_FONT, BONUSTIME_TITLE_FONT } from "../../../config";
import { renderBonusTimeWelcomeCard } from "../flow";
import {
  getScratchCardBoardRect,
  getScratchCardHoverBoardPoint,
  getScratchCardParticles,
  getScratchCardRevealVisuals,
  getScratchCardScratchedIndices,
  getScratchCardScratchedPixels,
  getScratchCardState,
  ScratchCardState
} from "./interactions";
import { ScratchCardData } from "./view-model";

type ScratchCardConfig = {
  reward_tiers: Record<string, { color?: string }>;
  game_rules: {
    scratch_card: {
      board_size: { width: number; height: number };
      grid_cell_size_px: number;
      brush_size: { width: number; height: number };
    };
  };
};

const SCRATCH_CONFIG = bonusTimeConfig as ScratchCardConfig;
const SCRATCH_RULES = SCRATCH_CONFIG.game_rules.scratch_card;
const BOARD_WIDTH = SCRATCH_RULES.board_size.width;
const BOARD_HEIGHT = SCRATCH_RULES.board_size.height;
const GRID_COLS = Math.floor(BOARD_WIDTH / SCRATCH_RULES.grid_cell_size_px);
const GRID_ROWS = Math.floor(BOARD_HEIGHT / SCRATCH_RULES.grid_cell_size_px);
const BRUSH_WIDTH_PX = SCRATCH_RULES.brush_size.width;
const BRUSH_HEIGHT_PX = SCRATCH_RULES.brush_size.height;
let scratchBackgroundImage: HTMLImageElement | null = null;
let scratchSurfaceImage: HTMLImageElement | null = null;
let scratchImagesInitialized = false;
type CellRect = { cellX: number; cellY: number; widthCells: number; heightCells: number };
let cachedScratchIndicesRef: readonly number[] | null = null;
let cachedScratchIndicesLength = -1;
let cachedScratchedRevealRects: CellRect[] = [];
const scratchParticleBatch: DrawPointParticle[] = [];

function getTierConfig(tier: number) {
  return SCRATCH_CONFIG.reward_tiers[`tier_${tier}`] || { color: "#ffffff" };
}

function ensureScratchImagesLoaded() {
  if (scratchImagesInitialized || typeof Image === "undefined") return;

  scratchBackgroundImage = new Image();
  scratchBackgroundImage.src = "images/scratch_background.png";

  scratchSurfaceImage = new Image();
  scratchSurfaceImage.src = "images/scratch_surface.png";

  scratchImagesInitialized = true;
}

export function renderScratchCard(
  data: ScratchCardData,
  rect: { x: number; y: number; width: number; height: number },
  pointer: { x: number; y: number } | null
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;
  ensureScratchImagesLoaded();

  const state = getScratchCardState();
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;

  if (state === ScratchCardState.IDLE) {
    renderBonusTimeWelcomeCard(renderer, rect, {
      cardWidth: 580,
      cardHeight: 360,
      title: "SCRATCH CARD",
      bodyLines: [
        "Scratch to reveal hidden tiers.",
        "Position is cosmetic. Progress is cumulative."
      ],
      streakText: `Current streak: ${data.streak} day${data.streak === 1 ? "" : "s"}`,
      buttonText: "START",
      titleColor: "#ffbe4d",
      bodyColor: "#edf2f7",
      streakColor: "#52df87",
      accentColor: "#ffbe4d",
      glowColor: [255, 190, 77, 255],
      backgroundColor: "#1f1a12",
      buttonActive:
        !!(
          pointer &&
          pointer.x >= centerX - 120 &&
          pointer.x <= centerX + 120 &&
          pointer.y >= centerY + 70 &&
          pointer.y <= centerY + 120
        )
    });
    return;
  }

  if (!data.lastResult) {
    renderer.drawText({
      text: "GENERATING SCRATCH CARD...",
      x: centerX,
      y: centerY,
      font: BONUSTIME_TITLE_FONT,
      color: "#edf2f7",
      align: "center",
      baseline: "middle"
    });
    return;
  }

  const boardRect = getScratchCardBoardRect(rect);
  const scratchedPixels = getScratchCardScratchedPixels();
  const scratchedIndices = getScratchCardScratchedIndices();
  const revealVisuals = getScratchCardRevealVisuals();
  const particles = getScratchCardParticles();
  const budget = Math.max(1, data.lastResult.pixels_budget);
  const progressRatio = Math.min(1, scratchedPixels / budget);
  const nextReveal = data.lastResult.reveal_schedule[revealVisuals.length] || null;

  renderer.drawText({
    text: "SCRATCH CARD",
    x: rect.x + 40,
    y: rect.y + 40,
    font: BONUSTIME_TITLE_FONT,
    color: "#ffbe4d",
    align: "left",
    baseline: "middle"
  });

  renderer.drawText({
    text: `Scratched: ${Math.min(scratchedPixels, budget)} / ${budget} px`,
    x: rect.x + 40,
    y: rect.y + 82,
    font: BONUSTIME_BODY_FONT,
    color: "#e2e8f0",
    align: "left",
    baseline: "middle"
  });

  renderer.drawText({
    text: nextReveal
      ? `Next reveal in ${Math.max(0, nextReveal.pixels - scratchedPixels)} px`
      : "All reveals unlocked",
    x: rect.x + 40,
    y: rect.y + 110,
    font: BONUSTIME_BODY_FONT,
    color: nextReveal ? "#a0aec0" : "#52df87",
    align: "left",
    baseline: "middle"
  });

  drawProgressTrack(renderer, boardRect, progressRatio);

  renderer.drawGlowRect({
    x: boardRect.x,
    y: boardRect.y,
    width: boardRect.width,
    height: boardRect.height,
    color: [255, 198, 122, 255],
    radius: 10,
    intensity: 0.2,
    outerAlpha: 0.2
  });

  drawScratchBackground(renderer, boardRect);

  drawRevealVisuals(renderer, boardRect, revealVisuals);
  drawScratchSurface(renderer, boardRect, scratchedIndices, revealVisuals);
  drawParticles(renderer, boardRect, particles);
  drawBrushPreview(renderer, boardRect);
}

function drawScratchBackground(
  renderer: NonNullable<ReturnType<typeof getActiveWebGLRenderer>>,
  boardRect: { x: number; y: number; width: number; height: number }
) {
  const image = scratchBackgroundImage;
  if (image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
    renderer.drawImage({
      image,
      x: boardRect.x,
      y: boardRect.y,
      width: boardRect.width,
      height: boardRect.height
    });
    return;
  }

  renderer.drawGradientRect({
    x: boardRect.x,
    y: boardRect.y,
    width: boardRect.width,
    height: boardRect.height,
    colorStart: hexToRgba("#0f172a"),
    colorEnd: hexToRgba("#1e293b")
  });
}

function drawProgressTrack(
  renderer: NonNullable<ReturnType<typeof getActiveWebGLRenderer>>,
  boardRect: { x: number; y: number; width: number; height: number },
  progressRatio: number
) {
  const trackRect = {
    x: boardRect.x,
    y: boardRect.y + boardRect.height + 18,
    width: boardRect.width,
    height: 12
  };

  renderer.drawRect({
    x: trackRect.x,
    y: trackRect.y,
    width: trackRect.width,
    height: trackRect.height,
    color: hexToRgba("#162133")
  });

  renderer.drawGradientRect({
    x: trackRect.x,
    y: trackRect.y,
    width: trackRect.width * progressRatio,
    height: trackRect.height,
    colorStart: hexToRgba("#f6ad55"),
    colorEnd: hexToRgba("#ed8936")
  });
}

function drawRevealVisuals(
  renderer: NonNullable<ReturnType<typeof getActiveWebGLRenderer>>,
  boardRect: { x: number; y: number; width: number; height: number },
  revealVisuals: ReturnType<typeof getScratchCardRevealVisuals>
) {
  for (const reveal of revealVisuals) {
    const tierColor = getTierConfig(reveal.tier).color || "#ffffff";
    const x = boardRect.x + (reveal.cellX / GRID_COLS) * boardRect.width;
    const y = boardRect.y + (reveal.cellY / GRID_ROWS) * boardRect.height;
    const width = (reveal.sizeCells / GRID_COLS) * boardRect.width;
    const height = (reveal.sizeCells / GRID_ROWS) * boardRect.height;

    renderer.drawGlowRect({
      x,
      y,
      width,
      height,
      color: to255(hexToRgba(tierColor)),
      radius: 10,
      intensity: 0.52,
      outerAlpha: 0.28
    });

    renderer.drawRect({
      x,
      y,
      width,
      height,
      color: hexToRgba(tierColor, 0.22)
    });

    renderer.drawText({
      text: `T${reveal.tier}`,
      x: x + width / 2,
      y: y + height / 2,
      font: "bold 24px 'Outfit'",
      color: getRewardTierLabelColor(reveal.tier),
      align: "center",
      baseline: "middle"
    });
  }
}

function drawScratchSurface(
  renderer: NonNullable<ReturnType<typeof getActiveWebGLRenderer>>,
  boardRect: { x: number; y: number; width: number; height: number },
  scratchedIndices: readonly number[],
  revealVisuals: ReturnType<typeof getScratchCardRevealVisuals>
) {
  const image = scratchSurfaceImage;
  if (image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
    renderer.drawImage({
      image,
      x: boardRect.x,
      y: boardRect.y,
      width: boardRect.width,
      height: boardRect.height
    });
  } else {
    renderer.drawGradientRect({
      x: boardRect.x,
      y: boardRect.y,
      width: boardRect.width,
      height: boardRect.height,
      colorStart: hexToRgba("#5d4a34"),
      colorEnd: hexToRgba("#3d2f21")
    });
  }

  const cellWidth = boardRect.width / GRID_COLS;
  const cellHeight = boardRect.height / GRID_ROWS;
  const scratchedRects = buildScratchedRevealRects(scratchedIndices);

  for (const rect of scratchedRects) {
    const revealRect = {
      x: boardRect.x + rect.cellX * cellWidth,
      y: boardRect.y + rect.cellY * cellHeight,
      width: rect.widthCells * cellWidth + 0.4,
      height: rect.heightCells * cellHeight + 0.4
    };

    renderer.withScissorRect(revealRect, () => {
      drawScratchBackground(renderer, boardRect);
      drawRevealVisuals(renderer, boardRect, revealVisuals);
    });
  }
}

function buildScratchedRevealRects(scratchedIndices: readonly number[]): CellRect[] {
  if (
    cachedScratchIndicesRef === scratchedIndices &&
    cachedScratchIndicesLength === scratchedIndices.length
  ) {
    return cachedScratchedRevealRects;
  }

  if (scratchedIndices.length === 0) {
    cachedScratchIndicesRef = scratchedIndices;
    cachedScratchIndicesLength = 0;
    cachedScratchedRevealRects = [];
    return cachedScratchedRevealRects;
  }

  const mask = new Uint8Array(GRID_COLS * GRID_ROWS);
  for (const index of scratchedIndices) {
    if (index >= 0 && index < mask.length) {
      mask[index] = 1;
    }
  }

  const merged: CellRect[] = [];
  let activeBySpan = new Map<string, CellRect>();

  for (let row = 0; row < GRID_ROWS; row += 1) {
    const nextActiveBySpan = new Map<string, CellRect>();
    let col = 0;
    while (col < GRID_COLS) {
      const index = row * GRID_COLS + col;
      if (mask[index] === 0) {
        col += 1;
        continue;
      }

      const startCol = col;
      col += 1;
      while (col < GRID_COLS && mask[row * GRID_COLS + col] !== 0) {
        col += 1;
      }

      const widthCells = col - startCol;
      const key = `${startCol}:${widthCells}`;
      const active = activeBySpan.get(key);
      if (active && active.cellY + active.heightCells === row) {
        active.heightCells += 1;
        nextActiveBySpan.set(key, active);
      } else {
        const created: CellRect = { cellX: startCol, cellY: row, widthCells, heightCells: 1 };
        nextActiveBySpan.set(key, created);
      }
    }

    for (const [key, rect] of activeBySpan) {
      if (!nextActiveBySpan.has(key)) {
        merged.push(rect);
      }
    }

    activeBySpan = nextActiveBySpan;
  }

  for (const rect of activeBySpan.values()) {
    merged.push(rect);
  }

  cachedScratchIndicesRef = scratchedIndices;
  cachedScratchIndicesLength = scratchedIndices.length;
  cachedScratchedRevealRects = merged;
  return merged;
}

function drawParticles(
  renderer: NonNullable<ReturnType<typeof getActiveWebGLRenderer>>,
  boardRect: { x: number; y: number; width: number; height: number },
  particles: ReturnType<typeof getScratchCardParticles>
) {
  let writeCount = 0;
  for (const particle of particles) {
    const x = boardRect.x + (particle.x / BOARD_WIDTH) * boardRect.width;
    const y = boardRect.y + (particle.y / BOARD_HEIGHT) * boardRect.height;
    const diameter = (1 + Math.random()) * 10;
    const alpha = Math.max(0, Math.min(1, particle.alpha));
    if (alpha <= 0) continue;

    const existing = scratchParticleBatch[writeCount];
    if (existing) {
      existing.x = x;
      existing.y = y;
      existing.size = diameter;
      existing.color = [particle.color.r, particle.color.g, particle.color.b, alpha];
    } else {
      scratchParticleBatch.push({
        x,
        y,
        size: diameter,
        color: [particle.color.r, particle.color.g, particle.color.b, alpha]
      });
    }

    writeCount += 1;
  }

  scratchParticleBatch.length = writeCount;
  renderer.drawPointParticles({
    particles: scratchParticleBatch,
    blendMode: "additive"
  });
}

function drawBrushPreview(
  renderer: NonNullable<ReturnType<typeof getActiveWebGLRenderer>>,
  boardRect: { x: number; y: number; width: number; height: number }
) {
  if (getScratchCardState() !== ScratchCardState.PLAYING) return;
  const hover = getScratchCardHoverBoardPoint();
  if (!hover) return;

  const brushWidth = (BRUSH_WIDTH_PX / BOARD_WIDTH) * boardRect.width;
  const brushHeight = (BRUSH_HEIGHT_PX / BOARD_HEIGHT) * boardRect.height;
  const centerX = boardRect.x + (hover.x / BOARD_WIDTH) * boardRect.width;
  const centerY = boardRect.y + (hover.y / BOARD_HEIGHT) * boardRect.height;
  const x = centerX - brushWidth / 2;
  const y = centerY - brushHeight / 2;
  const color = hexToRgba("#ffbe4d", 0.92);
  const border = 1.5;

  renderer.drawRect({ x, y, width: brushWidth, height: border, color });
  renderer.drawRect({ x, y, width: border, height: brushHeight, color });
  renderer.drawRect({ x: x + brushWidth - border, y, width: border, height: brushHeight, color });
  renderer.drawRect({ x, y: y + brushHeight - border, width: brushWidth, height: border, color });
}
