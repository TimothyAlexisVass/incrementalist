import { getActiveGameId, getTimeUntilNextTokenMs } from "./view-model";
import { ServerState } from "../../net/snapshots";
import * as timeModule from "../../core/time";
import bonustimeConfig from "../../../../shared/requirements/bonustime.json";

jest.mock("../../core/time", () => ({
  getServerNow: jest.fn()
}));

describe("view-model", () => {
  it("computes active game ID properly crossing rotation boundaries", () => {
    const anchorTime = new Date(bonustimeConfig.rotation_anchor).getTime();

    // Exactly at anchor
    (timeModule.getServerNow as jest.Mock).mockReturnValue(anchorTime);
    expect(getActiveGameId()).toBe("chest_draw"); // Slot 1

    // 12 hours + 1 min later
    (timeModule.getServerNow as jest.Mock).mockReturnValue(anchorTime + (12 * 3600 * 1000) + 60000);
    expect(getActiveGameId()).toBe("prize_wheel"); // Slot 2
  });

  it("computes time until next token correctly", () => {
    const anchorTime = new Date(bonustimeConfig.rotation_anchor).getTime();
    const SLOT_MS = 12 * 3600 * 1000;

    // 10 hours in
    (timeModule.getServerNow as jest.Mock).mockReturnValue(anchorTime + (10 * 3600 * 1000));
    const nextMs = getTimeUntilNextTokenMs();
    expect(nextMs).toBe(2 * 3600 * 1000); // 2 hours remaining
  });
});
