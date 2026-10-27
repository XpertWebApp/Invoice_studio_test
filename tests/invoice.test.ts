import { afterEach, describe, expect, it, vi } from "vitest";
import { newId } from "../lib/invoice";

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("newId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns a v4-shaped id", () => {
    expect(newId()).toMatch(V4);
  });

  it("works without crypto.randomUUID (insecure context)", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
      randomUUID: undefined,
    });
    const a = newId();
    expect(a).toMatch(V4);
    expect(newId()).not.toBe(a);
  });

  it("works with no crypto at all", () => {
    vi.stubGlobal("crypto", undefined);
    expect(newId()).toMatch(V4);
  });
});
