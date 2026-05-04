import { getChestTierByRewardId } from './index.js';

const TWO_PI = Math.PI * 2;

export function renderChestDrawStage(ctx, layout, result, reveal, now) {
  const stageRect = getStageRect(layout);
  const scale = getStageScale(stageRect);
  const tier = getStageTier(result, reveal);
  const shake = reveal.animating ? Math.sin(now / 34) * 5 * scale : 0;
  const pulse = reveal.animating ? 0.5 + (Math.sin(now / 95) * 0.5) : 1;
  const centerX = stageRect.x + (stageRect.width / 2) + shake;
  const centerY = stageRect.y + (stageRect.height * 0.43);
  const trackY = Math.min(
    centerY + (168 * scale),
    stageRect.y + stageRect.height - (34 * scale)
  );

  drawChestGlow(ctx, centerX, centerY, tier, pulse, scale);
  drawChest(ctx, centerX, centerY, tier, reveal, scale);
  drawRollTrack(ctx, centerX, trackY, result, reveal, scale);
}

function drawChestGlow(ctx, centerX, centerY, tier, pulse, scale = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const radius = (120 + (pulse * 46)) * scale;
  const gradient = ctx.createRadialGradient(centerX, centerY, 12, centerX, centerY, radius);
  gradient.addColorStop(0, `${tier.color}cc`);
  gradient.addColorStop(0.4, `${tier.color}55`);
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, TWO_PI);
  ctx.fill();
  ctx.restore();
}

function drawChest(ctx, centerX, centerY, tier, reveal, scale = 1) {
  const width = 188 * scale;
  const height = 126 * scale;
  const x = centerX - width / 2;
  const y = centerY - height / 2;
  const lidLift = (reveal.complete ? 20 : Math.max(0, reveal.visibleRollCount) * 2) * scale;

  ctx.save();
  ctx.shadowColor = tier.color;
  ctx.shadowBlur = (reveal.complete ? 28 : 12) * scale;

  ctx.fillStyle = '#4b2c20';
  ctx.fillRect(x + (10 * scale), y + (44 * scale), width - (20 * scale), height - (34 * scale));
  ctx.fillStyle = '#6d402d';
  ctx.fillRect(x + (18 * scale), y + (54 * scale), width - (36 * scale), height - (52 * scale));

  ctx.fillStyle = tier.color;
  ctx.globalAlpha = 0.55;
  ctx.fillRect(x + (18 * scale), y + (54 * scale), width - (36 * scale), 12 * scale);
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#271710';
  ctx.fillRect(x + (10 * scale), y + (84 * scale), width - (20 * scale), 8 * scale);

  ctx.fillStyle = '#5e3526';
  ctx.fillRect(x + (18 * scale), y + (22 * scale) - lidLift, width - (36 * scale), 42 * scale);
  ctx.fillStyle = '#7a4934';
  ctx.fillRect(x + (28 * scale), y + (30 * scale) - lidLift, width - (56 * scale), 20 * scale);

  ctx.strokeStyle = '#f1c36d';
  ctx.lineWidth = 5 * scale;
  ctx.strokeRect(x + (18 * scale), y + (22 * scale) - lidLift, width - (36 * scale), 42 * scale);
  ctx.strokeRect(x + (10 * scale), y + (44 * scale), width - (20 * scale), height - (34 * scale));

  ctx.fillStyle = '#f4d076';
  ctx.fillRect(centerX - (15 * scale), y + (74 * scale), 30 * scale, 34 * scale);
  ctx.fillStyle = '#5d3d15';
  ctx.fillRect(centerX - (5 * scale), y + (88 * scale), 10 * scale, 14 * scale);

  if (reveal.complete) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = tier.color;
    ctx.beginPath();
    ctx.moveTo(centerX - (58 * scale), y + (52 * scale));
    ctx.lineTo(centerX + (58 * scale), y + (52 * scale));
    ctx.lineTo(centerX + (24 * scale), y - (18 * scale));
    ctx.lineTo(centerX - (24 * scale), y - (18 * scale));
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawRollTrack(ctx, centerX, y, result, reveal, scale = 1) {
  if (!result?.rolls?.length) {
    return;
  }

  const gap = 54 * scale;
  const radius = 17 * scale;
  const startX = centerX - ((result.rolls.length - 1) * gap) / 2;

  for (let i = 0; i < result.rolls.length; i += 1) {
    const roll = result.rolls[i];
    const x = startX + (i * gap);
    const revealed = i < reveal.visibleRollCount;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TWO_PI);
    ctx.fillStyle = revealed ? roll.color : '#263246';
    ctx.fill();
    ctx.strokeStyle = revealed ? '#ffffff' : '#5f708a';
    ctx.lineWidth = (revealed && reveal.complete && roll.tier === result.tier ? 3 : 1.5) * scale;
    ctx.stroke();

    ctx.fillStyle = revealed ? '#07101d' : '#9dadc2';
    ctx.font = `bold ${Math.round(12 * scale)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(revealed ? String(roll.tier) : '?', x, y + (5 * scale));
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

function getStageScale(stageRect) {
  return Math.max(0.85, Math.min(stageRect.width / 720, stageRect.height / 330, 1.75));
}

function getStageTier(result, reveal) {
  if (!result) {
    return getChestTierByRewardId('tier_1');
  }

  if (reveal.complete) {
    return getChestTierByRewardId(result.rewardId);
  }

  const currentRoll = result.rolls?.[reveal.currentRollIndex];
  return currentRoll || getChestTierByRewardId('tier_1');
}
