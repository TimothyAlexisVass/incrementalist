# Plan: Organize UI Managers

The UI managers currently live in `assets/src/ui/` but should be moved to a dedicated `assets/src/ui/managers/` folder to keep the UI root clean. Additionally, we will unify the naming convention to use plural nouns (where appropriate) and remove the redundant `-manager` or `-system` suffixes.

## Move & Rename Mapping

- `assets/src/ui/interaction-manager.ts` -> `assets/src/ui/managers/interactions.ts`
- `assets/src/ui/modal-manager.ts` -> `assets/src/ui/managers/modals.ts`
- `assets/src/ui/notice-system.ts` -> `assets/src/ui/managers/notices.ts`
- `assets/src/ui/overlay-manager.ts` -> `assets/src/ui/managers/overlays.ts`
- `assets/src/ui/ui-manager.ts` -> `assets/src/ui/managers/user-interface.ts`

## Tasks

1. [x] Move files to `assets/src/ui/managers/`.
2. [x] Update all imports in the codebase.
3. [x] Rename classes and instances to follow the new convention.
4. [x] Verify that the game still compiles and runs.