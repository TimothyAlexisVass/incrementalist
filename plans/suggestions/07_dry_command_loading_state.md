# Suggestion: Abstract Loading States to Adhere to DRY

## Context
In `assets/src/app.ts`, handling the "busy" state during a network command requires manually identifying every possible interactive UI element and disabling/enabling it. 

For instance, inside `runCommand`:
```typescript
  busy = true;
  setButtonBusy(noopButton, true);
  setButtonBusy(saveButton, true);
  setButtonBusy(resetButton, true);
  // and manually iterating over slot list buttons
```
Then, inside the `finally` block, the exact same boilerplate is repeated to set them to `false`.

## Problem
This violates the DRY (Don't Repeat Yourself) principle. Every time a new interactive element is added to the UI (e.g., a "Purchase Upgrade" button), a developer must remember to add it to this manual list in `runCommand`. If forgotten, players could double-click an action, potentially desynchronizing the client state from the server queue or causing unintended side effects.

## Proposed Solution
Abstract the loading/busy state into a centralized UI container or generic state handler.

Since we also plan to migrate to a Canvas/WebGL renderer (see `05_migrate_ui_to_canvas.md`), the ideal solution is a global `InputManager` or an `UIOverlay` container that consumes a global `isBusy` state.

If remaining with DOM temporarily, it could be solved by:
```typescript
function setUIBusy(isBusy: boolean) {
  busy = isBusy;
  document.querySelectorAll<HTMLButtonElement>("button.action-btn").forEach(btn => {
      setButtonBusy(btn, isBusy);
  });
}
```

### Benefits
- **DRY**: Replaces redundant, error-prone boilerplate with a single unified call.
- **Maintainability**: Future UI elements will automatically respect the global loading state without modifying the core `runCommand` logic.
- **Robustness**: Reduces the risk of race conditions caused by players interacting with the UI while it waits for a server response.
