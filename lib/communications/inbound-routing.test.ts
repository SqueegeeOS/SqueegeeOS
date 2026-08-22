import { describe, expect, it } from "vitest";
import { selectSoleMessagedLeadConversation } from "./repository";

const conversations = [
  { id: "conversation-current", leadIntakeId: "lead-current" },
  { id: "conversation-old", leadIntakeId: "lead-old" },
];

describe("duplicate lead inbound SMS routing", () => {
  it("uses the only duplicate lead conversation that HomeAtlas texted", () => {
    expect(
      selectSoleMessagedLeadConversation(
        ["lead-current", "lead-old"],
        conversations,
        ["conversation-current"],
      ),
    ).toEqual(conversations[0]);
  });

  it("stays ambiguous when HomeAtlas texted both duplicate leads", () => {
    expect(
      selectSoleMessagedLeadConversation(
        ["lead-current", "lead-old"],
        conversations,
        ["conversation-current", "conversation-old"],
      ),
    ).toBeNull();
  });

  it("stays ambiguous when HomeAtlas texted neither duplicate lead", () => {
    expect(
      selectSoleMessagedLeadConversation(
        ["lead-current", "lead-old"],
        conversations,
        [],
      ),
    ).toBeNull();
  });

  it("uses the newest conversation when one lead has multiple text threads", () => {
    expect(
      selectSoleMessagedLeadConversation(
        ["lead-current", "lead-old"],
        [
          ...conversations,
          { id: "conversation-current-older", leadIntakeId: "lead-current" },
        ],
        ["conversation-current", "conversation-current-older"],
      ),
    ).toEqual(conversations[0]);
  });
});
