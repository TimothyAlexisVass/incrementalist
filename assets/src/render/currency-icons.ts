import { formatNumber } from '../utils';
import { BigNum } from '../core/bignum';
import { getActiveWebGLRenderer } from '../renderer/webgl';

const currencyIconImages = new Map<string, HTMLImageElement>();
const smoothedCurrencyIconCanvases = new Map<string, HTMLCanvasElement>();

function getCurrencyIconImage(currencyKey: string) {
  if (!currencyKey || typeof Image === 'undefined') return null;
  if (!currencyIconImages.has(currencyKey)) {
    const image = new Image();
    image.src = `images/${currencyKey}.png`;
    currencyIconImages.set(currencyKey, image);
  }
  return currencyIconImages.get(currencyKey) || null;
}

export function drawCurrencyIcon(currencyKey: string, x: number, y: number, size: number) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer || size <= 0) {
    return;
  }
  const image = getCurrencyIconImage(currencyKey);
  if (!image) return;

  const iconSize = Math.max(1, Math.round(size));
  const renderSource = image.complete && image.naturalWidth > 0
    ? getSmoothedCurrencyIconCanvas(currencyKey, image, iconSize) || image
    : image;

  renderer.drawImage({
    image: renderSource,
    x,
    y,
    width: size,
    height: size,
    alpha: 1
  });
}

export function measureCurrencyAmount(amount: number | BigNum, iconSize: number, options: any = {}) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) return 0;
  const {
    font = 'bold 16px Arial',
    iconGap = 5,
    formatter = formatNumber
  } = options;
  const resolvedIconSize = resolveIconSize(iconSize);
  const amountText = formatter(amount);

  const textWidth = renderer.measureTextWidth({ text: amountText, font });

  return resolvedIconSize + iconGap + textWidth;
}

export function drawCurrencyAmount(
  currencyKey: string,
  amount: number | BigNum,
  x: number,
  y: number,
  iconSize: number,
  options: any = {}
) {
  const renderer = getActiveWebGLRenderer();
  if (!renderer) {
    return 0;
  }

  const {
    align = 'left',
    font = 'bold 16px Arial',
    textColor = '#ffffff',
    iconGap = 5,
    iconPosition = 'left',
    formatter = formatNumber,
    alpha = 1
  } = options;

  const resolvedIconSize = resolveIconSize(iconSize);
  const amountText = formatter(amount);
  const amountWidth = renderer.measureTextWidth({ text: amountText, font });
  const ascent = getFontPixelSize(font) * 0.75;
  const descent = getFontPixelSize(font) * 0.25;
  const width = resolvedIconSize + iconGap + amountWidth;

  let startX = x;
  if (align === 'center') {
    startX = x - width / 2;
  } else if (align === 'right') {
    startX = x - width;
  }

  const amountX = iconPosition === 'right'
    ? startX
    : startX + resolvedIconSize + iconGap;
  const iconX = iconPosition === 'right'
    ? startX + amountWidth + iconGap
    : startX;

  const textHeight = ascent + descent;
  const iconY = y - ascent + ((textHeight - resolvedIconSize) / 2);

  drawCurrencyIcon(currencyKey, iconX, iconY, resolvedIconSize);
  renderer.drawText({
    text: amountText,
    x: amountX,
    y,
    font,
    color: String(textColor),
    align: 'left',
    baseline: 'alphabetic',
    alpha,
    strokeColor: String(textColor),
    strokeWidth: 0.6
  });

  return width;
}

function getSmoothedCurrencyIconCanvas(currencyKey: string, image: HTMLImageElement, size: number) {
  if (typeof document === 'undefined') {
    return null;
  }

  const cacheKey = `${currencyKey}:${size}`;
  if (smoothedCurrencyIconCanvases.has(cacheKey)) {
    return smoothedCurrencyIconCanvases.get(cacheKey) || null;
  }

  const canvas = downsampleImage(image, size);
  smoothedCurrencyIconCanvases.set(cacheKey, canvas);
  return canvas;
}

function resolveIconSize(iconSize: number) {
  const size = Number(iconSize);
  return Number.isFinite(size) && size > 0 ? size : 16;
}

function getFontPixelSize(font: string) {
  const match = String(font || '').match(/(\d+(?:\.\d+)?)px/);
  return match ? Number(match[1]) : 16;
}

function downsampleImage(image: HTMLImageElement | HTMLCanvasElement, targetSize: number) {
  let source: HTMLImageElement | HTMLCanvasElement = image;
  let sourceWidth = 'naturalWidth' in image ? image.naturalWidth : image.width;
  let sourceHeight = 'naturalHeight' in image ? image.naturalHeight : image.height;

  while (sourceWidth > targetSize * 2 && sourceHeight > targetSize * 2) {
    const nextWidth = Math.max(targetSize, Math.round(sourceWidth / 2));
    const nextHeight = Math.max(targetSize, Math.round(sourceHeight / 2));
    const nextCanvas = createSmoothedCanvas(nextWidth, nextHeight);
    nextCanvas.getContext('2d')!.drawImage(source, 0, 0, nextWidth, nextHeight);
    source = nextCanvas;
    sourceWidth = nextWidth;
    sourceHeight = nextHeight;
  }

  const targetCanvas = createSmoothedCanvas(targetSize, targetSize);
  targetCanvas.getContext('2d')!.drawImage(source, 0, 0, targetSize, targetSize);
  return targetCanvas;
}

function createSmoothedCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const canvasContext = canvas.getContext('2d')!;
  canvasContext.imageSmoothingEnabled = true;
  canvasContext.imageSmoothingQuality = 'high';
  return canvas;
}
