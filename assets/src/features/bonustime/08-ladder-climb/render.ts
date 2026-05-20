import { getActiveWebGLRenderer } from "../../../renderer/webgl";
import { hexToRgba } from "../../../utils";
import { isPointInWelcomeButton, renderBonusTimeWelcomeCard } from "../flow";
import {
  LadderClimbData,
  LADDER_CLIMB_VISIBLE_RUNGS,
  getLadderClimbAnimationDurationMs
} from "./view-model";
import {
  LadderClimbState,
  getLadderClimbAnimationStartedAt,
  getLadderClimbBoardRect,
  getLadderClimbCompletedStepCount,
  getLadderClimbState
} from "./interactions";

const LADDER_VIEWPORT_ROWS = 5;
const LADDER_TILE_GAP = 12;

export function renderLadderClimb(
  data: LadderClimbData,
  rect: { x: number; y: number; width: number; height: number },
  pointer: { x: number; y: number } | null
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const state = getLadderClimbState();

  if (state === LadderClimbState.IDLE) {
    renderBonusTimeWelcomeCard(renderer, rect, {
      cardWidth: 500,
      cardHeight: 330,
      title: "LADDER CLIMB",
      bodyLines: ["Click to climb step by step."],
      streakText: `Current Streak: ${data.streak}`,
      buttonText: "CLIMB",
      titleColor: "#ffbe4d",
      bodyColor: "#edf2f7",
      streakColor: "#52df87",
      accentColor: "#ffbe4d",
      backgroundColor: "#120d24",
      buttonActive: !!pointer && isPointInWelcomeButton(pointer, rect)
    });
    return;
  }

  const now = performance.now();
  const boardRect = getLadderClimbBoardRect(rect);
  const completedStepCount = getLadderClimbCompletedStepCount();
  const stepAnimationStartedAt = getLadderClimbAnimationStartedAt();
  const activeStep =
    state === LadderClimbState.REVEALING &&
    stepAnimationStartedAt > 0 &&
    completedStepCount < data.path.length
      ? data.path[completedStepCount]
      : null;
  const currentRung = getCurrentRung(data.path, completedStepCount);
  const focusRung = activeStep ? activeStep.from_rung : currentRung;
  const animationDurationMs = getLadderClimbAnimationDurationMs(data);
  const animationProgress = activeStep
    ? clamp((now - stepAnimationStartedAt) / animationDurationMs, 0, 1)
    : 1;
  const gapTotal = (LADDER_VIEWPORT_ROWS - 1) * LADDER_TILE_GAP;
  const tileSize = Math.max(52, (boardRect.height - gapTotal) / LADDER_VIEWPORT_ROWS);
  const stackStartY = boardRect.y;
  const tileX = boardRect.x + Math.max(0, (boardRect.width - tileSize) / 2);
  const windowStart = clamp(
    focusRung - Math.floor(LADDER_VIEWPORT_ROWS / 2),
    1,
    Math.max(1, LADDER_CLIMB_VISIBLE_RUNGS - LADDER_VIEWPORT_ROWS + 1)
  );
  const windowEnd = Math.min(LADDER_CLIMB_VISIBLE_RUNGS, windowStart + LADDER_VIEWPORT_ROWS - 1);

  renderer.drawGradientRect({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    colorStart: hexToRgba("#080d1a", 1),
    colorEnd: hexToRgba("#0f1830", 1),
    alpha: 1
  });

  renderer.drawRect({
    x: boardRect.x,
    y: boardRect.y,
    width: boardRect.width,
    height: boardRect.height,
    color: hexToRgba("#0b1220", 0.96)
  });

  const tileFill = hexToRgba("#d8e0eb", 0.92);
  const tileTop = hexToRgba("#ffffff", 0.16);
  const tileBottom = hexToRgba("#000000", 0.24);

  for (let offset = 0; offset < LADDER_VIEWPORT_ROWS; offset += 1) {
    const rung = windowEnd - offset;
    if (rung < windowStart) break;

    const tileY = stackStartY + (offset * (tileSize + LADDER_TILE_GAP));
    const tileRect = {
      x: tileX,
      y: tileY,
      width: tileSize,
      height: tileSize
    };

    renderer.drawRect({
      x: tileRect.x,
      y: tileRect.y,
      width: tileRect.width,
      height: tileRect.height,
      color: tileFill
    });

    renderer.drawRect({
      x: tileRect.x,
      y: tileRect.y,
      width: tileRect.width,
      height: 1,
      color: tileTop
    });

    renderer.drawRect({
      x: tileRect.x,
      y: tileRect.y + tileRect.height - 1,
      width: tileRect.width,
      height: 1,
      color: tileBottom
    });
  }

  drawMarker({
    activeStep,
    animationProgress,
    currentRung,
    tileX,
    tileSize,
    stackStartY,
    windowEnd
  });
}

function drawMarker(options: {
  activeStep: LadderClimbData["path"][number] | null;
  animationProgress: number;
  currentRung: number;
  tileX: number;
  tileSize: number;
  stackStartY: number;
  windowEnd: number;
}) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const markerX = options.tileX + (options.tileSize / 2);
  const currentY = rungCenterY(options.currentRung, options.tileSize, options.stackStartY, options.windowEnd);
  let markerY = currentY;
  const markerColor = hexToRgba("#ffbe4d", 1);

  if (options.activeStep) {
    const sourceY = rungCenterY(options.activeStep.from_rung, options.tileSize, options.stackStartY, options.windowEnd);
    const targetY = rungCenterY(options.activeStep.target_rung, options.tileSize, options.stackStartY, options.windowEnd);

    if (options.activeStep.success) {
      markerY = lerp(sourceY, targetY, easeOutCubic(options.animationProgress));
    } else {
      markerY = lerp(sourceY, targetY, Math.sin(Math.PI * options.animationProgress));
    }
  }

  const markerRadius = Math.max(8, Math.floor(options.tileSize * 0.16));

  renderer.drawCircle(markerX, markerY, markerRadius, markerColor, 1);
  renderer.drawCircle(markerX, markerY, Math.max(3, markerRadius - 5), hexToRgba("#0b1220", 1), 1);
}

function rungCenterY(
  rung: number,
  tileSize: number,
  stackStartY: number,
  windowEnd: number
) {
  const slotIndex = Math.max(0, windowEnd - rung);
  return stackStartY + (slotIndex * (tileSize + LADDER_TILE_GAP)) + (tileSize / 2);
}

function getCurrentRung(
  path: LadderClimbData["path"],
  completedStepCount: number
) {
  if (completedStepCount <= 0) return 1;
  const lastStep = path[Math.min(completedStepCount, path.length) - 1];
  return lastStep?.reached_rung ?? 1;
}

function isPointInWelcomeButton(
  pointer: { x: number; y: number } | null,
  rect: { x: number; y: number; width: number; height: number }
) {
  if (!pointer) return false;
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const buttonWidth = 240;
  const buttonHeight = 50;
  const buttonX = centerX - (buttonWidth / 2);
  const buttonY = centerY + 70;

  return pointer.x >= buttonX && pointer.x <= buttonX + buttonWidth && pointer.y >= buttonY && pointer.y <= buttonY + buttonHeight;
}

function lerp(a: number, b: number, t: number) {
  return a + ((b - a) * t);
}

function easeOutCubic(t: number) {
  const clamped = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - clamped, 3);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
