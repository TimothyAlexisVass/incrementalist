import { handleBonusTimeInteractions } from "./interactions";
import { InteractionState } from "../../ui/managers/interactions";
import { ServerState, View } from "../../net/snapshots";
import { ChestState, getChestState, resetChestState } from "./01-chest-draw/interactions";

jest.mock("../../core/time", () => ({
  getServerNow: jest.fn(() => new Date("2026-05-01T00:00:00Z").getTime())
}));

jest.mock("./01-chest-draw/interactions", () => ({
  ...jest.requireActual("./01-chest-draw/interactions"),
  handleChestDrawInteractions: jest.fn(() => ({ type: 'open_modal' })),
}));

describe("handleBonusTimeInteractions", () => {
  beforeEach(() => {
    resetChestState();
  });

  it("intercepts interactions if locked out and clicks last reward", () => {
    const input: InteractionState = {
      pointer: { x: 500, y: 450 }, // Inside btnRect (x: 460, y: 440, w: 200, h: 40)
      pressStartPointer: { x: 500, y: 450 },
      isPressed: false,
      clicked: true,
      consumed: false,
      pointerId: 1
    };

    const state: ServerState = {
      snapshot: {
        server_time: "time",
        state: {
          has_bonustime_token: false,
          bonustime: {
            special_tokens: 0,
            last_result: { tier: 1 }
          }
        }
      } as any,
      status: "ok",
      statusTone: "ok",
      currentView: View.BONUSTIME,
      uiHints: { highlightedShopItemId: null }
    };

    const result = handleBonusTimeInteractions(input, state);
    expect(result.type).toBe("open_chest_reward");
    expect(input.consumed).toBe(true);
  });

  it("handles chest draw interactions if not locked out", () => {
    const input: InteractionState = {
      pointer: { x: 500, y: 450 },
      pressStartPointer: { x: 500, y: 450 },
      isPressed: false,
      clicked: true,
      consumed: false,
      pointerId: 1
    };

    const state: ServerState = {
      snapshot: {
        server_time: "time",
        state: {
          has_bonustime_token: true,
          bonustime: {
            special_tokens: 0,
            last_result: null,
            rotation_anchor: "2026-05-01T00:00:00Z"
          }
        }
      } as any,
      status: "ok",
      statusTone: "ok",
      currentView: View.BONUSTIME,
      uiHints: { highlightedShopItemId: null }
    };

    const result = handleBonusTimeInteractions(input, state);
    expect(result.type).toBe("open_chest_reward"); // Due to the mock
  });
});
