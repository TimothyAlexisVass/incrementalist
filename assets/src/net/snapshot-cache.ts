import type { GameSnapshot } from "./protocol";

const slotCount = 4;

export class SnapshotCache {
  constructor(private readonly username: string | null) { }

  cachedSlotIndexes() {
    if (!this.username) return [];

    const indexes: number[] = [];

    for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
      if (this.load(slotIndex)) {
        indexes.push(slotIndex);
      }
    }

    return indexes;
  }

  load(slotIndex: number) {
    if (!this.username) return null;

    try {
      const encoded = window.localStorage.getItem(this.key(slotIndex));
      if (!encoded) return null;

      const snapshot = JSON.parse(encoded) as GameSnapshot;
      if (!isUsableSnapshot(snapshot, slotIndex)) {
        window.localStorage.removeItem(this.key(slotIndex));
        return null;
      }
      return snapshot;
    } catch {
      return null;
    }
  }

  save(snapshot: GameSnapshot) {
    if (!this.username) return;

    window.localStorage.setItem(this.key(snapshot.active_save_slot), JSON.stringify(snapshot));
  }

  private key(slotIndex: number) {
    return `incrementalist.snapshot.${this.username}.${slotIndex}`;
  }
}

function isUsableSnapshot(snapshot: GameSnapshot, slotIndex: number) {
  if (!snapshot || snapshot.type !== "game.snapshot") return false;
  if (snapshot.active_save_slot !== slotIndex) return false;
  if (!snapshot.state || typeof snapshot.state !== "object") return false;
  if (typeof snapshot.state.level !== "number") return false;
  if (typeof snapshot.state.idle_mode !== "boolean") return false;
  if (!("first_played_at" in snapshot.state)) return false;
  if (!snapshot.state.charge_crystals || typeof snapshot.state.charge_crystals !== "object") return false;
  if (!snapshot.state.sisu || typeof snapshot.state.sisu !== "object") return false;
  if (!snapshot.state.projection_params || typeof snapshot.state.projection_params !== "object") return false;
  return true;
}
