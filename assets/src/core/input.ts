export function onClick(selector: string, callback: (event: MouseEvent) => void) {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing element ${selector}`);
  element.addEventListener("click", callback);
  return element;
}
