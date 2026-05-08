import { BigNum, formatScientific, toNumber } from './core/bignum';

export type DisplayMode = 'suffixed' | 'scientific';

let currentDisplayMode: DisplayMode = 'suffixed';

export function setDisplayMode(mode: DisplayMode) {
  currentDisplayMode = mode;
}

export function getDisplayMode(): DisplayMode {
  return currentDisplayMode;
}

export function toFiniteNumber(value: any, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatBigNum(value: BigNum): string {
  if (value.m === 0) return '0';

  if (currentDisplayMode === 'scientific') {
    return formatScientific(value, 3);
  }

  const sign = value.m < 0 ? '-' : '';
  const absM = Math.abs(value.m);
  const e = value.e;

  // Small numbers (less than 1,000)
  if (e < 3) {
    const num = toNumber(value);
    // If it's very small but positive, or zero, or negative but small
    if (Math.abs(num) < 1000) {
      // For fractional numbers, show up to 2 decimals
      if (Math.abs(num) < 1 && num !== 0) {
        return `${sign}${Math.round(absM * 10 ** e * 100) / 100}`;
      }
      return `${sign}${Math.floor(Math.abs(num))}`;
    }
  }

  // Suffixed mode
  const tier = Math.floor(e / 3);
  const suffix = getSuffix(tier);

  if (!suffix || suffix.startsWith('e')) {
    // Fallback to scientific if suffix is missing or just an exponent
    return formatScientific(value, 3);
  }

  const remainder = e % 3;
  const scaled = absM * 10 ** remainder;

  return `${sign}${Math.round(scaled * 1000) / 1000}${suffix}`;
}

/**
 * Legacy support for numbers, or for values that are guaranteed to be small.
 */
export function formatNumber(value: number | BigNum, fallback = 0): string {
  if (typeof value === 'object' && 'm' in value && 'e' in value) {
    return formatBigNum(value);
  }
  const num = toFiniteNumber(value, fallback);
  return formatBigNum({ m: num, e: 0 });
}

function getSuffix(tier: number): string {
  const base = [
    '', 'K', 'M', 'B', 'T',
    'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'
  ];

  if (tier < base.length) return base[tier];

  const ones = ['', 'U', 'D', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No'];
  const tens = ['', 'Dc', 'Vg', 'Tg', 'Qag', 'Qig', 'Sxg', 'Spg', 'Ocg', 'Nog'];

  const n = tier - 10;
  const one = n % 10;
  const ten = Math.floor(n / 10);

  return ten < tens.length ? `${ones[one]}${tens[ten]}` : `e${tier * 3}`;
}

export function formatInteger(value: any, fallback = 0): string {
  if (typeof value === 'object' && 'm' in value && 'e' in value) {
    return formatBigNum(value);
  }
  return Math.floor(toFiniteNumber(value, fallback)).toString();
}

export function formatLevel(value: any, fallback = 1): string {
  return `Level ${formatInteger(value, fallback)}`;
}

export function formatFileLabel(fileIndex: any, fallback = 0): string {
  return `File ${formatInteger(toFiniteNumber(fileIndex, fallback) + 1)}`;
}

export function formatNumberRatio(current: BigNum | number, maximum: BigNum | number): string {
  return `${formatNumber(current)} / ${formatNumber(maximum)}`;
}

export function formatCountRatio(current: any, maximum: any): string {
  return `${formatInteger(current)}/${formatInteger(maximum)}`;
}

export function formatNumberWithUnit(value: BigNum | number, unit: string): string {
  return `${formatNumber(value)} ${unit}`;
}

export function formatItemCount(value: any, singular: string, plural = `${singular}s`): string {
  const isBig = typeof value === 'object' && 'm' in value && 'e' in value;
  const count = isBig ? (value as BigNum).m : toFiniteNumber(value, 0);
  const isOne = isBig ? ((value as BigNum).m === 1 && (value as BigNum).e === 0) : Math.floor(count) === 1;
  const label = isOne ? singular : plural;
  return `${formatInteger(value)} ${label}`;
}

export function formatSignedNumber(value: BigNum | number): string {
  const isNegative = typeof value === 'object' && 'm' in value ? value.m < 0 : (value as number) < 0;
  return isNegative ? formatNumber(value) : `+${formatNumber(value)}`;
}

export function formatSignedNumberWithUnit(value: BigNum | number, unit: string): string {
  const isNegative = typeof value === 'object' && 'm' in value ? value.m < 0 : (value as number) < 0;
  return isNegative ? `${formatNumber(value)} ${unit}` : `+${formatNumber(value)} ${unit}`;
}

export function formatPercent(value: any, decimals = 2, fallback = 0): string {
  return `${toFiniteNumber(value, fallback).toFixed(decimals)}%`;
}

export function formatSignedPercent(value: any, decimals = 2, fallback = 0): string {
  const number = toFiniteNumber(value, fallback);
  const sign = number >= 0 ? '+' : '';
  return `${sign}${number.toFixed(decimals)}%`;
}

export function formatMultiplier(value: any, decimals = 2, fallback = 1): string {
  return `x${toFiniteNumber(value, fallback).toFixed(decimals)}`;
}

export function formatMultiplierDelta(value: any, decimals = 1, fallback = 0): string {
  const number = toFiniteNumber(value, fallback);
  const sign = number >= 0 ? '+' : '';
  return `${sign}${number.toFixed(decimals)}x`;
}

export function formatSisuMultiplier(value: any, minimum = 1): string {
  const sisu = Math.max(minimum, toFiniteNumber(value, minimum));
  const rounded = Math.round(sisu * 100) / 100;
  const formatted = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');

  return `\u00d7${formatted}`;
}

export function formatDecayPercentPerSecond(factor: any): string {
  return `-${formatPercent((1 - toFiniteNumber(factor, 1)) * 100, 0)}/s`;
}

export function formatTimestamp(timestamp: any, emptyText = 'Never', invalidText = 'Unknown'): string {
  const value = toFiniteNumber(timestamp, 0);
  if (value <= 0) {
    return emptyText;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return invalidText;
  }

  return date.toLocaleString();
}

