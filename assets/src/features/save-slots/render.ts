import type { SaveSlotsViewModel } from "./view-model";

export function renderSaveSlots(container: HTMLElement, viewModel: SaveSlotsViewModel) {
  container.replaceChildren(
    ...viewModel.slots.map((slot) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "slot-button";
      button.dataset.slotIndex = String(slot.slot_index);
      button.dataset.current = String(slot.is_current || slot.slot_index === viewModel.activeSlot);

      const title = document.createElement("span");
      title.textContent = `File ${slot.slot_index + 1}`;

      const level = document.createElement("strong");
      level.textContent = slot.has_data ? `Level ${slot.level}` : "Empty";

      const rewards = document.createElement("small");
      rewards.textContent = `Rewards ${slot.rewards_claimed}`;

      button.append(title, level, rewards);
      return button;
    })
  );
}
