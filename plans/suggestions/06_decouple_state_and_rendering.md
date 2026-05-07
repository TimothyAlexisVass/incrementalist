# Suggestion: Decouple State Updates from Rendering Logic

## Context
In `assets/src/app.ts`, the application's rendering function (`renderDom()`) is manually invoked after every state mutation. For instance, within `runCommand`:
```typescript
  busy = true;
  serverState.loadingMessage = loadingMessage;
  // manual UI updates
  renderDom();

  try {
    await applyAndAck(await command());
  } catch (error) {
    serverState.statusTone = "error";
    serverState.status = error instanceof Error ? error.message : "Command failed";
    renderDom();
  } finally {
    // ...
    renderDom();
  }
```

## Problem
This imperative approach tightly couples state transitions to rendering, which creates several problems:
- **Maintainability**: Developers must remember to call `renderDom()` exactly when needed. If they forget, the UI becomes desynchronized from the actual `serverState`.
- **Performance**: Manually triggering renders can lead to unnecessary or duplicate renders, especially if multiple async commands resolve simultaneously or state updates happen in rapid succession.
- **Module Architecture**: It violates the separation of concerns. Network logic, business logic, and UI rendering are intertwined within procedural async workflows in a single file.

## Proposed Solution
Decouple the game state from the rendering pipeline by implementing a reactive state pattern or a central EventBus.

1. **Reactive Store**: Create an observable `Store` for the `serverState`. When actions (like commands succeeding) mutate the store, the store automatically emits a "changed" event.
2. **Game Loop / Render Loop**: The rendering pipeline should subscribe to these changes, or better yet, run independently via a `requestAnimationFrame` loop (leveraging `GameLoop` defined in `core/game-loop.ts`) that samples the state on every frame.

### Benefits
- **Code Consistency**: State updates are isolated and predictable.
- **Performance**: The view only rerenders predictably (e.g., batched on the next frame), eliminating layout thrashing or redundant DOM/Canvas draws.
- **Modularity**: Network code only cares about updating the data models, while UI code only cares about rendering whatever the current data model represents.
