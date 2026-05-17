# Step 8: Notifications & Notices Review Plan

This step governs server-authoritative green-dot notifications, client notices managers, hierarchical parent/leaf visibility hooks, and cross-device clear actions.

## Core Architecture & Responsibilities

### Client (TypeScript)
- **Notice State Evaluation (`Notices`)**: Maintains parent/leaf active tables loaded directly from the authoritative server snapshot (`assets/src/ui/managers/notices.ts`):
  - Leaf nodes: Specific buttons (e.g., Quest Claim, Shop Purchase, Sage TIP).
  - Parent nodes: General navigation anchors (e.g., Main Menu, Shop Tab, Area Dropdown).
- **Visibility Trigger hooks (`reportLeafVisible` / `reportParentVisibleViaPseudoLeaf`)**: When a panel is rendered and a notification element is visible to the player, the client emits a `notice.event` command with the kind `child_shown`. This marks the event as "delivered" on the server.
- **Click Triggers (`reportLeafClicked`)**: When a marked element is clicked, emits `notice.event` with the kind `child_clicked` to remove the notification immediately on the server.
- **Hierarchical Bubble Markers (Green Dots)**: UI rendering functions inspect `notices.hasLeafNotice(id)` or `notices.hasParentNotice(parentId)` and draw small glowing green circles directly on tabs or buttons.

### Server (Elixir)
- **Notice Trees Sourcing (`lib/incrementalist/game/notices.ex`)**:
  - Dynamically builds the notice tree based on the active player state (e.g. quests ready to claim, shop items purchasable, features locked).
  - Updates active parent arrays: A parent is active if **any** nested leaf is active.
- **Event Handling (`notice.event` in `CommandExecutor`)**:
  - `child_shown`: Marks the leaf as shown, allowing the notice system to transition states once a click occurs.
  - `child_clicked`: Resolves and purges the notice, recalculating the tree and returning updated parent lists in the result.

---

## Step-by-Step Execution Verification Plan

### 1. Hierarchical Bubbling Verification
- **Verify**: A newly unlocked shop item triggers a green notification dot.
- **Verify**: The green dot propagates upwards, appearing on:
  - The specific item purchase button (leaf).
  - The Shop Tab button (parent).
  - The Main Menu trigger button (grandparent) on the BottomHUD.
- **Verify**: Removing the notice immediately clears the entire ancestral path.

### 2. Acknowledgment Visibility Dispatching
- **Verify**: Open a menu containing a leaf notice.
- **Verify**: The rendering of the button triggers `reportLeafVisible`, dispatching a `"notice.event"` command payload with `"event": "child_shown"`.
- **Verify**: Check that scrolling/visibility triggers only fire **once** using `shownSentByLeafId` set lookups, avoiding duplicate network command spam.

### 3. Click Clearing Propagation
- **Verify**: Click a notification leaf button.
- **Verify**: The click sends `"notice.event"` with `"event": "child_clicked"`.
- **Verify**: The server clears the notification, regenerates the notices tree, and returns the updated state.
- **Verify**: The green dots fade out instantly across the layout without any visual delays or residual markings.

### 4. Cross-Device Synchronization Verification
- **Verify**: Connect two separate clients (e.g., two tabs or browsers) to the same account.
- **Verify**: Clear a quest notification on Client A.
- **Verify**: Client B immediately receives the updated snapshot payload from the server and removes the green dot visual marks.
