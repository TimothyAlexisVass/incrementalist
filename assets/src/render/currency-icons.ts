import { formatNumber } from '../utils';
import { BigNum } from '../core/bignum';
import { getActiveWebGLRenderer } from '../renderer/webgl';

const currencyIconImages = new Map<string, HTMLImageElement>();
type CurrencyAmountWidthMode = 'measured' | 'estimated';

function getCurrencyIconImage(currencyKey: string) {
  if (!currencyKey || typeof Image === 'undefined') return null;
  if (!currencyIconImages.has(currencyKey)) {
    const image = new Image();
    image.src = `images/resource/${currencyKey.replace(/_/g, '-')}.png`;
    currencyIconImages.set(currencyKey, image);
  }
  return currencyIconImages.get(currencyKey) || null;
}

export function drawCurrencyIcon(currencyKey: string, x: number, y: number, size: number) {
  const renderer = getActiveWebGLRenderer();
  if (size <= 0) {
    return;
  }
  const image = getCurrencyIconImage(currencyKey);
  if (!image || !image.complete || image.naturalWidth === 0) return;

  renderer.drawImage({
    image,
    x,
    y,
    width: size,
    height: size,
    alpha: 1
  });
}

export function measureCurrencyAmount(amount: number | BigNum, iconSize: number, options: any = {}) {
  const renderer = getActiveWebGLRenderer();
  const {
    font = 'bold 16px Arial',
    iconGap = 5,
    formatter = formatNumber,
    widthMode = 'measured'
  } = options;
  const resolvedIconSize = resolveIconSize(iconSize);
  const amountText = formatter(amount);
  const textWidth = resolveAmountTextWidth(renderer, amountText, font, widthMode);

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

  const {
    align = 'left',
    font = 'bold 16px Arial',
    textColor = '#ffffff',
    iconGap = 5,
    iconPosition = 'left',
    baseline = 'alphabetic',
    formatter = formatNumber,
    alpha = 1,
    widthMode = 'measured'
  } = options;

  const resolvedIconSize = resolveIconSize(iconSize);
  const amountText = formatter(amount);
  const amountWidth = resolveAmountTextWidth(renderer, amountText, font, widthMode);
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
  const iconY = computeIconYForBaseline(y, resolvedIconSize, textHeight, ascent, baseline);

  drawCurrencyIcon(currencyKey, iconX, iconY, resolvedIconSize);
  renderer.drawText({
    text: amountText,
    x: amountX,
    y,
    font,
    color: String(textColor),
    align: 'left',
    baseline,
    alpha,
    strokeColor: String(textColor),
    strokeWidth: 0.6
  });

  return width;
}

function resolveIconSize(iconSize: number) {
  const size = Number(iconSize);
  return Number.isFinite(size) && size > 0 ? size : 16;
}

function getFontPixelSize(font: string) {
  const match = String(font || '').match(/(\d+(?:\.\d+)?)px/);
  return match ? Number(match[1]) : 16;
}

function resolveAmountTextWidth(
  renderer: ReturnType<typeof getActiveWebGLRenderer>,
  text: string,
  font: string,
  widthMode: CurrencyAmountWidthMode
) {
  if (widthMode === 'estimated') {
    return estimateTextWidth(text, font);
  }

  return renderer.measureTextWidth({ text, font });
}

function estimateTextWidth(text: string, font: string) {
  return String(text ?? '').length * getFontPixelSize(font) * 0.62;
}

function computeIconYForBaseline(
  textY: number,
  iconSize: number,
  textHeight: number,
  ascent: number,
  baseline: CanvasTextBaseline
) {
  if (baseline === 'middle') {
    return textY - iconSize / 2;
  }
  if (baseline === 'top' || baseline === 'hanging') {
    return textY + ((textHeight - iconSize) / 2);
  }
  if (baseline === 'bottom') {
    return textY - textHeight + ((textHeight - iconSize) / 2);
  }

  return textY - ascent + ((textHeight - iconSize) / 2);
}
