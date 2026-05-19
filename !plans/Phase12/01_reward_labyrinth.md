# Phase 12, Step 1: Reward Labyrinth

## 1. Game Concept & Rules

The **Reward Labyrinth** is an interactive maze exploration mini-game. The player navigates a character or cursor through a network of connected rooms (nodes) in a labyrinth to search for hidden reward items, using a step budget that scales with their daily login streak.

### Core Rules:
1. **Entrance**: The player starts outside the maze and clicks `Enter` to step into the starting node. Once entered, the entrance path locks behind them; the player cannot exit back to the start area.
2. **Navigation**: 
   - The labyrinth is composed of interconnected rooms.
   - At each room, the player can choose to move in any valid direction where a path exists: North (Forward), South (Back), East (Right), West (Left).
   - The labyrinth has no overall exit. The objective is strictly to find hidden items rather than finding a way out.
   - To prevent frustration, the maze generator guarantees that every non-dead-end room has at least two exit paths (ensuring the player always has active "Left" or "Right" choices to make).
3. **Dead-Ends**: If the player reaches a dead-end room (a leaf node with only one path leading into it), they must choose the `Back` action to re-trace their steps.
4. **Items**: The maze contains between 5 and 10 hidden reward items randomly distributed across the nodes. When the player enters a room containing an item, the item is immediately discovered.
5. **Console Consolation**: If the player consumes their entire step budget without discovering any reward items, they are automatically granted a `tier_1` consolation reward upon completion.

---

## 2. Mathematical Formulas & Streak Scaling

- **Movement Step Budget**: The number of step moves the player is allowed to make inside the labyrinth scales with their streak:
  $$\text{steps} = \text{rand}(4, 10) + \min\left(\frac{\text{streak}}{15}, 20\right)$$
  - *Base steps*: A random integer between 4 and 10.
  - *Streak bonus*: Adds up to 20 additional steps (capped at streak 300).
- **Spawned Item Count**: The server randomly rolls and places between 5 and 10 items on the board.
- **Reward Tiers per Item**:
  Each spawned item rolls its reward tier upon maze initialization according to these exact weights:
  
  | Tier | Rarity | Chance | Reward ID |
  | :---: | --- | :---: | --- |
  | **1** | Common | `55%` | `tier_1` |
  | **2** | Uncommon | `25%` | `tier_2` |
  | **3** | Rare | `12%` | `tier_3` |
  | **4** | Excellent | `5%` | `tier_4` |
  | **5** | Unique | `2%` | `tier_5` |
  | **6** | Exotic | `0.9%` | `tier_6` |
  | **7** | Ultimate | `0.1%` | `tier_7` |

---

## 3. Labyrinth Structure & Generation Algorithm

The labyrinth is modeled as a connected graph of nodes generated deterministically from a server-rolled random seed:
1. **Grid Layout**: Nodes are laid out on a grid (e.g., $10 \times 10$ rooms).
2. **Deterministic Generation**: A randomized depth-first search (DFS) algorithm carves paths through the grid starting from the entry node, ensuring all rooms are reachable.
3. **Choice Guarantee**: Extra paths are selectively carved between adjacent dead-ends and rooms to ensure that every non-dead-end node inside the maze contains at least two path choices, keeping "Left" and "Right" choices always available.
4. **Authoritative Placement**: The server pre-generates the entire grid, including item nodes, storing it in the player's active session state. The client is only sent the connections and items of the *currently entered* node and previously discovered nodes to prevent cheating or peeking at the memory layout.

---

## 4. Implementation Details

### Elixir Backend (`lib/incrementalist/game/features/bonustime/games/reward_labyrinth.ex`)
- **Session Struct**: `LabyrinthSession` stores:
  - `steps_remaining`: Current step moves left in the budget.
  - `current_node_id`: ID of the node the player is currently occupying.
  - `visited_nodes`: Set of node IDs already visited by the player.
  - `discovered_items`: List of reward tiers found so far.
  - `nodes`: Map of node IDs to room descriptions (each room describes its ID, coordinate, connections `%{north: id, south: id, east: id, west: id}`, and containing reward tier if any).
- **Actions**:
  - `start_session(streak)`: Rolls step budget, generates the deterministic graph, places 5-10 items, and sets `current_node_id` to the entry room.
  - `move(direction)`: Validates that `direction` exists on the current node. Subtracts 1 step, updates `current_node_id`, adds the new room to `visited_nodes`, and adds any room items to `discovered_items`.
  - `complete_session()`: Finalizes rewards (granting the highest tier item found, or `tier_1` if none were found), and adds the results to the player's state.

### TypeScript Frontend (`assets/src/features/bonustime/reward-labyrinth/`)
- **`view-model.ts`**: Projects the player's current room connections (which directions are walkable), steps left, and items found.
- **`render.ts`**: WebGL Canvas rendering. Draws a premium representational layout:
  - A central room box showing the player's character.
  - Visual corridors leading North, South, East, or West based on connections.
  - Clickable layout arrows on the corridors for navigation.
  - A steps HUD and a chest inventory displaying found items.
- **`interactions.ts`**: Listens for click events on the directional navigation arrows, sending a `move` command with the direction (`north`, `south`, `east`, or `west`).

---

## 5. Verification & Testing
- Add backend unit tests to verify maze pathing integrity (no disconnected corridors).
- Test that step limits are strictly enforced.
- Verify the consolation item triggers when completing with an empty inventory.
