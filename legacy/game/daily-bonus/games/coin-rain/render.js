import { getGameMousePoint } from '../../../game.js';
import { spawnCoinRainItem } from './index.js';
import { COLORS } from '../../../colors.js';
import { COIN_RAIN_TIMER_FONT, COIN_RAIN_COUNTDOWN_FONT } from '../../../config.js';

let activeGame = null;

export function startCoinRainRender(ctx, bounds, parameters) {
  activeGame = {
    bounds,
    parameters,
    startTime: Date.now(),
    lastFrameTime: Date.now(),
    state: 'countdown', // countdown, playing, finished
    countdownValue: 3,
    bucketX: bounds.width / 2,
    items: [],
    caughtItems: [],
    spawnTimer: 0
  };
}

export function renderCoinRain(ctx, bounds) {
  if (!activeGame) return null;

  const now = Date.now();
  const dt = (now - activeGame.lastFrameTime) / 1000;
  activeGame.lastFrameTime = now;

  // Clear background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);

  if (activeGame.state === 'countdown') {
    const elapsed = (now - activeGame.startTime) / 1000;
    activeGame.countdownValue = Math.ceil(3 - elapsed);

    ctx.fillStyle = COLORS.coinRain.countdownText;
    ctx.font = COIN_RAIN_COUNTDOWN_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (activeGame.countdownValue > 0) {
      ctx.fillText(activeGame.countdownValue.toString(), bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    } else if (activeGame.countdownValue === 0) {
      ctx.fillText('GO!', bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    } else {
      activeGame.state = 'playing';
      activeGame.startTime = now;
    }
  } else if (activeGame.state === 'playing') {
    const elapsed = (now - activeGame.startTime) / 1000;
    const remaining = Math.max(0, activeGame.parameters.timer - elapsed);

    if (remaining <= 0) {
      activeGame.state = 'finished';
      return activeGame.caughtItems; // Signal end of game
    }

    // Spawn logic (approx 20 per second as per spec)
    activeGame.spawnTimer += dt;
    if (activeGame.spawnTimer >= 0.05) {
      activeGame.spawnTimer = 0;
      const item = spawnCoinRainItem(Math.random); // Fallback to Math.random for visual variance, stats use secureRandom
      activeGame.items.push({
        ...item,
        x: bounds.x + Math.random() * bounds.width,
        y: bounds.y,
        speed: 100 * item.speedMult // Base fall speed
      });
    }

    // Update bucket position based on mouse
    const mousePoint = getGameMousePoint();
    if (mousePoint && mousePoint.x >= bounds.x && mousePoint.x <= bounds.x + bounds.width) {
       // Simple tracking for now, can apply bucketSpeed limit later if needed
       activeGame.bucketX = mousePoint.x - bounds.x;
    }

    // Render timer
    ctx.fillStyle = COLORS.coinRain.timerText;
    ctx.font = COIN_RAIN_TIMER_FONT;
    ctx.textAlign = 'right';
    ctx.fillText(`${remaining.toFixed(1)}s`, bounds.x + bounds.width - 10, bounds.y + 30);

    // Update and render items
    for (let i = activeGame.items.length - 1; i >= 0; i--) {
      const item = activeGame.items[i];
      item.y += item.speed * dt;

      // Draw item
      if (item.type === 'coin') {
        ctx.fillStyle = COLORS.coinRain.itemCoins;
        ctx.beginPath();
        ctx.arc(item.x, item.y, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = COLORS.coinRain.itemReward;
        ctx.fillRect(item.x - 5, item.y - 5, 10, 10);
      }

      // Collision detection with bucket
      const bucketY = bounds.y + bounds.height - 30;
      const bucketLeft = bounds.x + activeGame.bucketX - activeGame.parameters.bucketWidth / 2;
      const bucketRight = bounds.x + activeGame.bucketX + activeGame.parameters.bucketWidth / 2;

      if (item.y >= bucketY && item.y <= bucketY + 20 && item.x >= bucketLeft && item.x <= bucketRight) {
        activeGame.caughtItems.push(item);
        activeGame.items.splice(i, 1);
      } else if (item.y > bounds.y + bounds.height) {
        activeGame.items.splice(i, 1);
      }
    }

    // Render bucket
    ctx.fillStyle = COLORS.coinRain.bucket;
    ctx.fillRect(
      bounds.x + activeGame.bucketX - activeGame.parameters.bucketWidth / 2,
      bounds.y + bounds.height - 30,
      activeGame.parameters.bucketWidth,
      20
    );
  }

  return null; // Not finished yet
}
