import type {
  AckableCommandResult,
  CommandErrorResult,
  CommandPushResult,
  GameResetResult,
  ProgressClaimInResult,
  ProgressClaimRewardResult,
  ProgressSetIdleModeResult,
  SisuRefillResult,
  SisuUpgradeMaxResult,
  AreaSelectResult,
  ShopPurchaseResult,
  StatsUpdateResult,
  NoticeEventResult,
  NoticeEventKind,
  BonusTimePlayResult
} from "./protocol";
import type { GameChannel } from "./game-channel";

// Game reset
export function resetGame(channel: GameChannel) {
  return channel.pushCommand<CommandPushResult<GameResetResult>>("game.reset");
}

export function progressClaimIn(channel: GameChannel) {
  return channel.pushCommand<CommandPushResult<ProgressClaimInResult>>("progress.claim_in");
}

export function progressClaimReward(channel: GameChannel) {
  return channel.pushCommand<CommandPushResult<ProgressClaimRewardResult | CommandErrorResult>>("progress.claim_reward");
}

export function progressSetIdleMode(channel: GameChannel, enabled: boolean) {
  return channel.pushCommand<CommandPushResult<ProgressSetIdleModeResult | CommandErrorResult>>("progress.set_idle_mode", { enabled });
}

export function sisuRefill(channel: GameChannel, tierId: string) {
  return channel.pushCommand<CommandPushResult<SisuRefillResult | CommandErrorResult>>("sisu.refill", { tier_id: tierId });
}

export function sisuUpgradeMax(channel: GameChannel) {
  return channel.pushCommand<CommandPushResult<SisuUpgradeMaxResult | CommandErrorResult>>("sisu.upgrade_max");
}

export function selectArea(channel: GameChannel, areaKey: string) {
  return channel.pushCommand<CommandPushResult<AreaSelectResult | CommandErrorResult>>("area.select", { area: areaKey });
}

export function shopPurchase(channel: GameChannel, itemId: string) {
  return channel.pushCommand<CommandPushResult<ShopPurchaseResult | CommandErrorResult>>("shop.purchase", { item_id: itemId });
}

export function noticeEvent(channel: GameChannel, event: NoticeEventKind, leafId: string) {
  return channel.pushCommand<CommandPushResult<NoticeEventResult | CommandErrorResult>>("notice.event", {
    event,
    leaf_id: leafId
  });
}

export function markViewed(channel: GameChannel, screenId: string) {
  return channel.pushCommand<CommandPushResult<StatsUpdateResult | CommandErrorResult>>("stats.mark_viewed", {
    screen_id: screenId
  });
}

export function graduateTutorial(channel: GameChannel) {
  return channel.pushCommand<CommandPushResult<StatsUpdateResult | CommandErrorResult>>("stats.graduate_tutorial");
}

export function playBonusTime(channel: GameChannel, gameId: string) {
  return channel.pushCommand<CommandPushResult<BonusTimePlayResult | CommandErrorResult>>("bonustime.play", {
    game: gameId
  });
}

export async function ackAppliedResult(
  channel: GameChannel,
  commandId: number
): Promise<AckableCommandResult | null> {
  const ack = await channel.ackCommand(commandId);
  return ack.released_result;
}
