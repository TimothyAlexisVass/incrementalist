# Phase 4: Canvas Menu Shell and Save Files

## Goal
Replace the temporary Phase 1 HTML scaffolding with a robust, Canvas-based UI system. This includes the bottom HUD menu button, a flexible overlay shell with top-aligned tabs, and the full "Save Files" functionality including slot switching and reset confirmation.

## Architecture: The UI Stack
To handle the complexity of overlapping UI elements and input priority, we will implement a tiered `UIManager`.

### 1. UIManager (`assets/src/ui/ui-manager.ts`)
The central coordinator for all Canvas UI.
- **Priority Stack**: `ModalManager` (Top) > `OverlayManager` (Middle) > Game World (Bottom).
- **Input Routing**: Intercepts `click`, `mousemove`, and `keydown` events. If a higher layer consumes the event, it does not propagate to lower layers.
- **Rendering**: Orchestrates the draw order to ensure modals always appear above overlays.

### 2. ModalManager (`assets/src/ui/components/modal-manager/`)
Handles high-priority, blocking UI elements.
- **Confirmation Modals**: Used for "Reset Slot" confirmation.
- **Loading Modal**: A non-dismissible modal that blocks input during "Switch" or "Reset" commands to prevent state contamination.
- **Backdrop**: Renders the global dimmed backdrop when any modal is active.

### 3. OverlayManager (`assets/src/ui/components/overlay-manager/`)
Handles the main menu shell.
- **Menu Shell**: Renders the outer frame, title (e.g., "Quest"), and the "Close" button.
- **State**: Manages the open/close visibility of the main menu.
- **Tab Integration**: Hosts the `TabMenu`.

## Component Breakdown

### TabMenu (`assets/src/ui/components/tab-menu/`)
A flexible component for switching between feature views.
- **Orientation**: Supports horizontal (top/bottom) and vertical (left/right) tab placement.
- **Responsibility**: Manages a row of tab buttons and a designated content box.
- **Nesting**: Supports nested instances (e.g., Quests -> Main/Daily).

### SaveSlotCard (`assets/src/ui/components/cards/save-slot/`)
Individual cards for the "Save Files" tab.
- **Display**: Slot number, Level, Coins, Shards, Cores, and "Last Saved" timestamp.
- **Actions**: "Switch" button and "Reset" button.
- **Hit Testing**: Encapsulated logic for button interactions within the card.

## Implementation Steps

### 1. Foundation
- Create `UIManager`, `ModalManager`, and `OverlayManager`.
- Initialize `UIManager` in `GameClient` and route events/ticks to it.
- Ensure individual components (Button, etc.) are available under `assets/src/ui/components/`.

### 2. The Menu Trigger
- Implement the "Menu [ESC]" button in the bottom-right of the Canvas HUD.
- Implement `Escape` key handling to toggle the `OverlayManager`.

### 3. The Menu Shell & Tab System
- Create the `MenuShell` component with the "Close" button.
- Implement the `TabMenu` with top-aligned tabs.
- Set up the main tabs: [Quest (Q)], [Achievements (A)], [Stats (E)], [Save Files], [Shop (S)]. (Non-Save tabs will be placeholders).

### 4. Save Files Tab
- Port the save slot rendering logic to `SaveSlotCard`.
- Implement the "Save Files" content renderer to display the 4 cards.
- Connect "Switch" button to `save_slot.switch` command.
- Connect "Reset" button to open the `ConfirmationModal`.

### 5. Transition Safety
- Implement the "Loading" modal in `ModalManager`.
- Update `GameClient` to open the "Loading" modal when a slot-changing command is sent and close it only after ACK.

### 6. Cleanup
- Remove the temporary Phase 1 HTML elements for save slots and reset buttons.
- Remove any associated DOM event listeners.

## Deliverables
- A fully functional Canvas-based menu accessible via the bottom HUD or `ESC`.
- A "Save Files" tab that allows switching and resetting slots.
- Robust input blocking via modals during critical transitions.
- No remaining temporary HTML gameplay controls.
