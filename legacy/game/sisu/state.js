import { SISU_BASE_MAX, SISU_PER_LEVEL, MAX_SISU_UPGRADE_LEVEL } from './levels.js';
import { COLORS } from '../colors.js';
import { toFiniteNumber } from '../format.js';
import { clampNumber, hexToRgbArray, lerp, lerpColor } from '../utils.js';

export const SISU_MIN_MULTIPLIER = 1;
const SISU_METER_LERP_SPEED_UP = 10;
const SISU_METER_LERP_SPEED_DOWN = 2;
const SISU_COLOR_LERP_SPEED = 10;
const SISU_VISUAL_SNAP_DISTANCE = 0.001;

export const SISU_REFILL_TIERS = Object.freeze({
  blue: { id: 'blue', label: 'Blue', colorKey: 'blue', multiplier: 1 },
  yellow: { id: 'yellow', label: 'Yellow', colorKey: 'yellow', multiplier: 1.5 },
  purple: { id: 'purple', label: 'Purple', colorKey: 'purple', multiplier: 2.5 }
});

export function createSisuState() {
  return {
    current: SISU_MIN_MULTIPLIER,
    displayCurrent: SISU_MIN_MULTIPLIER,
    displayColorCurrent: SISU_MIN_MULTIPLIER,
    displayColor: getSisuMeterColorArray(SISU_MIN_MULTIPLIER, SISU_BASE_MAX),
    maxBasic: SISU_BASE_MAX,
    maxUpgradeLevel: 0,
    decayTickRemainderMs: 0,
    diminishmentPerSecond: 3.5
  };
}

export function normalizeSisuState(rawSisu, fallbackCurrent = SISU_MIN_MULTIPLIER) {
  const source = isRecord(rawSisu) ? rawSisu : {};
  const base = createSisuState();
  const fallbackSisu = toPositiveNumber(fallbackCurrent, base.current);
  const maxUpgradeLevel = clampSisuUpgradeLevel(source.maxUpgradeLevel, base.maxUpgradeLevel);
  const maxBasic = SISU_BASE_MAX + (maxUpgradeLevel * SISU_PER_LEVEL);
  const current = Math.max(SISU_MIN_MULTIPLIER, toPositiveNumber(source.current, fallbackSisu));
  const displayCurrent = clampNumber(
    toFiniteNumber(source.displayCurrent, current),
    0,
    getSisuMeterMax(maxBasic)
  );
  const displayColorCurrent = clampNumber(
    toFiniteNumber(source.displayColorCurrent, displayCurrent),
    0,
    getSisuMeterMax(maxBasic)
  );
  const diminishmentPerSecond = Number(source.diminishmentPerSecond);

  return {
    current,
    displayCurrent,
    displayColorCurrent,
    displayColor: normalizeRgbArray(source.displayColor, getSisuMeterColorArray(displayColorCurrent, maxBasic)),
    maxBasic,
    maxUpgradeLevel,
    decayTickRemainderMs: Math.max(0, toFiniteNumber(source.decayTickRemainderMs, base.decayTickRemainderMs)),
    diminishmentPerSecond: Number.isFinite(diminishmentPerSecond)
      ? Math.max(0, diminishmentPerSecond)
      : base.diminishmentPerSecond
  };
}

export function updateSisuVisualState(state, deltaTime) {
  if (!state?.sisu || !state?.progressBar) {
    return null;
  }

  const maxBasic = toPositiveNumber(state.sisu.maxBasic, SISU_BASE_MAX);
  const maxSisu = getSisuMeterMax(maxBasic);
  const targetSisu = clampNumber(
    toFiniteNumber(state.progressBar.sisu, state.sisu.current ?? SISU_MIN_MULTIPLIER),
    0,
    maxSisu
  );
  const previousSisu = Number.isFinite(Number(state.sisu.displayCurrent))
    ? clampNumber(Number(state.sisu.displayCurrent), 0, maxSisu)
    : targetSisu;
  const previousColorSisu = Number.isFinite(Number(state.sisu.displayColorCurrent))
    ? clampNumber(Number(state.sisu.displayColorCurrent), 0, maxSisu)
    : previousSisu;
  const elapsedSeconds = Math.max(0, Number(deltaTime) || 0) / 1000;
  const meterSpeed = targetSisu >= previousSisu
    ? SISU_METER_LERP_SPEED_UP
    : SISU_METER_LERP_SPEED_DOWN;
  const meterT = clampNumber(1 - Math.exp(-meterSpeed * elapsedSeconds), 0, 1);
  const colorT = clampNumber(1 - Math.exp(-SISU_COLOR_LERP_SPEED * elapsedSeconds), 0, 1);
  const displayCurrent = Math.abs(targetSisu - previousSisu) <= SISU_VISUAL_SNAP_DISTANCE
    ? targetSisu
    : lerp(previousSisu, targetSisu, meterT);
  const displayColorCurrent = Math.abs(targetSisu - previousColorSisu) <= SISU_VISUAL_SNAP_DISTANCE
    ? targetSisu
    : lerp(previousColorSisu, targetSisu, colorT);

  state.sisu.displayCurrent = displayCurrent;
  state.sisu.displayColorCurrent = displayColorCurrent;
  state.sisu.displayColor = getSisuMeterColorArray(displayColorCurrent, maxBasic);

  return state.sisu;
}

export function getSisuMeterColorArray(sisuValue, maxBasic = SISU_BASE_MAX) {
  const blueMax = toPositiveNumber(maxBasic, SISU_BASE_MAX);
  const yellowMax = blueMax * SISU_REFILL_TIERS.yellow.multiplier;
  const purpleMax = blueMax * SISU_REFILL_TIERS.purple.multiplier;
  const sisu = clampNumber(toFiniteNumber(sisuValue, 0), 0, purpleMax);
  const darkBlue = hexToRgbArray(COLORS.sisu.darkBlue);
  const blue = hexToRgbArray(COLORS.sisu.blue);
  const yellow = hexToRgbArray(COLORS.sisu.yellow);
  const purple = hexToRgbArray(COLORS.sisu.purple);

  if (sisu <= blueMax) {
    return lerpColor(darkBlue, blue, blueMax > 0 ? sisu / blueMax : 0);
  }

  if (sisu <= yellowMax) {
    return lerpColor(blue, yellow, (sisu - blueMax) / Math.max(1, yellowMax - blueMax));
  }

  return lerpColor(yellow, purple, (sisu - yellowMax) / Math.max(1, purpleMax - yellowMax));
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toPositiveNumber(value, fallback) {
  const parsed = toFiniteNumber(value, fallback);
  return parsed > 0 ? parsed : fallback;
}

function clampSisuUpgradeLevel(value, fallback) {
  const parsed = Math.floor(toPositiveNumber(value, fallback));
  return Math.min(MAX_SISU_UPGRADE_LEVEL, Math.max(0, parsed));
}

function getSisuMeterMax(maxBasic) {
  return toPositiveNumber(maxBasic, SISU_BASE_MAX) * SISU_REFILL_TIERS.purple.multiplier;
}

function normalizeRgbArray(value, fallback) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const channels = value.slice(0, 3).map((channel, index) => {
    const parsed = Math.floor(toFiniteNumber(channel, fallback[index] ?? 0));
    return clampNumber(parsed, 0, 255);
  });

  return channels.length === 3 ? channels : fallback;
}
