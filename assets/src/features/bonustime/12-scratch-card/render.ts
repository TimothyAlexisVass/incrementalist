import bonusTimeConfig from "../../../../../shared/requirements/bonustime.json";
import { getActiveWebGLRenderer, type DrawPointParticle } from "../../../renderer/webgl";
import { hexToRgba } from "../../../utils";
import { getRewardTierLabelColor } from "../../../colors";
import { BONUSTIME_BODY_FONT, BONUSTIME_TITLE_FONT } from "../../../config";
import { isPointInBonusTimeWelcomeButton, renderBonusTimeWelcomeCard } from "../flow";
import {
  getScratchCardWelcomeLayout,
  getScratchCardBoardRect,
  SCRATCH_CARD_WELCOME_LAYOUT_OPTIONS,
  getScratchCardEndRewards,
  getScratchCardHoverBoardPoint,
  getScratchCardParticles,
  getScratchCardRevealVisuals,
  getScratchCardScratchedIndices,
  getScratchCardScratchedPixels,
  getScratchCardState,
  getScratchCardSurfaceAlpha,
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
let cachedProcessedScratchCount = 0;
const cachedScratchMask = new Uint8Array(GRID_COLS * GRID_ROWS);
const cachedDirtyRows = new Set<number>();
const cachedRowRects: CellRect[][] = Array.from({ length: GRID_ROWS }, () => []);
let cachedScratchedRevealRects: CellRect[] = [];
let cachedFlattenedRectsDirty = false;
const scratchParticleBatch: DrawPointParticle[] = [];

function getTierConfig(tier: number) {
  return SCRATCH_CONFIG.reward_tiers[`tier_${tier}`] || { color: "#ffffff" };
}

function ensureScratchImagesLoaded() {
  if (scratchImagesInitialized || typeof Image === "undefined") return;

  scratchBackgroundImage = new Image();
  scratchBackgroundImage.src = "images/bonustime/scratch-background.png";

  scratchSurfaceImage = new Image();
  scratchSurfaceImage.src = "images/bonustime/scratch-surface.png";

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
    const welcomeLayout = getScratchCardWelcomeLayout(rect);
    renderBonusTimeWelcomeCard(renderer, rect, {
      ...SCRATCH_CARD_WELCOME_LAYOUT_OPTIONS,
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
      glowColor: [1, 0.745, 0.302, 1],
      backgroundColor: "#1f1a12",
      buttonActive: isPointInBonusTimeWelcomeButton(pointer, welcomeLayout)
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
  const endRewards = getScratchCardEndRewards();
  const particles = getScratchCardParticles();
  const budget = Math.max(1, data.lastResult.pixels_budget);
  const progressRatio = Math.min(1, scratchedPixels / budget);
  const surfaceAlpha = getScratchCardSurfaceAlpha(performance.now());

  drawProgressTrack(renderer, boardRect, progressRatio);

  renderer.drawGlowRect({
    x: boardRect.x,
    y: boardRect.y,
    width: boardRect.width,
    height: boardRect.height,
    color: [1, 0.776, 0.478, 1],
    radius: 10,
    intensity: 0.2,
    outerAlpha: 0.2
  });

  drawScratchBackground(renderer, boardRect);

  drawRevealVisuals(renderer, boardRect, revealVisuals, 1);
  drawScratchSurface(renderer, boardRect, scratchedIndices, revealVisuals, surfaceAlpha);
  drawRevealVisuals(renderer, boardRect, endRewards, 0.2);
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
  reveals: ReadonlyArray<{ tier: number; cellX: number; cellY: number; sizeCells: number }>,
  alpha: number
) {
  const drawRewardTile = (reveal: { tier: number; cellX: number; cellY: number; sizeCells: number }) => {
    const tierColor = getTierConfig(reveal.tier).color || "#ffffff";
    const x = boardRect.x + (reveal.cellX / GRID_COLS) * boardRect.width;
    const y = boardRect.y + (reveal.cellY / GRID_ROWS) * boardRect.height;
    const width = (reveal.sizeCells / GRID_COLS) * boardRect.width;
    const height = (reveal.sizeCells / GRID_ROWS) * boardRect.height;

    renderer.drawRect({
      x,
      y,
      width,
      height,
      color: hexToRgba(tierColor, alpha)
    });

    renderer.drawText({
      text: `T${reveal.tier}`,
      x: x + width / 2,
      y: y + height / 2,
      font: "bold 19px 'Outfit'",
      color: getRewardTierLabelColor(reveal.tier),
      alpha,
      align: "center",
      baseline: "middle"
    });
  };

  for (const reveal of reveals) {
    drawRewardTile(reveal);
  }
}

function drawScratchSurface(
  renderer: NonNullable<ReturnType<typeof getActiveWebGLRenderer>>,
  boardRect: { x: number; y: number; width: number; height: number },
  scratchedIndices: readonly number[],
  revealVisuals: ReturnType<typeof getScratchCardRevealVisuals>,
  surfaceAlpha: number
) {
  const image = scratchSurfaceImage;
  if (image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
    renderer.drawImage({
      image,
      x: boardRect.x,
      y: boardRect.y,
      width: boardRect.width,
      height: boardRect.height,
      alpha: surfaceAlpha
    });
  } else {
    renderer.drawGradientRect({
      x: boardRect.x,
      y: boardRect.y,
      width: boardRect.width,
      height: boardRect.height,
      colorStart: hexToRgba("#5d4a34"),
      colorEnd: hexToRgba("#3d2f21"),
      alpha: surfaceAlpha
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
      drawRevealVisuals(renderer, boardRect, revealVisuals, 1);
    });
  }
}

function buildScratchedRevealRects(scratchedIndices: readonly number[]): CellRect[] {
  if (cachedScratchIndicesRef !== scratchedIndices || scratchedIndices.length < cachedProcessedScratchCount) {
    resetScratchedRevealRectCache(scratchedIndices);
  }

  if (scratchedIndices.length > cachedProcessedScratchCount) {
    for (let i = cachedProcessedScratchCount; i < scratchedIndices.length; i += 1) {
      const index = scratchedIndices[i];
      if (index < 0 || index >= cachedScratchMask.length) continue;
      if (cachedScratchMask[index] !== 0) continue;

      cachedScratchMask[index] = 1;
      const row = Math.floor(index / GRID_COLS);
      cachedDirtyRows.add(row);
    }
    cachedProcessedScratchCount = scratchedIndices.length;
  }

  if (cachedDirtyRows.size > 0) {
    for (const row of cachedDirtyRows) {
      rebuildRowScratchRects(row);
    }
    cachedDirtyRows.clear();
    cachedFlattenedRectsDirty = true;
  }

  if (cachedFlattenedRectsDirty) {
    rebuildFlattenedScratchRects();
  }

  return cachedScratchedRevealRects;
}

function resetScratchedRevealRectCache(scratchedIndices: readonly number[]) {
  cachedScratchIndicesRef = scratchedIndices;
  cachedProcessedScratchCount = 0;
  cachedScratchMask.fill(0);
  cachedDirtyRows.clear();
  for (const rowRects of cachedRowRects) {
    rowRects.length = 0;
  }
  cachedScratchedRevealRects.length = 0;
  cachedFlattenedRectsDirty = false;
}

function rebuildRowScratchRects(row: number) {
  const rowRects = cachedRowRects[row];
  rowRects.length = 0;

  const rowStart = row * GRID_COLS;
  let col = 0;
  while (col < GRID_COLS) {
    if (cachedScratchMask[rowStart + col] === 0) {
      col += 1;
      continue;
    }

    const startCol = col;
    col += 1;
    while (col < GRID_COLS && cachedScratchMask[rowStart + col] !== 0) {
      col += 1;
    }

    rowRects.push({
      cellX: startCol,
      cellY: row,
      widthCells: col - startCol,
      heightCells: 1
    });
  }
}

function rebuildFlattenedScratchRects() {
  cachedScratchedRevealRects.length = 0;
  for (const rowRects of cachedRowRects) {
    for (const rect of rowRects) {
      cachedScratchedRevealRects.push(rect);
    }
  }
  cachedFlattenedRectsDirty = false;
}

function drawParticles(
  renderer: NonNullable<ReturnType<typeof getActiveWebGLRenderer>>,
  boardRect: { x: number; y: number; width: number; height: number },
  particles: ReturnType<typeof getScratchCardParticles>
) {
  const particleScale = Math.max(boardRect.width / BOARD_WIDTH, boardRect.height / BOARD_HEIGHT);
  let writeCount = 0;
  for (const particle of particles) {
    const x = boardRect.x + (particle.x / BOARD_WIDTH) * boardRect.width;
    const y = boardRect.y + (particle.y / BOARD_HEIGHT) * boardRect.height;
    const diameter = Math.max(1, particle.size * particleScale * 4);
    const alpha = Math.max(0, Math.min(1, particle.alpha));
    if (alpha <= 0) continue;

    const existing = scratchParticleBatch[writeCount];
    if (existing) {
      existing.x = x;
      existing.y = y;
      existing.size = diameter;
      const color = existing.color as [number, number, number, number];
      color[0] = particle.color.r;
      color[1] = particle.color.g;
      color[2] = particle.color.b;
      color[3] = alpha;
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
