# Suggestion: Implement Automatic WebSocket Reconnection

## Context
The `GameChannel` class in `assets/src/net/game-channel.ts` is responsible for maintaining the WebSocket connection to the Phoenix backend. Currently, it listens for connection drops:
```typescript
  this.socket.addEventListener("close", () => this.stopHeartbeat());
```
However, it takes no action to automatically recover the connection.

## Problem
In a real-world web environment, WebSocket connections frequently drop due to network instability, backgrounding tabs on mobile devices, or server deployments. When the socket drops in the current implementation, the game simply stops responding to commands. The player receives a generic error or is forced to manually refresh the page. This violates best practices for live-service and continuous games.

## Proposed Solution
Implement a reconnection strategy with exponential backoff inside `GameChannel`.

1. When the `close` or `error` event is fired, do not just stop the heartbeat. Instead, schedule a call to `connect()` again.
2. Introduce an exponential backoff timer (e.g., attempt reconnecting after 1s, then 2s, 4s, 8s, up to a maximum interval) so that the server isn't DDoSed if it restarts.
3. Expose the connection state (e.g., `Connecting`, `Connected`, `Disconnected`, `Reconnecting`) so the UI can inform the player of the network status without allowing further inputs until recovery.

### Benefits
- **Best Practice Adherence**: Automatic, transparent reconnection is an industry standard for WebSocket-driven applications.
- **Player Experience**: Prevents progress loss and frustration caused by brief network hiccups.
- **Code Quality**: Encapsulates connection lifecycle management robustly within the networking module where it belongs.
