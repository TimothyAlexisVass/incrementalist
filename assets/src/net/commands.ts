import type {
  AckableCommandResult,
  CommandErrorResult,
  CommandPushResult,
  SaveSlotResetResult,
  SaveSlotsListResult,
  SaveSlotSwitchResult,
  ProgressClaimInResult,
  ProgressClaimRewardResult,
  ProgressSetIdleModeResult,
  AreaSelectResult,
  ShopPurchaseResult,
  NoticeSeeResult,
  NoticeAckResult
} from "./protocol";
import type { GameChannel } from "./game-channel";

// Save file commands
export function listSaveSlots(channel: GameChannel) {
  return channel.pushCommand<CommandPushResult<SaveSlotsListResult>>("save_slots.list");
}

export function switchSaveSlot(channel: GameChannel, slotIndex: number, hasCachedSnapshot: boolean) {
  return channel.pushCommand<CommandPushResult<SaveSlotSwitchResult | CommandErrorResult>>("save_slot.switch", {
    slot_index: slotIndex,
    has_cached_snapshot: hasCachedSnapshot
  });
}

export function resetSaveSlot(channel: GameChannel) {
  return channel.pushCommand<CommandPushResult<SaveSlotResetResult>>("save_slot.reset");
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

export function selectArea(channel: GameChannel, areaKey: string) {
  return channel.pushCommand<CommandPushResult<AreaSelectResult | CommandErrorResult>>("area.select", { area: areaKey });
}

export function shopPurchase(channel: GameChannel, itemId: string) {
  return channel.pushCommand<CommandPushResult<ShopPurchaseResult | CommandErrorResult>>("shop.purchase", { item_id: itemId });
}

export function noticeSee(channel: GameChannel, leafId: string, parentIds: string[] = []) {
  return channel.pushCommand<CommandPushResult<NoticeSeeResult | CommandErrorResult>>("notice.see", { 
    leaf_id: leafId,
    parent_ids: parentIds
  });
}

export function noticeAck(channel: GameChannel, parentId: string) {
  return channel.pushCommand<CommandPushResult<NoticeAckResult | CommandErrorResult>>("notice.ack", { 
    parent_id: parentId 
  });
}

export async function ackAppliedResult(
  channel: GameChannel,
  commandId: number
): Promise<AckableCommandResult | null> {
  const ack = await channel.ackCommand(commandId);
  return ack.released_result;
}
