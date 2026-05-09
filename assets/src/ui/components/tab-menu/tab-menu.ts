import { COLORS } from '../../../colors';
import { doButton } from '../button';
import { InteractionState } from '../../interaction-manager';
import { ServerState } from '../../../net/snapshots';
import { noticeSystem } from '../../notice-system';
import { noticeAck } from '../../../net/commands';
import { GameChannel } from '../../../net/game-channel';

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
  renderContent: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, input: InteractionState, state: ServerState, rect: Rect) => void;
  tickContent?: (dt: number) => void;
  noticeType?: 'shop_item' | 'area_unlock';
  noticeParentId?: string;
}

export interface TabMenuConfig {
  layout?: TabMenuLayout;
  position?: TabMenuPosition;
  tabHeight?: number;
  tabPadding?: number;
  gap?: number;
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

  public tick(dt: number) {
    const activeTab = this.tabs.find(t => t.id === this.activeTabId);
    if (activeTab?.tickContent) {
      activeTab.tickContent(dt);
    }
  }

  public render(
    ctx: CanvasRenderingContext2D, 
    canvas: HTMLCanvasElement, 
    input: InteractionState, 
    state: ServerState,
    containerRect: Rect,
    channel?: GameChannel,
    runCommand?: (cmd: () => Promise<any>) => void
  ) {
    const layout = this.config.layout || 'horizontal';
    const position = this.config.position || 'top-left';
    const tabHeight = this.config.tabHeight || 30;
    const tabPadding = this.config.tabPadding || 16;
    const gap = this.config.gap || 4;
    const font = this.config.font || 'bold 14px Arial';

    ctx.save();
    ctx.font = font;

    // Calculate text widths including optional hotkeys
    const textWidths = this.tabs.map(t => {
      const label = t.hotkey ? `${t.label} (${t.hotkey})` : t.label;
      return ctx.measureText(label).width;
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
          y: containerRect.y + tabHeight,
          width: containerRect.width,
          height: containerRect.height - tabHeight
        };
      } else {
        contentRect = {
          x: containerRect.x,
          y: containerRect.y,
          width: containerRect.width,
          height: containerRect.height - tabHeight
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
          x: containerRect.x + uniformTabWidth,
          y: containerRect.y,
          width: containerRect.width - uniformTabWidth,
          height: containerRect.height
        };
      } else {
        contentRect = {
          x: containerRect.x,
          y: containerRect.y,
          width: containerRect.width - uniformTabWidth,
          height: containerRect.height
        };
      }
    }

    ctx.restore();

    // Render Tab Buttons
    for (let i = 0; i < this.tabs.length; i++) {
      const tab = this.tabs[i];
      const rect = tabRects[i];
      const isActive = this.activeTabId === tab.id;

      let label = tab.label;
      if (tab.hotkey) {
        label += ` (${tab.hotkey})`;
      }

      const clicked = doButton(ctx, input, rect, label, {
        active: isActive || undefined,
        activeSurface: isActive ? COLORS.button.surface.active : COLORS.button.secondary.surface,
        inactiveSurface: isActive ? COLORS.button.surface.active : COLORS.button.secondary.surface,
        activeBorder: isActive ? COLORS.button.border.active : COLORS.button.secondary.border,
        inactiveBorder: isActive ? COLORS.button.border.active : COLORS.button.secondary.border,
        textColor: isActive ? COLORS.button.text : COLORS.button.secondary.text,
        font: font,
        showNotice:
          !isActive && tab.noticeType && tab.noticeParentId
            ? noticeSystem.hasParentNotice(tab.noticeParentId, tab.noticeType)
            : false
      });

      if (clicked) {
        this.activeTabId = tab.id;
        if (channel && runCommand && tab.noticeParentId && tab.noticeType && noticeSystem.hasParentNotice(tab.noticeParentId, tab.noticeType)) {
          const parentId = tab.noticeParentId;
          runCommand(() => noticeAck(channel, parentId));
        }
      }
    }

    // Render Content
    const activeTab = this.tabs.find(t => t.id === this.activeTabId);
    if (activeTab) {
      ctx.save();
      activeTab.renderContent(ctx, canvas, input, state, contentRect);
      ctx.restore();
    }
  }
}
