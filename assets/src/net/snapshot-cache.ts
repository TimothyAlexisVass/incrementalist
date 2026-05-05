import type { GameSnapshot } from "./protocol";

const slotCount = 4;

export class SnapshotCache {
  constructor(private readonly token: string | null) {}

  cachedSlotIndexes() {
    if (!this.token) return [];

    const indexes: number[] = [];

    for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
      if (this.load(slotIndex)) {
        indexes.push(slotIndex);
      }
    }

    return indexes;
  }

  load(slotIndex: number) {
    if (!this.token) return null;

    try {
      const encoded = window.localStorage.getItem(this.key(slotIndex));
      if (!encoded) return null;

      const snapshot = JSON.parse(encoded) as GameSnapshot;
      return snapshot?.type === "game.snapshot" && snapshot.active_save_slot === slotIndex ? snapshot : null;
    } catch {
      return null;
    }
  }

  save(snapshot: GameSnapshot) {
    if (!this.token) return;

    window.localStorage.setItem(this.key(snapshot.active_save_slot), JSON.stringify(snapshot));
  }

  private key(slotIndex: number) {
    return `incrementalist.snapshot.${this.token}.${slotIndex}`;
  }
}
