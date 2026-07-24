import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn();
const eqProperty = vi.fn(() => ({ maybeSingle }));
const eqHomeowner = vi.fn(() => ({ eq: eqProperty }));
const select = vi.fn(() => ({ eq: eqHomeowner }));
const from = vi.fn(() => ({ select }));

const privilegedClient = { from };
const browserClient = { from: vi.fn() };

vi.mock("../supabase/client", () => ({
  createPrivilegedServerSupabaseClient: vi.fn(() => privilegedClient),
  createBrowserSupabaseClient: vi.fn(() => browserClient),
}));

import { supabaseAdapter } from "./supabase";
import * as clientModule from "../supabase/client";

describe("supabase persistence adapter on the server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("uses the privileged client for portal plan reads", async () => {
    await supabaseAdapter.getHomeCarePlanBySlugs("dasan-gramps", "robailey-drive");

    expect(
      clientModule.createPrivilegedServerSupabaseClient,
    ).toHaveBeenCalledOnce();
    expect(clientModule.createBrowserSupabaseClient).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledWith("home_care_plans");
  });
});
