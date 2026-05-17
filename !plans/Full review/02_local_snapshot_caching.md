# Step 2: Local Snapshot Caching Review Plan

This step governs offline state caching, instant visual loading on boot, and the strict boundaries between local visual projection and authoritative server-driven state.

## Core Architecture & Responsibilities

### Client (TypeScript)
- **Instant Projection Sourcing**: On boot, if `SnapshotCache.hasCachedSnapshot()` returns `true`, the client loads this snapshot immediately using `SnapshotCache.load()` (`assets/src/net/snapshot-cache.ts`). This is fed into `getStateFromSnapshot(snapshot)` to present UI states instantly.
- **Boot Optimization Signaling**: The client sets `hasCachedSnapshot = true` in the Phoenix Socket payload. This tells the server it can omit the full game state JSON payload from the boot response, saving significant bandwidth.
- **Server State Reconciliation**: Once the server responds, it overrides projection parameters (`projection_params` and `idle_mode`) directly over the cached visual state, preventing visual stutter.
- **Strict Visual Boundary**: The cache must never store, read, or enforce authoritative indices like command queues, reward eligibility, quest completion, sisu refills, or buy limits. It is strictly a visual projection aid.
- **Durable Updates**: The cache is saved (`SnapshotCache.save(snapshot)`) upon receiving server results (`progress.claim_reward`, `shop.purchase`, etc.) to keep the visual projection relatively fresh.

### Server (Elixir)
- **Payload Minimization**: When `has_cached_snapshot` is `true` in the boot parameters, `PlayerServer` leaves the `snapshot` field in `game.boot` as `nil`.
- **Authoritative Handshake**: Regardless of local cache presence, the server always returns authoritative `projection_params` to align the client's visual ticks.

---

## Step-by-Step Execution Verification Plan

### 1. Instant Boot Projection Verification
- **Verify**: On application boot, the UI renders immediately using cached snapshot values before the Phoenix connection is established.
- **Verify**: Level, coins, shards, and cores display their cached values without throwing errors.
- **Verify**: The progress bar's initial visual projection matches its last cached state.

### 2. Network Payload Inspection
- **Verify**: Inspect Phoenix Channel traffic on boot. If local cache exists:
  - The handshake message contains `"has_cached_snapshot": true`.
  - The `game.boot` response contains `"snapshot": null`.
- **Verify**: If the cache is cleared or missing:
  - The handshake message contains `"has_cached_snapshot": false`.
  - The `game.boot` response contains the full `"snapshot"` object.

### 3. Server Reconciliation Alignment
- **Verify**: When `game.boot` arrives, the client applies the server's `projection_params` to the local projection.
- **Verify**: No visual flicker or layout jump occurs during this reconciliation.
- **Verify**: Any network state discrepancy (e.g., player completed an idle claim on another machine) is immediately reconciled without corruption.

### 4. Authoritative State Rules Violation Check
- **Verify**: Check that no client files ever consult `LocalStorage` for:
  - Command ID queue position.
  - Active mini-game pick indices or reveals.
  - Purchase eligibilities.
- **Rule Check**: LocalStorage must strictly remain a visual helper. Only server-directed snapshots are authoritative.
