export function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatNumber(value, fallback = 0) {
  const number = toFiniteNumber(value, fallback);
  const sign = number < 0 ? '-' : '';
  const absolute = Math.abs(number);

  if (absolute < 1000) {
    return `${sign}${Math.floor(absolute)}`;
  }

  const tier = Math.floor(Math.log10(absolute) / 3);
  const suffix = getSuffix(tier);
  const scaled = absolute / 10 ** (tier * 3);

  return `${sign}${Math.round(scaled * 1000) / 1000}${suffix}`;
}

function getSuffix(tier) {
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

export function formatInteger(value, fallback = 0) {
  return Math.floor(toFiniteNumber(value, fallback)).toString();
}

export function formatLevel(value, fallback = 1) {
  return `Level ${formatInteger(Math.max(1, toFiniteNumber(value, fallback)))}`;
}

export function formatShortLevel(value, fallback = 1) {
  return `Lv.${formatInteger(Math.max(1, toFiniteNumber(value, fallback)))}`;
}

export function formatFileLabel(fileIndex, fallback = 0) {
  return `File ${formatInteger(toFiniteNumber(fileIndex, fallback) + 1)}`;
}

export function formatNumberRatio(current, maximum) {
  return `${formatNumber(current)} / ${formatNumber(maximum)}`;
}

export function formatCountRatio(current, maximum) {
  return `${formatInteger(current)}/${formatInteger(maximum)}`;
}

export function formatNumberWithUnit(value, unit) {
  return `${formatNumber(value)} ${unit}`;
}

export function formatItemCount(value, singular, plural = `${singular}s`) {
  const count = Math.max(0, toFiniteNumber(value, 0));
  const label = Math.floor(count) === 1 ? singular : plural;
  return `${formatInteger(count)} ${label}`;
}

export function formatSignedNumber(value) {
  return `+${formatNumber(value)}`;
}

export function formatSignedNumberWithUnit(value, unit) {
  return `+${formatNumber(value)} ${unit}`;
}

export function formatPercent(value, decimals = 2, fallback = 0) {
  return `${toFiniteNumber(value, fallback).toFixed(decimals)}%`;
}

export function formatSignedPercent(value, decimals = 2, fallback = 0) {
  const number = toFiniteNumber(value, fallback);
  const sign = number >= 0 ? '+' : '';
  return `${sign}${number.toFixed(decimals)}%`;
}

export function formatMultiplier(value, decimals = 2, fallback = 1) {
  return `x${toFiniteNumber(value, fallback).toFixed(decimals)}`;
}

export function formatMultiplierDelta(value, decimals = 1, fallback = 0) {
  const number = toFiniteNumber(value, fallback);
  const sign = number >= 0 ? '+' : '';
  return `${sign}${number.toFixed(decimals)}x`;
}

export function formatSisuMultiplier(value, minimum = 1) {
  const sisu = Math.max(minimum, toFiniteNumber(value, minimum));
  const rounded = Math.round(sisu * 100) / 100;
  const formatted = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');

  return `\u00d7${formatted}`;
}

export function formatDecayPercentPerSecond(factor) {
  return `-${formatPercent((1 - toFiniteNumber(factor, 1)) * 100, 0)}/s`;
}

export function formatTimestamp(timestamp, emptyText = 'Never', invalidText = 'Unknown') {
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
