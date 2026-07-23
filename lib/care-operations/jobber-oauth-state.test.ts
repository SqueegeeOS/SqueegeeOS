import { describe, expect, it, vi } from "vitest";
import { consumeJobberOAuthState } from "./jobber-oauth-state";

const ACTOR_ID = "2d9bfd32-1262-40af-9ce2-33f5710ed85b";

function stateJar(value: string | undefined) {
  let stored = value;
  const remove = vi.fn(() => {
    stored = undefined;
  });
  return {
    jar: {
      get: vi.fn(() => (stored === undefined ? undefined : { value: stored })),
      delete: remove,
    },
    remove,
  };
}

describe("actor-bound Jobber OAuth state", () => {
  it("consumes valid state once and rejects replay", async () => {
    const { jar, remove } = stateJar(
      JSON.stringify({ state: "expected-state", actorId: ACTOR_ID }),
    );
    await expect(
      consumeJobberOAuthState("expected-state", ACTOR_ID, jar),
    ).resolves.toBe(true);
    await expect(
      consumeJobberOAuthState("expected-state", ACTOR_ID, jar),
    ).resolves.toBe(false);
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["", ACTOR_ID, "missing callback state"],
    ["wrong-state", ACTOR_ID, "mismatched callback state"],
    ["expected-state", "00000000-0000-0000-0000-000000000099", "actor mismatch"],
  ])("clears stored state for %s", async (returnedState, actorId) => {
    const { jar, remove } = stateJar(
      JSON.stringify({ state: "expected-state", actorId: ACTOR_ID }),
    );
    await expect(
      consumeJobberOAuthState(returnedState, actorId, jar),
    ).resolves.toBe(false);
    expect(remove).toHaveBeenCalledOnce();
  });

  it("clears malformed stored state", async () => {
    const { jar, remove } = stateJar("not-json");
    await expect(
      consumeJobberOAuthState("expected-state", ACTOR_ID, jar),
    ).resolves.toBe(false);
    expect(remove).toHaveBeenCalledOnce();
  });
});
