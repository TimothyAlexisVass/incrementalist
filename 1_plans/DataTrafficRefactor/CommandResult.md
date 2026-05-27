# Command/Result Plan

## Goal
Keep command/result as the only durable gameplay transition lane, with existing idempotency and ACK semantics unchanged.

## Stays Command/Result (No Behavior Change)
- `progress.claim_reward`
- `progress.set_idle_mode`
- `sisu.refill`
- `sisu.upgrade_max`
- `shop.purchase`
- `area.select`
- `furnace.upgrade`
- `cloverfield.search`
- `cloverfield.confirm_discovery`
- `quest.claim`
- `bonustime.play` (all minigame actions/outcomes)
- `notice.event`
- `stats.mark_viewed`
- `stats.graduate_tutorial`
- `game.reset`
- `command.ack`

## Candidate Removals/Moves (After Push Soak)
Move out of command/result into push lanes:
- `time.sync` -> `global.tick`
- `progress.claim_in` -> `player.projection.tick`

Optional cleanup candidate:
- `game.noop` (if no longer needed operationally)

## Non-Negotiable Rules Preserved
- Durable transitions only from command execution.
- FIFO + dedupe + replay + ACK gating remain in `PlayerServer`.
- Queue acceptance/rejection/ack replies stay non-ACKed.
- `progress.claim_reward` `claim_not_ready` flow stays retry-until-non-error (no one-shot verify bounce).
- Pending claim UI behavior remains: keep bar visually at `0%` while resolution is pending.

## Client Handling Constraints
- Keep centralized merge path (`applyAuthoritativeData` + projection apply helpers).
- Do not add ad-hoc feature-local state mutation for command results.

## Acceptance
- Existing command tests stay green.
- No regression in replay/ACK behavior on reconnect.
- Claim reward loop behavior unchanged except reduced background sync traffic.
