import { GameSnapshot } from "../../net/protocol";
import { SAGE_TIPS } from "../../features/areas/sage/tips";

export class Notices {
  private snapshot: GameSnapshot | null = null;

  public setSnapshot(snapshot: GameSnapshot | null) {
    this.snapshot = snapshot;
  }

  public hasLeafNotice(id: string): boolean {
    if (!this.snapshot) return false;
    return !this.snapshot.notices.seen_leaf_ids.includes(id);
  }

  /**
   * Checks if a parent element should show a notice dot.
   * A parent shows a dot if any of its children are "new" 
   * (unlocked at a level higher than the last time this parent was acknowledged).
   */
  public hasParentNotice(parentId: string, type: 'shop_item' | 'area_unlock' | 'quest' | 'achievement'): boolean {
    if (!this.snapshot) return false;
    const lastAckLevel = this.snapshot.notices.last_ack_level[parentId] ?? 0;
    
    if (type === 'shop_item') {
      return this.snapshot.state.shop.some(item => 
        !item.is_purchased && 
        item.can_purchase && 
        item.required_level > lastAckLevel
      );
    }
    
    if (type === 'area_unlock') {
      return this.snapshot.state.areas.some(area => 
        !area.is_locked && 
        area.unlock_level > lastAckLevel
      );
    }

    return false;
  }

  public hasAreaNotice(): boolean {
    if (!this.snapshot) return false;

    const currentArea = this.snapshot.state.area;
    const lastAckLevel = this.snapshot.notices.last_ack_level['area_dropdown'] ?? 0;

    return this.snapshot.state.areas.some(area =>
      area.key !== currentArea &&
      !area.is_locked &&
      area.unlock_level > lastAckLevel
    );
  }

  public hasSageNotice(): boolean {
    if (!this.snapshot) return false;

    return this.getUnlockedSageTipLevels().some((level) => this.hasLeafNotice(`sage_tip:${level}`));
  }

  /**
   * Special case for the Menu button which aggregates multiple types.
   */
  public hasMenuNotice(): boolean {
    if (!this.snapshot) return false;
    const lastAckLevel = this.snapshot.notices.last_ack_level['menu_button'] ?? 0;
    const currentArea = this.snapshot.state.area;
    
    // New Shop Items
    const hasNewShop = this.snapshot.state.shop.some(i => 
      !i.is_purchased && i.can_purchase && i.required_level > lastAckLevel
    );
    if (hasNewShop) return true;
    
    // New Areas
    const hasNewArea = this.snapshot.state.areas.some(a => 
      a.key !== currentArea &&
      !a.is_locked && a.unlock_level > lastAckLevel
    );
    if (hasNewArea) return true;

    // Add Quest/Achievement checks here later...
    
    return false;
  }

  private getUnlockedSageTipLevels(): number[] {
    if (!this.snapshot) return [];

    return Object.keys(SAGE_TIPS)
      .map(Number)
      .filter((level) => level <= this.snapshot!.state.level)
      .sort((a, b) => a - b);
  }
}

// Global instance for convenience, updated by GameClient
export const notices = new Notices();
