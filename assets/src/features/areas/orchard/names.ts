export function humanizeSystemKey(systemKey: string): string {
  return systemKey
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
