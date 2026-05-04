import { PRIZE_WHEEL_SLICES, getPrizeWheelSliceByRewardId } from './index.js';

const TWO_PI = Math.PI * 2;
const POINTER_ANGLE = -Math.PI / 2;
const BASE_WHEEL_RADIUS = 142;

export function renderPrizeWheelStage(ctx, layout, result, reveal, now) {
  const stageRect = getStageRect(layout);
  const radius = getWheelRadius(stageRect);
  const scale = radius / BASE_WHEEL_RADIUS;
  const centerX = stageRect.x + (stageRect.width / 2);
  const centerY = stageRect.y + (stageRect.height * 0.47);
  const trackY = Math.min(
    centerY + radius + (40 * scale),
    stageRect.y + stageRect.height - (34 * scale)
  );
  const rotation = getWheelRotation(result, reveal, now);
  const slice = getStageSlice(result, reveal);
  const pulse = reveal.animating ? 0.5 + (Math.sin(now / 120) * 0.5) : 1;

  drawWheelGlow(ctx, centerX, centerY, slice, pulse, scale);
  drawWheel(ctx, centerX, centerY, radius, rotation, result, reveal, scale);
  drawWheelPointer(ctx, centerX, centerY, radius, scale);
  drawSpinTrack(ctx, centerX, trackY, result, reveal, scale);
}

function drawWheelGlow(ctx, centerX, centerY, slice, pulse, scale = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const radius = (118 + (pulse * 52)) * scale;
  const gradient = ctx.createRadialGradient(centerX, centerY, 14, centerX, centerY, radius);
  gradient.addColorStop(0, `${slice.color}cc`);
  gradient.addColorStop(0.38, `${slice.color}44`);
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, TWO_PI);
  ctx.fill();
  ctx.restore();
}

function drawWheel(ctx, centerX, centerY, radius, rotation, result, reveal, scale = 1) {
  const currentSpin = result?.spins?.[Math.max(0, reveal.currentRollIndex)] || null;

  ctx.save();
  ctx.shadowColor = currentSpin?.color || 'rgba(255, 255, 255, 0.35)';
  ctx.shadowBlur = (reveal.animating ? 14 : 22) * scale;

  for (const slice of PRIZE_WHEEL_SLICES) {
    const startAngle = slice.startAngle + rotation;
    const endAngle = slice.endAngle + rotation;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = slice.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(6, 10, 18, 0.78)';
    ctx.lineWidth = 2 * scale;
    ctx.stroke();
  }

  drawWheelLabels(ctx, centerX, centerY, radius, rotation, scale);

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, TWO_PI);
  ctx.strokeStyle = '#f4f8ff';
  ctx.lineWidth = 4 * scale;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(centerX, centerY, 38 * scale, 0, TWO_PI);
  ctx.fillStyle = '#142033';
  ctx.fill();
  ctx.strokeStyle = '#f4f8ff';
  ctx.lineWidth = 3 * scale;
  ctx.stroke();

  ctx.fillStyle = '#f4f8ff';
  ctx.font = `bold ${Math.round(18 * scale)}px Arial`;
  ctx.textAlign = 'center';
  ctx.fillText('SPIN', centerX, centerY + (6 * scale));
  ctx.restore();
}

function drawWheelLabels(ctx, centerX, centerY, radius, rotation, scale = 1) {
  for (const slice of PRIZE_WHEEL_SLICES) {
    const arcSize = slice.endAngle - slice.startAngle;
    if (arcSize < 0.03) {
      continue;
    }

    const angle = ((slice.startAngle + slice.endAngle) / 2) + rotation;
    const labelRadius = arcSize > 0.28 ? radius * 0.62 : radius * 0.82;
    const label = arcSize > 0.28 ? slice.shortLabel : String(slice.tier);
    const labelX = centerX + (Math.cos(angle) * labelRadius);
    const labelY = centerY + (Math.sin(angle) * labelRadius);

    ctx.save();
    ctx.translate(labelX, labelY);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = slice.tier <= 2 ? '#07101d' : '#f9fcff';
    ctx.font = arcSize > 0.28 ? `bold ${Math.round(12 * scale)}px Arial` : `bold ${Math.round(11 * scale)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, 4 * scale);
    ctx.restore();
  }

  drawTinySliceMarkers(ctx, centerX, centerY, radius, rotation, scale);
}

function drawTinySliceMarkers(ctx, centerX, centerY, radius, rotation, scale = 1) {
  const tinySlices = PRIZE_WHEEL_SLICES.filter((slice) => slice.chance < 0.015);

  for (let i = 0; i < tinySlices.length; i += 1) {
    const slice = tinySlices[i];
    const angle = ((slice.startAngle + slice.endAngle) / 2) + rotation;
    const lineStartX = centerX + (Math.cos(angle) * (radius - 4));
    const lineStartY = centerY + (Math.sin(angle) * (radius - 4));
    const markerX = centerX + (Math.cos(angle) * (radius + ((15 + (i * 8)) * scale)));
    const markerY = centerY + (Math.sin(angle) * (radius + ((15 + (i * 8)) * scale)));

    ctx.strokeStyle = slice.color;
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(lineStartX, lineStartY);
    ctx.lineTo(markerX, markerY);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(markerX, markerY, 9 * scale, 0, TWO_PI);
    ctx.fillStyle = '#111a2a';
    ctx.fill();
    ctx.strokeStyle = slice.color;
    ctx.stroke();

    ctx.fillStyle = '#f8fbff';
    ctx.font = `bold ${Math.round(10 * scale)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(String(slice.tier), markerX, markerY + (4 * scale));
  }
}

function drawWheelPointer(ctx, centerX, centerY, radius, scale = 1) {
  const tipY = centerY - radius + 12;

  ctx.save();
  ctx.shadowColor = 'rgba(255, 255, 255, 0.45)';
  ctx.shadowBlur = 10 * scale;
  ctx.beginPath();
  ctx.moveTo(centerX, tipY);
  ctx.lineTo(centerX - (18 * scale), centerY - radius - (30 * scale));
  ctx.lineTo(centerX + (18 * scale), centerY - radius - (30 * scale));
  ctx.closePath();
  ctx.fillStyle = '#f8fcff';
  ctx.fill();
  ctx.strokeStyle = '#111a2a';
  ctx.lineWidth = 2 * scale;
  ctx.stroke();
  ctx.restore();
}

function drawSpinTrack(ctx, centerX, y, result, reveal, scale = 1) {
  if (!result?.spins?.length) {
    return;
  }

  const gap = 54 * scale;
  const radius = 17 * scale;
  const startX = centerX - ((result.spins.length - 1) * gap) / 2;

  for (let i = 0; i < result.spins.length; i += 1) {
    const spin = result.spins[i];
    const x = startX + (i * gap);
    const revealed = i < reveal.visibleRollCount;
    const active = i === reveal.currentRollIndex && !reveal.complete;

    ctx.beginPath();
    ctx.arc(x, y, active ? 19 * scale : radius, 0, TWO_PI);
    ctx.fillStyle = revealed ? spin.color : '#263246';
    ctx.fill();
    ctx.strokeStyle = revealed ? '#ffffff' : active ? '#b8d7ff' : '#5f708a';
    ctx.lineWidth = (revealed && reveal.complete && spin.tier === result.tier ? 3 : active ? 2.5 : 1.5) * scale;
    ctx.stroke();

    ctx.fillStyle = revealed ? '#07101d' : '#9dadc2';
    ctx.font = `bold ${Math.round(12 * scale)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(revealed ? String(spin.tier) : '?', x, y + (5 * scale));
  }
}

function getStageRect(layout) {
  return layout.stageRect || {
    x: 80,
    y: 142,
    width: 1120,
    height: 526
  };
}

function getWheelRadius(stageRect) {
  return Math.max(120, Math.min(stageRect.width * 0.2, stageRect.height * 0.35, 210));
}

function getWheelRotation(result, reveal, now) {
  if (!result?.spins?.length) {
    return Math.sin(now / 1200) * 0.025;
  }

  if (reveal.complete) {
    return result.spins[result.spins.length - 1].targetRotation;
  }

  const currentIndex = Math.min(
    result.spins.length - 1,
    Math.max(0, reveal.currentRollIndex)
  );
  const currentSpin = result.spins[currentIndex];
  const previousRotation = currentIndex === 0
    ? 0
    : result.spins[currentIndex - 1].targetRotation;
  const progress = easeOutCubic(reveal.spinProgress);

  return previousRotation + ((currentSpin.targetRotation - previousRotation) * progress);
}

function getStageSlice(result, reveal) {
  if (!result?.spins?.length) {
    return getPrizeWheelSliceByRewardId('tier_1');
  }

  if (reveal.complete) {
    return getPrizeWheelSliceByRewardId(result.rewardId);
  }

  return result.spins[Math.max(0, reveal.currentRollIndex)] || getPrizeWheelSliceByRewardId('tier_1');
}

function easeOutCubic(value) {
  const progress = Math.min(Math.max(Number(value) || 0, 0), 1);
  return 1 - ((1 - progress) ** 3);
}
