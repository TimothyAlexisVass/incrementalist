import { GameSnapshot } from "../net/protocol";
import { SAGE_TIPS } from "../features/areas/sage/tips";

export class NoticeSystem {
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
  public hasParentNotice(parentId: string, type: 'shop_item' | 'area_unlock' | 'sage_tip'): boolean {
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

    if (type === 'sage_tip') {
      const tips = Object.keys(SAGE_TIPS).map(Number).filter(l => l <= this.snapshot!.state.level);
      const maxTipLevel = tips.length > 0 ? Math.max(...tips) : 0;
      return maxTipLevel > lastAckLevel;
    }

    return false;
  }

  public hasAreaNotice(): boolean {
    return this.hasParentNotice('area_dropdown', 'area_unlock') || this.hasSageNotice();
  }

  public hasSageNotice(): boolean {
    return this.hasParentNotice('area_dropdown', 'sage_tip');
  }

  /**
   * Special case for the Menu button which aggregates multiple types.
   */
  public hasMenuNotice(): boolean {
    if (!this.snapshot) return false;
    const lastAckLevel = this.snapshot.notices.last_ack_level['menu_button'] ?? 0;
    
    // New Shop Items
    const hasNewShop = this.snapshot.state.shop.some(i => 
      !i.is_purchased && i.can_purchase && i.required_level > lastAckLevel
    );
    if (hasNewShop) return true;
    
    // New Areas
    const hasNewArea = this.snapshot.state.areas.some(a => 
      !a.is_locked && a.unlock_level > lastAckLevel
    );
    if (hasNewArea) return true;

    // New Sage Tips
    const tips = Object.keys(SAGE_TIPS).map(Number).filter(l => l <= this.snapshot.state.level);
    const maxTipLevel = tips.length > 0 ? Math.max(...tips) : 0;
    if (maxTipLevel > lastAckLevel) return true;

    // Add Quest/Achievement checks here later...
    
    return false;
  }
}

// Global instance for convenience, updated by GameClient
export const noticeSystem = new NoticeSystem();
