import { handleChestDrawInteractions, ChestState, getChestState, resetChestState } from "./interactions";
import { InteractionState } from "../../../ui/managers/interactions";
import { ChestDrawData } from "./view-model";
import { BigNum } from "../../../core/bignum";
import { GameChannel } from "../../../net/game-channel";

describe("handleChestDrawInteractions", () => {
  beforeEach(() => {
    resetChestState();
  });

  const chestRect = { x: 100, y: 100, width: 100, height: 100 };

  it("transitions to REVEALING on click with token", () => {
    const input: InteractionState = {
      pointer: { x: 150, y: 150 },
      pressStartPointer: { x: 150, y: 150 },
      isPressed: false,
      clicked: true,
      consumed: false,
      pointerId: 1
    };

    const data: ChestDrawData = {
      hasToken: true,
      lastTier: null,
      lastRewardAmount: null
    };

    const channel = {
      pushCommand: jest.fn()
    } as unknown as GameChannel;

    const intent = handleChestDrawInteractions(input, data, chestRect, channel);

    expect(intent).toBeNull();
    expect(input.consumed).toBe(true);
    expect(getChestState()).toBe(ChestState.REVEALING);
    expect(channel.pushCommand).toHaveBeenCalledWith("bonustime.play", { game: "chest_draw" });
  });

  it("does not transition if no token", () => {
    const input: InteractionState = {
      pointer: { x: 150, y: 150 },
      pressStartPointer: { x: 150, y: 150 },
      isPressed: false,
      clicked: true,
      consumed: false,
      pointerId: 1
    };

    const data: ChestDrawData = {
      hasToken: false,
      lastTier: null,
      lastRewardAmount: null
    };

    const channel = {} as GameChannel;

    handleChestDrawInteractions(input, data, chestRect, channel);
    expect(getChestState()).toBe(ChestState.IDLE);
    expect(input.consumed).toBe(false);
  });
});

  it("transitions to REVEALED only after 1.5 seconds and data populates", () => {
    jest.useFakeTimers();
    const originalPerformance = global.performance;
    global.performance = { now: jest.fn() } as any;

    const chestRect = { x: 100, y: 100, width: 100, height: 100 };

    // Initial state: click chest
    const inputClick: InteractionState = {
      pointer: { x: 150, y: 150 },
      pressStartPointer: { x: 150, y: 150 },
      isPressed: false,
      clicked: true,
      consumed: false,
      pointerId: 1
    };

    const data: ChestDrawData = {
      hasToken: true,
      lastTier: null,
      lastRewardAmount: null
    };

    const channel = { pushCommand: jest.fn() } as unknown as GameChannel;

    (performance.now as jest.Mock).mockReturnValue(0);
    handleChestDrawInteractions(inputClick, data, chestRect, channel);
    expect(getChestState()).toBe(ChestState.REVEALING);

    // Fast forward 1 second, result arrived
    (performance.now as jest.Mock).mockReturnValue(1000);
    data.lastTier = 1;
    handleChestDrawInteractions({ ...inputClick, clicked: false }, data, chestRect, channel);
    expect(getChestState()).toBe(ChestState.REVEALING); // Not enough time passed

    // Fast forward 2 seconds, result still there
    (performance.now as jest.Mock).mockReturnValue(2000);
    handleChestDrawInteractions({ ...inputClick, clicked: false }, data, chestRect, channel);
    expect(getChestState()).toBe(ChestState.REVEALED);

    // Click again to open modal
    const inputOpen: InteractionState = {
      ...inputClick,
      clicked: true,
      consumed: false
    };
    const intent = handleChestDrawInteractions(inputOpen, data, chestRect, channel);
    expect(intent?.type).toBe('open_modal');
    expect(getChestState()).toBe(ChestState.IDLE);

    jest.useRealTimers();
  });
