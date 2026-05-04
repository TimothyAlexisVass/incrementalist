import { COLORS } from './colors.js';
import { formatNumber } from './format.js';

const CURRENCY_FALLBACK_COLORS = Object.freeze({
  coins: COLORS.hud.coins,
  shards: COLORS.hud.shards,
  cores: COLORS.hud.cores
});

const currencyIconImages = new Map();
const smoothedCurrencyIconCanvases = new Map();

function getCurrencyIconImage(currencyKey) {
  if (!currencyKey || typeof Image === 'undefined') {
    return null;
  }

  if (!currencyIconImages.has(currencyKey)) {
    const image = new Image();
    image.src = `images/${currencyKey}.png`;
    currencyIconImages.set(currencyKey, image);
  }

  return currencyIconImages.get(currencyKey);
}

export function drawCurrencyIcon(ctx, currencyKey, x, y, size) {
  if (!ctx || size <= 0) {
    return;
  }

  const image = getCurrencyIconImage(currencyKey);
  const iconSize = Math.max(1, Math.round(size));

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (image?.complete && image.naturalWidth > 0) {
    const smoothedIcon = getSmoothedCurrencyIconCanvas(currencyKey, image, iconSize);
    ctx.drawImage(smoothedIcon || image, x, y, size, size);
    ctx.restore();
    return;
  }

  ctx.fillStyle = CURRENCY_FALLBACK_COLORS[currencyKey] || COLORS.hud.textPrimary;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function measureCurrencyAmount(ctx, amount, iconSize, options = {}) {
  if (!ctx) {
    return 0;
  }

  const {
    font = ctx.font,
    iconGap = 5,
    formatter = formatNumber
  } = options;
  const resolvedIconSize = resolveIconSize(iconSize);

  ctx.save();
  ctx.font = font;
  const amountText = formatter(amount);
  const width = resolvedIconSize + iconGap + ctx.measureText(amountText).width;
  ctx.restore();

  return width;
}

export function drawCurrencyAmount(ctx, currencyKey, amount, x, y, iconSize, options = {}) {
  if (!ctx) {
    return 0;
  }

  const {
    align = 'left',
    font = ctx.font,
    textColor = ctx.fillStyle,
    iconGap = 5,
    iconPosition = 'left',
    formatter = formatNumber,
    alpha = 1
  } = options;
  const resolvedIconSize = resolveIconSize(iconSize);

  const amountText = formatter(amount);

  ctx.save();
  ctx.font = font;
  const amountMetrics = ctx.measureText(amountText);
  const width = resolvedIconSize + iconGap + amountMetrics.width;
  let startX = x;

  if (align === 'center') {
    startX = x - width / 2;
  } else if (align === 'right') {
    startX = x - width;
  }

  const fallbackFontSize = getFontPixelSize(font);
  const ascent = amountMetrics.actualBoundingBoxAscent || fallbackFontSize * 0.75;
  const descent = amountMetrics.actualBoundingBoxDescent || fallbackFontSize * 0.25;
  const textHeight = ascent + descent;
  const iconY = y - ascent + ((textHeight - resolvedIconSize) / 2);

  ctx.globalAlpha *= Math.max(0, Math.min(1, alpha));
  const amountX = iconPosition === 'right'
    ? startX
    : startX + resolvedIconSize + iconGap;
  const iconX = iconPosition === 'right'
    ? startX + amountMetrics.width + iconGap
    : startX;

  drawCurrencyIcon(ctx, currencyKey, iconX, iconY, resolvedIconSize);

  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.fillText(amountText, amountX, y);
  ctx.restore();

  return width;
}

function getSmoothedCurrencyIconCanvas(currencyKey, image, size) {
  if (typeof document === 'undefined') {
    return null;
  }

  const cacheKey = `${currencyKey}:${size}`;
  if (smoothedCurrencyIconCanvases.has(cacheKey)) {
    return smoothedCurrencyIconCanvases.get(cacheKey);
  }

  const canvas = downsampleImage(image, size);
  smoothedCurrencyIconCanvases.set(cacheKey, canvas);
  return canvas;
}

function getFontPixelSize(font) {
  const match = String(font || '').match(/(\d+(?:\.\d+)?)px/);
  return match ? Number(match[1]) : 16;
}

function resolveIconSize(iconSize) {
  const size = Number(iconSize);
  return Number.isFinite(size) && size > 0 ? size : 16;
}

function downsampleImage(image, targetSize) {
  let source = image;
  let sourceWidth = image.naturalWidth || image.width;
  let sourceHeight = image.naturalHeight || image.height;

  while (sourceWidth > targetSize * 2 && sourceHeight > targetSize * 2) {
    const nextWidth = Math.max(targetSize, Math.round(sourceWidth / 2));
    const nextHeight = Math.max(targetSize, Math.round(sourceHeight / 2));
    const nextCanvas = createSmoothedCanvas(nextWidth, nextHeight);
    nextCanvas.getContext('2d').drawImage(source, 0, 0, nextWidth, nextHeight);

    source = nextCanvas;
    sourceWidth = nextWidth;
    sourceHeight = nextHeight;
  }

  const targetCanvas = createSmoothedCanvas(targetSize, targetSize);
  targetCanvas.getContext('2d').drawImage(source, 0, 0, targetSize, targetSize);
  return targetCanvas;
}

function createSmoothedCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const canvasContext = canvas.getContext('2d');
  canvasContext.imageSmoothingEnabled = true;
  canvasContext.imageSmoothingQuality = 'high';

  return canvas;
}
