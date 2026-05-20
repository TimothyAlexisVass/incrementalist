import bonusTimeConfig from "../../../../../shared/requirements/bonustime.json";
import { getActiveWebGLRenderer, RGBA } from "../../../renderer/webgl";
import { hexToRgba } from "../../../utils";
import {
  PlinkoDropData,
  PlinkoDropReplay,
  getPlinkoDropGapMs,
  getPlinkoLayout,
  getPlinkoStepDurationMs
} from "./view-model";
import {
  PlinkoState,
  getPlinkoAnimationStartedAt,
  getPlinkoState
} from "./interactions";
import { renderBonusTimeWelcomeCard } from "../flow";

type Point = { x: number; y: number };
type PegAlignment = "left" | "center";

const BALL_RADIUS_PX = 6;
const PEG_RADIUS_PX = 2;
const BALL_START_BIN_POSITION = 0;
const BIN_DELTA_PER_BOUNCE = 0.5;
const PEG_BOTTOM_GAP_PX = 5;
const PEG_TOP_PADDING_PX = 24;
const PEG_ROW_SPACING_SCALE = 0.86;
const BOUNCE_HEIGHT_SCALE = 0.76;

type BounceSegment = {
  step: number;
  roll: boolean;
  fromBinPosition: number;
  toBinPosition: number;
};

type PlaybackState = {
  activeDropIndex: number | null;
  activeDropElapsedMs: number;
  completedDrops: number;
  activeImpact: number;
  activeTier: number | null;
};

function getTierColor(tier: number): string {
  const key = `tier_${Math.max(1, Math.min(7, Math.round(tier)))}`;
  const config = (bonusTimeConfig.reward_tiers as Record<string, { color?: string }>)[key];
  return config?.color || "#ffffff";
}

export function renderPlinkoDrop(
  data: PlinkoDropData,
  rect: { x: number; y: number; width: number; height: number },
  _pointer: { x: number; y: number} | null
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const now = performance.now();
  const plinkoState = getPlinkoState();
  const animationStartedAt = getPlinkoAnimationStartedAt();
  const layout = getPlinkoLayout(rect);
  const stepMs = getPlinkoStepDurationMs();
  const dropGapMs = getPlinkoDropGapMs();

  if (plinkoState === PlinkoState.IDLE) {
    renderBonusTimeWelcomeCard(renderer, rect, {
      cardWidth: 500,
      cardHeight: 320,
      title: "PLINKO DROP",
      bodyLines: ["Drop the ball and chase the best landing lane."],
      buttonText: "DROP BALL",
      titleColor: "#ffbe4d",
      bodyColor: "#edf2f7",
      accentColor: "#ffbe4d",
      glowColor: [255, 190, 77, 255],
      backgroundColor: "#120d24",
      buttonActive: false
    });
    return;
  }

  const baseBallRadius = BALL_RADIUS_PX * layout.frame.scale;
  const pegRadius = PEG_RADIUS_PX * layout.frame.scale;

  drawPegBoard(data, layout.boardRect, layout.binsRect, pegRadius);

  const playback = resolvePlaybackState(
    data,
    plinkoState,
    animationStartedAt,
    now,
    stepMs,
    dropGapMs
  );

  // Ball is drawn first so it renders BEHIND the buckets
  const ballPosition = resolveBallPosition(data, layout.boardRect, layout.binsRect, playback);
  drawBall(ballPosition, baseBallRadius);

  // Bins are drawn last to visually mask the ball inside the bucket container
  drawBins(data, layout.binsRect, playback);
}

function drawPegBoard(
  data: PlinkoDropData,
  boardRect: { x: number; y: number; width: number; height: number },
  binsRect: { x: number; y: number; width: number; height: number },
  pegRadius: number
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  // Background explicitly scales down to meet the top of the tier boxes
  renderer.drawRect({
    x: boardRect.x,
    y: boardRect.y,
    width: boardRect.width,
    height: binsRect.y - boardRect.y,
    color: [9 / 255, 16 / 255, 29 / 255, 0.62]
  });

  const pegRows = buildPegRowsFromBottom(data.rows, data.lanes);

  for (const row of pegRows) {
    const rowFromTop = data.rows - 1 - row.bottomIndex;
    const y = rowCenterY(boardRect, binsRect, data.rows, rowFromTop);

    for (let pegIndex = 0; pegIndex < row.count; pegIndex += 1) {
      const x = rowPegX(binsRect, data.lanes, pegIndex, row.alignment);
      renderer.drawCircle(x, y, pegRadius, [0.0, 0.92, 1.0, 0.96], 0.08);
    }
  }
}

function drawBins(
  data: PlinkoDropData,
  binsRect: { x: number; y: number; width: number; height: number },
  playback: PlaybackState
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  const binWidth = binsRect.width / Math.max(1, data.lanes);
  const bestLane = getBestLane(data);
  const activeLane =
    playback.activeDropIndex !== null ? data.drops[playback.activeDropIndex]?.landingLane ?? null : null;

  for (let lane = 0; lane < data.lanes; lane += 1) {
    const x = binsRect.x + lane * binWidth;
    const tier = lane + 1;
    const isBestLane = bestLane !== null && lane === bestLane;
    const isActiveLane = activeLane !== null && lane === activeLane;
    const alpha = isActiveLane ? 0.94 : (isBestLane ? 0.86 : 0.78);
    const laneColor = hexToRgba(getTierColor(tier), alpha);
    const labelColor = getReadableTierLabelColor(laneColor);

    renderer.drawRect({
      x,
      y: binsRect.y,
      width: binWidth - 2,
      height: binsRect.height,
      color: laneColor
    });

    renderer.drawText({
      text: `TIER ${tier}`,
      x: x + binWidth / 2,
      y: binsRect.y + binsRect.height / 2,
      font: `${Math.max(11, Math.round(13 * (binsRect.height / 68)))}px Arial`,
      color: labelColor,
      align: "center",
      baseline: "middle"
    });
  }
}

function resolveBallPosition(
  data: PlinkoDropData,
  boardRect: { x: number; y: number; width: number; height: number },
  binsRect: { x: number; y: number; width: number; height: number },
  playback: PlaybackState
): Point {
  if (!data.drops.length) {
    return {
      x: binPositionToX(binsRect, data.lanes, BALL_START_BIN_POSITION),
      y: boardRect.y
    };
  }

  if (playback.activeDropIndex !== null) {
    const drop = data.drops[playback.activeDropIndex];
    return evaluateDropPosition(drop, data, boardRect, binsRect, playback.activeDropElapsedMs);
  }

  if (playback.completedDrops > 0) {
    const drop = data.drops[Math.min(playback.completedDrops - 1, data.drops.length - 1)];
    const scale = binsRect.height / 68;
    const bounceOffset = Math.max(6, BALL_RADIUS_PX * scale) + Math.max(2.6, PEG_RADIUS_PX * scale);
    
    return {
      x: binPositionToX(binsRect, data.lanes, laneToBinCenter(drop.landingLane)),
      y: binsRect.y + binsRect.height * 0.5 - bounceOffset
    };
  }

  return {
    x: binPositionToX(binsRect, data.lanes, BALL_START_BIN_POSITION),
    y: boardRect.y
  };
}

function drawBall(position: Point, radius: number) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  renderer.drawCircle(position.x, position.y, radius * 1.2, [1.0, 0.15, 0.15, 0.23], 0.82, "additive");
  renderer.drawCircle(position.x, position.y, radius, [0.98, 0.14, 0.12, 0.97], 0.08);
}

function resolvePlaybackState(
  data: PlinkoDropData,
  plinkoState: PlinkoState,
  animationStartedAt: number,
  now: number,
  stepMs: number,
  dropGapMs: number
): PlaybackState {
  if (!data.drops.length || plinkoState === PlinkoState.IDLE || animationStartedAt <= 0) {
    return {
      activeDropIndex: null,
      activeDropElapsedMs: 0,
      completedDrops: 0,
      activeImpact: 0,
      activeTier: null
    };
  }

  const perDropTravelMs = (data.rows + 1) * stepMs;
  const elapsed = Math.max(0, now - animationStartedAt);

  let completedDrops = 0;

  for (let dropIndex = 0; dropIndex < data.drops.length; dropIndex += 1) {
    const start = dropIndex * (perDropTravelMs + dropGapMs);
    const end = start + perDropTravelMs;

    if (elapsed < start) {
      return {
        activeDropIndex: null,
        activeDropElapsedMs: 0,
        completedDrops,
        activeImpact: 0,
        activeTier: null
      };
    }

    if (elapsed <= end) {
      const localMs = elapsed - start;
      return {
        activeDropIndex: dropIndex,
        activeDropElapsedMs: localMs,
        completedDrops,
        activeImpact: computeImpact(data.rows, stepMs, localMs),
        activeTier: data.drops[dropIndex]?.tier ?? null
      };
    }

    completedDrops = dropIndex + 1;
  }

  return {
    activeDropIndex: null,
    activeDropElapsedMs: 0,
    completedDrops,
    activeImpact: 0,
    activeTier: getBestTier(data)
  };
}

function computeImpact(rows: number, stepMs: number, localMs: number): number {
  if (localMs >= rows * stepMs) return 0;
  const stepElapsed = localMs % stepMs;
  const normalized = stepElapsed / stepMs;
  const distanceFromImpact = Math.abs(normalized - 0.5);
  return Math.max(0, 1 - distanceFromImpact * 2);
}

function evaluateDropPosition(
  drop: PlinkoDropReplay,
  data: PlinkoDropData,
  boardRect: { x: number; y: number; width: number; height: number },
  binsRect: { x: number; y: number; width: number; height: number },
  elapsedMs: number
): Point {
  const stepMs = getPlinkoStepDurationMs();
  const totalTravelMs = (data.rows + 1) * stepMs;
  
  if (elapsedMs >= totalTravelMs) {
    return {
      x: binPositionToX(binsRect, data.lanes, laneToBinCenter(drop.landingLane)),
      y: binsRect.y + binsRect.height * 0.5
    };
  }

  const step = Math.floor(elapsedMs / stepMs);
  const t = (elapsedMs - step * stepMs) / stepMs;

const segments = Array.from(buildBounceSegments(drop.rolls, data.lanes));
  const targetBinPosition = laneToBinCenter(drop.landingLane);

  // Calculate the combined radii offset using the same scaling logic
  const scale = binsRect.height / 68;
  const ballRadius = Math.max(6, BALL_RADIUS_PX * scale);
  const pegRadius = Math.max(2.6, PEG_RADIUS_PX * scale);
  const bounceOffset = ballRadius + pegRadius;

  // Offset the final bucket Y position by the same amount
  const targetY = binsRect.y + binsRect.height * 0.5 - bounceOffset;

  let startX: number;
  let startY: number;
  let endX: number;
  let endY: number;

  if (step === 0) {
    // Initial drop from rest position
    startX = binPositionToX(binsRect, data.lanes, BALL_START_BIN_POSITION);
    startY = boardRect.y;
    endX = binPositionToX(binsRect, data.lanes, segments[0]?.fromBinPosition ?? BALL_START_BIN_POSITION);
    endY = rowCenterY(boardRect, binsRect, data.rows, 0) - bounceOffset; // Subtract offset

    return {
      x: lerp(startX, endX, t),
      y: startY + (endY - startY) * t * t
    };
  } else if (step === data.rows) {
    // Final bounce segment: From the last row of pegs straight into the bucket
    startX = binPositionToX(binsRect, data.lanes, segments[data.rows - 1]?.fromBinPosition ?? BALL_START_BIN_POSITION);
    startY = rowCenterY(boardRect, binsRect, data.rows, data.rows - 1) - bounceOffset; // Subtract offset
    endX = binPositionToX(binsRect, data.lanes, targetBinPosition);
    endY = targetY;
  } else {
    // Standard continuous peg-to-peg bounce
    startX = binPositionToX(binsRect, data.lanes, segments[step - 1].fromBinPosition);
    startY = rowCenterY(boardRect, binsRect, data.rows, step - 1) - bounceOffset; // Subtract offset
    endX = binPositionToX(binsRect, data.lanes, segments[step]?.fromBinPosition ?? BALL_START_BIN_POSITION);
    endY = rowCenterY(boardRect, binsRect, data.rows, step) - bounceOffset; // Subtract offset
  }

  // Uniform Newtonian physics block applied across every single bounce step
  const rowHeight = endY - startY;
  const bounceHeight = Math.abs(rowHeight) * BOUNCE_HEIGHT_SCALE;
  const dy = endY - startY;
  
  const v0y = -2 * bounceHeight * (1 + Math.sqrt(1 + Math.max(0, dy / bounceHeight)));
  const g = 2 * (dy - v0y);

  return {
    x: lerp(startX, endX, t),
    y: startY + v0y * t + 0.5 * g * t * t
  };
}

function* buildBounceSegments(rolls: boolean[], lanes: number): Generator<BounceSegment> {
  let binPosition = BALL_START_BIN_POSITION;

  for (let step = 0; step < rolls.length; step += 1) {
    const roll = rolls[step] === true;
    const delta = roll ? BIN_DELTA_PER_BOUNCE : -BIN_DELTA_PER_BOUNCE;
    const nextBinPosition = clamp(binPosition + delta, 0, lanes);

    yield {
      step,
      roll,
      fromBinPosition: binPosition,
      toBinPosition: nextBinPosition
    };

    binPosition = nextBinPosition;
  }
}

function buildPegRowsFromBottom(rows: number, lanes: number): Array<{ bottomIndex: number; count: number; alignment: PegAlignment }> {
  const pegRows: Array<{ bottomIndex: number; count: number; alignment: PegAlignment }> = [];

  for (let bottomIndex = 0; bottomIndex < rows; bottomIndex += 1) {
    const count = Math.max(1, lanes - Math.floor((bottomIndex + 1) / 2));
    const alignment: PegAlignment = bottomIndex % 2 === 0 ? "left" : "center";
    pegRows.push({ bottomIndex, count, alignment });
  }

  return pegRows;
}

function rowPegX(
  binsRect: { x: number; y: number; width: number; height: number },
  lanes: number,
  pegIndex: number,
  alignment: PegAlignment
): number {
  const binWidth = binsRect.width / Math.max(1, lanes);
  const offset = alignment === "left" ? 0 : 0.5;
  // Shifted pegs 10px to the right
  return binsRect.x + (pegIndex + offset) * binWidth + 5;
}

function rowCenterY(
  boardRect: { x: number; y: number; width: number; height: number },
  binsRect: { x: number; y: number; width: number; height: number },
  rows: number,
  rowFromTop: number
): number {
  const scale = binsRect.height / 68;
  const topY = boardRect.y + PEG_TOP_PADDING_PX * scale;
  const bottomY = binsRect.y - PEG_BOTTOM_GAP_PX * scale;
  const fullStep = rows > 1 ? (bottomY - topY) / (rows - 1) : 0;
  const step = fullStep * PEG_ROW_SPACING_SCALE;
  const rowsFromBottom = (rows - 1) - rowFromTop;
  return bottomY - (rowsFromBottom * step);
}

function binPositionToX(
  boardRect: { x: number; y: number; width: number; height: number },
  lanes: number,
  binPosition: number
): number {
  // Shifted ball coordinate systems 10px to the right
  return boardRect.x + (clamp(binPosition, 0, lanes) / Math.max(1, lanes)) * boardRect.width + 5;
}

function laneToBinCenter(lane: number): number {
  return lane + 0.5;
}

function getBestTier(data: PlinkoDropData): number | null {
  if (!data.drops.length) return null;
  if (data.bestDropIndex !== null) return data.drops[data.bestDropIndex]?.tier ?? null;
  return data.drops.reduce((best, drop) => Math.max(best, drop.tier), 1);
}

function getBestLane(data: PlinkoDropData): number | null {
  if (!data.drops.length) return null;
  if (data.bestDropIndex !== null) return data.drops[data.bestDropIndex]?.landingLane ?? null;
  const bestTier = getBestTier(data);
  return bestTier !== null ? bestTier - 1 : null;
}

function lerp(from: number, to: number, t: number): number {
  return from + ((to - from) * t);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getReadableTierLabelColor(color: RGBA): string {
  const luminance = (0.2126 * color[0]) + (0.7152 * color[1]) + (0.0722 * color[2]);
  return luminance >= 0.62 ? "#0b1220" : "#f8fafc";
}
