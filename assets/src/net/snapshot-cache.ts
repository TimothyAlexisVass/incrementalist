import type { GameSnapshot } from "./protocol";

export class SnapshotCache {
  private readonly username: string;

  constructor(username: string | null) {
    this.username = username ?? "anonymous";
  }

  private key(): string {
    return `incrementalist.snapshot.${this.username}`;
  }

  hasCachedSnapshot(): boolean {
    try {
      const raw = window.localStorage.getItem(this.key());
      if (!raw) return false;
      const data = JSON.parse(raw);
      return isUsableSnapshot(data);
    } catch {
      return false;
    }
  }

  save(snapshot: GameSnapshot): void {
    try {
      window.localStorage.setItem(this.key(), JSON.stringify(snapshot));
    } catch {
      // LocalStorage may be full or unavailable
    }
  }

  load(): GameSnapshot | null {
    try {
      const raw = window.localStorage.getItem(this.key());
      if (!raw) return null;
      const data = JSON.parse(raw);
      return isUsableSnapshot(data) ? data : null;
    } catch {
      return null;
    }
  }

  clear(): void {
    try {
      window.localStorage.removeItem(this.key());
    } catch {
      // Ignored
    }
  }
}

function isUsableSnapshot(data: any): data is GameSnapshot {
  if (!data || typeof data !== "object") return false;
  if (typeof data.type !== "string") return false;
  if (!data.state) return false;
  return true;
}
