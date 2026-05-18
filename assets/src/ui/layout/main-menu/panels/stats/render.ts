import { COLORS } from '../../../../../colors';
import { ServerState } from '../../../../../net/snapshots';
import { getActiveWebGLRenderer } from '../../../../../renderer/webgl';
import { Rect } from '../../../../components/tab-menu/tab-menu';
import { InteractionState } from '../../../../managers/interactions';
import { getNetwork } from '../../view-model';
import { markViewed } from '../../../../../net/commands';
import { GameSnapshot } from '../../../../../net/protocol';
import { formatBigNum } from '../../../../../utils/format';
import { hexToRgba } from '../../../../../utils/color';

let lastViewedSnapshot: GameSnapshot | null = null;

export function renderStatsTab(
  _canvas: HTMLCanvasElement,
  _input: InteractionState,
  state: ServerState,
  rect: Rect
) {
  const snapshot = state.snapshot;
  if (!snapshot) return;

  if (snapshot !== lastViewedSnapshot && !snapshot.state.stats.screens_viewed_stats) {
    lastViewedSnapshot = snapshot;
    const { channel } = getNetwork();
    if (channel) {
      markViewed(channel, 'stats');
    }
  }

  const renderer = getActiveWebGLRenderer();
  if (!renderer) return;

  renderer.drawRect({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color: hexToRgba(COLORS.panel.bg)
  });

  const stats = snapshot.state.stats;
  const lines = [
    { label: 'Progress Bars Claimed', value: String(stats.total_progress_claims ?? 0) },
    { label: 'Achievements', value: String(stats.total_achievements ?? 0) },
    { label: 'Quests Completed', value: String(stats.total_quests_claimed ?? 0) },
    { label: 'Favor', value: String(stats.total_favor ?? 0) },
    { label: 'Days Played', value: String(stats.total_days_played ?? 0) },
    { label: 'Coins Earned', value: formatBigNum(stats.total_coins_earned) },
    { label: 'Shards Earned', value: formatBigNum(stats.total_shards_earned) },
    { label: 'Cores Earned', value: formatBigNum(stats.total_cores_earned) }
  ];

  let currentY = rect.y + 30;
  for (const line of lines) {
    renderer.drawText({
      text: line.label,
      x: rect.x + 30,
      y: currentY,
      font: '16px "Outfit"',
      color: COLORS.panel.textSecondary,
      align: 'left',
      baseline: 'top'
    });

    renderer.drawText({
      text: line.value,
      x: rect.x + rect.width - 30,
      y: currentY,
      font: '600 16px "Outfit"',
      color: COLORS.panel.textPrimary,
      align: 'right',
      baseline: 'top'
    });

    currentY += 32;
  }
}
