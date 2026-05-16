import { noticeEvent } from "../../net/commands";
import { GameChannel } from "../../net/game-channel";
import type { GameSnapshot } from "../../net/protocol";

type CommandRunner = (cmd: () => Promise<any>) => void;

export class Notices {
  private snapshot: GameSnapshot | null = null;
  private shownSentByLeafId = new Set<string>();

  public setSnapshot(snapshot: GameSnapshot | null) {
    this.snapshot = snapshot;

    if (!snapshot) {
      this.shownSentByLeafId.clear();
      return;
    }

    const activeLeaves = new Set(snapshot.notices.active_leaf_ids);
    for (const sentId of Array.from(this.shownSentByLeafId)) {
      const pseudoParent = this.parentIdForPseudoLeaf(sentId);
      if (pseudoParent) {
        if (!snapshot.notices.active_parent_ids.includes(pseudoParent)) {
          this.shownSentByLeafId.delete(sentId);
        }
        continue;
      }

      if (!activeLeaves.has(sentId)) {
        this.shownSentByLeafId.delete(sentId);
      }
    }
  }

  public hasLeafNotice(id: string): boolean {
    if (!this.snapshot) return false;
    return this.snapshot.notices.active_leaf_ids.includes(id);
  }

  public hasParentNotice(parentId: string): boolean {
    if (!this.snapshot) return false;
    return this.snapshot.notices.active_parent_ids.includes(parentId);
  }

  public reportLeafVisible(
    leafId: string,
    isVisible: boolean,
    channel?: GameChannel,
    runCommand?: CommandRunner
  ) {
    if (!this.snapshot) return;
    if (!isVisible) return;
    if (!this.hasLeafNotice(leafId)) return;
    if (this.shownSentByLeafId.has(leafId)) return;
    if (!channel || !runCommand) return;

    this.shownSentByLeafId.add(leafId);
    runCommand(() => noticeEvent(channel, "child_shown", leafId));
  }

  public reportLeafClicked(
    leafId: string,
    channel?: GameChannel,
    runCommand?: CommandRunner
  ) {
    if (!this.snapshot) return;
    if (!this.hasLeafNotice(leafId)) return;
    if (!channel || !runCommand) return;

    runCommand(() => noticeEvent(channel, "child_clicked", leafId));
  }

  public reportParentVisibleViaPseudoLeaf(
    pseudoLeafId: string,
    parentId: string,
    isVisible: boolean,
    channel?: GameChannel,
    runCommand?: CommandRunner
  ) {
    if (!this.snapshot) return;
    if (!isVisible) return;
    if (!this.hasParentNotice(parentId)) return;
    if (!channel || !runCommand) return;
    if (this.shownSentByLeafId.has(pseudoLeafId)) return;

    this.shownSentByLeafId.add(pseudoLeafId);
    runCommand(() => noticeEvent(channel, "child_shown", pseudoLeafId));
  }

  private parentIdForPseudoLeaf(leafId: string): string | null {
    if (leafId === NOTICE_LEAF_AREA_DROPDOWN_BUTTON) return NOTICE_PARENT_AREA_DROPDOWN;
    if (leafId === NOTICE_LEAF_TAB_SHOP_BUTTON) return NOTICE_PARENT_MENU_MAIN;
    if (leafId === NOTICE_LEAF_TAB_QUEST_BUTTON) return NOTICE_PARENT_MENU_MAIN;
    if (leafId === NOTICE_LEAF_TAB_ACHIEVEMENTS_BUTTON) return NOTICE_PARENT_MENU_MAIN;
    if (leafId === NOTICE_LEAF_TAB_MENU_ANY_BUTTON) return NOTICE_PARENT_MENU_MAIN;

    if (leafId.startsWith("leaf.quest.") && leafId.endsWith(".claim_button")) {
      return NOTICE_PARENT_TAB_QUEST;
    }
    if (leafId.startsWith("leaf.achievement.") && leafId.endsWith(".unlocked")) {
      return NOTICE_PARENT_TAB_ACHIEVEMENTS;
    }

    return null;
  }
}

export const notices = new Notices();
export const NOTICE_PARENT_AREA_DROPDOWN = "parent.area.dropdown";
export const NOTICE_PARENT_MENU_MAIN = "parent.menu.main";
export const NOTICE_PARENT_TAB_SHOP = "parent.tab.shop";
export const NOTICE_PARENT_TAB_QUEST = "parent.tab.quest";
export const NOTICE_PARENT_TAB_ACHIEVEMENTS = "parent.tab.achievements";
export const NOTICE_LEAF_AREA_DROPDOWN_BUTTON = "leaf.area_dropdown.button";
export const NOTICE_LEAF_TAB_SHOP_BUTTON = "leaf.tab.shop.button";
export const NOTICE_LEAF_TAB_QUEST_BUTTON = "leaf.tab.quest.button";
export const NOTICE_LEAF_TAB_ACHIEVEMENTS_BUTTON = "leaf.tab.achievements.button";
export const NOTICE_LEAF_TAB_MENU_ANY_BUTTON = "leaf.tab.menu.any.button";
