# Suggestion: Standardize Mutability and Encapsulation

## Context
In `assets/src/app.ts`, core application dependencies and state are maintained as mutable top-level module variables:
```typescript
const serverState = createServerState();
let channel: GameChannel;
let snapshotCache: SnapshotCache;
let busy = false;
```
Functions like `runCommand` directly read and mutate these variables, bypassing any centralized state manager or injection mechanism.

## Problem
Relying on module-level mutable state creates several code quality and maintenance issues:
- **Testability**: It is extremely difficult to write unit tests for functions that depend on global mutable state, because state leaks between test cases.
- **Code Quality**: Modules become heavily coupled to their own specific global environment rather than accepting dependencies explicitly.
- **Maintainability**: Tracking down where and when `busy` or `serverState` changes becomes difficult as the file grows, leading to unpredictable bugs and race conditions.

## Proposed Solution
Encapsulate the core application state and its dependencies into a dedicated class or structured object (e.g., `Application` or `GameClient`).

```typescript
class GameClient {
  private serverState: ServerState;
  private channel: GameChannel | null = null;
  private snapshotCache: SnapshotCache | null = null;
  private busy: boolean = false;

  constructor() {
    this.serverState = createServerState();
  }

  async boot() {
    // initialize channel and cache
  }

  async runCommand(command: () => Promise<ServerResult>) {
      // command logic here
  }
}

// Entry point
const app = new GameClient();
app.boot().catch(console.error);
```

### Benefits
- **Code Consistency**: Ensures state is mutated through strictly defined methods on the class instance.
- **Testability**: The `GameClient` can be instantiated fresh for every test case, and dependencies (like the network channel) can be easily mocked or injected.
- **Module Architecture**: Provides a clean boundary for application logic, making it easier to break up the file into smaller, more focused modules as the game grows.
