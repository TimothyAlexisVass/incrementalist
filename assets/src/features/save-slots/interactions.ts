export function bindSaveSlotClicks(
  container: HTMLElement,
  onSelect: (slotIndex: number) => void
) {
  container.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest<HTMLButtonElement>("[data-slot-index]");
    if (!button) return;

    const slotIndex = Number(button.dataset.slotIndex);
    if (Number.isInteger(slotIndex)) onSelect(slotIndex);
  });
}
