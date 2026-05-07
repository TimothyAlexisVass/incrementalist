# Suggestion: Migrate DOM-based UI to HTML5 Canvas / WebGL

## Context
The project architecture guidelines (found in memory) explicitly state that the game interface and effects must be strictly rendered using HTML5 Canvas and WebGL, and that HTML DOM elements should not be added or used for the game UI.
Currently, the codebase in `assets/src/app.ts` relies heavily on standard DOM manipulation. For example, it retrieves elements via `requiredElement<HTMLElement>` and directly modifies their `.textContent` and dataset attributes:
```typescript
const statusLine = requiredElement<HTMLElement>("#status-line");
const levelValue = requiredElement<HTMLElement>("#level-value");
// ...
statusLine.textContent = serverState.loadingMessage ?? serverState.status;
```
Similarly, components like `button.ts` directly manipulate `aria-busy` attributes and `disabled` states on `HTMLButtonElement`s.

## Problem
This violates the core architectural rule of the project. A standard DOM-based UI provides a different rendering path, event model, and performance profile than a WebGL or Canvas-based interface. Continuing to build features using the DOM will require significant rework later to align with the intended incremental game engine architecture. It also prevents the seamless integration of complex visual effects that WebGL enables.

## Proposed Solution
Refactor the frontend to eliminate DOM-based UI rendering.
1. Introduce a rendering library (e.g., PixiJS, Three.js, or a custom Canvas 2D engine) into the `assets` pipeline.
2. Replace all instances of `document.createElement`, `textContent` assignments, and DOM-based click listeners with a Canvas-based scene graph and interaction model.
3. The only HTML element in `index.html` should be the `<canvas id="game-canvas"></canvas>` itself.

### Benefits
- **Architecture Compliance**: Adheres strictly to the established rule that the UI must be Canvas/WebGL.
- **Performance**: Canvas/WebGL rendering is generally more performant for games with many moving parts, particle effects, and high-frequency updates typical of clicker/incremental games.
- **Visual Fidelity**: Enables smooth 1:1 replication of the legacy prototype's visual effects, which cannot be easily replicated using standard HTML/CSS.
