export function setButtonBusy(button: HTMLButtonElement, busy: boolean) {
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
}
