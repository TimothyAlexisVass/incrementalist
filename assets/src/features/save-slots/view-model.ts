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

  return {
    activeSlot,
    slots: [0, 1, 2, 3].map((slotIndex) => ({
      slot_index: slotIndex,
      file_index: slotIndex,
      is_current: slotIndex === activeSlot,
      has_data: slotIndex === activeSlot,
      level: snapshot?.state.level ?? 1,
      rewards_claimed: snapshot?.state.progress_bar.rewards_claimed ?? 0,
      saved_at: snapshot?.state.saved_at ?? null,
      state_version: snapshot?.state_version ?? 0
    }))
  };
}
