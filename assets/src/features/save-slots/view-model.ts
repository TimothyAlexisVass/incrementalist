import type { GameSnapshot, SaveSlotSummary } from "../../net/protocol";

export type SaveSlotsViewModel = {
  activeSlot: number;
  slots: SaveSlotSummary[];
};

export function createSaveSlotsViewModel(
  snapshot: GameSnapshot | null,
  slots: SaveSlotSummary[]
): SaveSlotsViewModel {
  const activeSlot = snapshot?.active_save_slot ?? 0;

  if (slots.length > 0) {
    return { activeSlot, slots };
  }

  // The server may boot with only the active slot summary. Missing summaries are
  // placeholders for layout only and are replaced when `save_slots.list` returns.
  return {
    activeSlot,
    slots: [0, 1, 2, 3].map((slotIndex) => ({
      slot_index: slotIndex,
      file_index: slotIndex,
      is_current: slotIndex === activeSlot,
      has_data: slotIndex === activeSlot,
      level: snapshot?.state.level ?? 1,
      rewards_claimed: snapshot?.state.progress_bar.rewards_claimed ?? 0,
      saved_at: snapshot?.save_slot.saved_at ?? null
    }))
  };
}
