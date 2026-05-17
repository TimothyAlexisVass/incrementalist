import { COLORS } from '../../../colors';
import { doButton } from '../button';
import { InteractionState } from '../../managers/interactions';
import { ServerState } from '../../../net/snapshots';
import { notices } from '../../managers/notices';
import { GameChannel } from '../../../net/game-channel';
import { getActiveWebGLRenderer } from '../../../renderer/webgl';

export type TabMenuLayout = 'horizontal' | 'vertical';
export type TabMenuPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TabDefinition {
  id: string;
  label: string;
  hotkey?: string;
  renderContent: (canvas: HTMLCanvasElement, input: InteractionState, state: ServerState, rect: Rect) => void;
  tickContent?: (dt: number) => void;
  onLeave?: () => void;
  noticeParentId?: string;
  noticeLeafId?: string;
}

export interface TabMenuConfig {
  layout?: TabMenuLayout;
  position?: TabMenuPosition;
  tabHeight?: number;
  tabPadding?: number;
  gap?: number;
  contentGap?: number;
  font?: string;
}

export class TabMenu {
  private activeTabId: string;

  constructor(
    private tabs: TabDefinition[],
    private config: TabMenuConfig = {},
    initialTabId?: string
  ) {
    if (tabs.length === 0) {
      throw new Error("TabMenu must have at least one tab.");
    }
    this.activeTabId = initialTabId && tabs.some(t => t.id === initialTabId)
      ? initialTabId
      : tabs[0].id;
  }

  public getActiveTabId(): string {
    return this.activeTabId;
  }

  public setActiveTabId(id: string) {
    if (this.tabs.some(t => t.id === id)) {
      this.activeTabId = id;
    }
  }

  public triggerLeave() {
    const activeTab = this.tabs.find(t => t.id === this.activeTabId);
    if (activeTab?.onLeave) {
      activeTab.onLeave();
    }
  }

  public tick(dt: number) {
    const activeTab = this.tabs.find(t => t.id === this.activeTabId);
    if (activeTab?.tickContent) {
      activeTab.tickContent(dt);
    }
  }

  public render(
    canvas: HTMLCanvasElement,
    input: InteractionState,
    state: ServerState,
    containerRect: Rect,
    channel?: GameChannel,
    runCommand?: (cmd: () => Promise<any>) => void
  ) {
    const renderer = getActiveWebGLRenderer();

    const layout = this.config.layout || 'horizontal';
    const position = this.config.position || 'top-left';
    const tabHeight = this.config.tabHeight || 30;
    const tabPadding = this.config.tabPadding || 16;
    const gap = this.config.gap || 4;
    const contentGap = this.config.contentGap || 0;
    const font = this.config.font || 'bold 14px Arial';

    // Calculate text widths including optional hotkeys
    const textWidths = this.tabs.map(t => {
      const label = t.hotkey ? `${t.label} (${t.hotkey})` : t.label;
      return renderer.measureTextWidth({ text: label, font });
    });
    const maxTextWidth = Math.max(...textWidths);

    let contentRect: Rect;
    const tabRects: Rect[] = [];

    if (layout === 'horizontal') {
      const uniformTabWidth = maxTextWidth + tabPadding * 2;
      const totalUniformWidth = (uniformTabWidth * this.tabs.length) + (gap * (this.tabs.length - 1));

      let actualTabWidths: number[];

      if (totalUniformWidth > containerRect.width) {
        actualTabWidths = textWidths.map(w => w + tabPadding * 2);
      } else {
        actualTabWidths = this.tabs.map(() => uniformTabWidth);
      }

      const totalActualWidth = actualTabWidths.reduce((a, b) => a + b, 0) + (gap * (this.tabs.length - 1));

      // Determine starting X and Y
      let startX = containerRect.x;
      if (position === 'top-right' || position === 'bottom-right') {
        startX = containerRect.x + containerRect.width - totalActualWidth;
      }

      let startY = containerRect.y;
      if (position === 'bottom-left' || position === 'bottom-right') {
        startY = containerRect.y + containerRect.height - tabHeight;
      }

      // Calculate tab rects
      let currentX = startX;
      for (let i = 0; i < this.tabs.length; i++) {
        tabRects.push({
          x: currentX,
          y: startY,
          width: actualTabWidths[i],
          height: tabHeight
        });
        currentX += actualTabWidths[i] + gap;
      }

      // Calculate content rect
      if (position === 'top-left' || position === 'top-right') {
        contentRect = {
          x: containerRect.x,
          y: containerRect.y + tabHeight + contentGap,
          width: containerRect.width,
          height: containerRect.height - tabHeight - contentGap
        };
      } else {
        contentRect = {
          x: containerRect.x,
          y: containerRect.y,
          width: containerRect.width,
          height: containerRect.height - tabHeight - contentGap
        };
      }
    } else {
      // vertical layout
      const uniformTabWidth = maxTextWidth + tabPadding * 2;
      const totalHeight = (tabHeight * this.tabs.length) + (gap * (this.tabs.length - 1));

      let startX = containerRect.x;
      if (position === 'top-right' || position === 'bottom-right') {
        startX = containerRect.x + containerRect.width - uniformTabWidth;
      }

      let startY = containerRect.y;
      if (position === 'bottom-left' || position === 'bottom-right') {
        startY = containerRect.y + containerRect.height - totalHeight;
      }

      // Calculate tab rects
      let currentY = startY;
      for (let i = 0; i < this.tabs.length; i++) {
        tabRects.push({
          x: startX,
          y: currentY,
          width: uniformTabWidth,
          height: tabHeight
        });
        currentY += tabHeight + gap;
      }

      // Calculate content rect
      if (position === 'top-left' || position === 'bottom-left') {
        contentRect = {
          x: containerRect.x + uniformTabWidth + contentGap,
          y: containerRect.y,
          width: containerRect.width - uniformTabWidth - contentGap,
          height: containerRect.height
        };
      } else {
        contentRect = {
          x: containerRect.x,
          y: containerRect.y,
          width: containerRect.width - uniformTabWidth - contentGap,
          height: containerRect.height
        };
      }
    }

    // Render Tab Buttons
    for (let i = 0; i < this.tabs.length; i++) {
      const tab = this.tabs[i];
      const rect = tabRects[i];
      const isActive = this.activeTabId === tab.id;

      let label = tab.label;
      if (tab.hotkey) {
        label += ` [${tab.hotkey}]`;
      }

      const clicked = doButton(input, rect, label, {
        padding: 0,
        active: isActive || undefined,
        activeSurface: isActive ? COLORS.button.surface.active : COLORS.button.secondary.surface,
        inactiveSurface: isActive ? COLORS.button.surface.active : COLORS.button.secondary.surface,
        activeBorder: isActive ? COLORS.button.border.active : COLORS.button.secondary.border,
        inactiveBorder: isActive ? COLORS.button.border.active : COLORS.button.secondary.border,
        textColor: isActive ? COLORS.button.text : COLORS.button.secondary.text,
        font: font,
        showNotice: !isActive && tab.noticeParentId ? notices.hasParentNotice(tab.noticeParentId) : false
      });

      if (clicked) {
        const prevTab = this.tabs.find(t => t.id === this.activeTabId);
        if (prevTab && prevTab.id !== tab.id && prevTab.onLeave) {
          prevTab.onLeave();
        }
        this.activeTabId = tab.id;
        if (tab.noticeParentId) {
          notices.reportParentVisibleViaPseudoLeaf(
            tab.noticeLeafId || `leaf.tab.${tab.id}.button`,
            tab.noticeParentId,
            true,
            channel,
            runCommand
          );
        }
      }
    }

    // Render Content
    const activeTab = this.tabs.find(t => t.id === this.activeTabId);
    if (activeTab) {
      if (activeTab.noticeParentId) {
        notices.reportParentVisibleViaPseudoLeaf(
          activeTab.noticeLeafId || `leaf.tab.${activeTab.id}.button`,
          activeTab.noticeParentId,
          true,
          channel,
          runCommand
        );
      }

      activeTab.renderContent(canvas, input, state, contentRect);
    }
  }
}
