import { beforeEach, describe, expect, it, vi } from "vitest";
import { readStorageValue, toggleId, writeStorageValue } from "./storage";

describe("storage helpers", () => {
  const values = new Map<string, string>();

  beforeEach(() => {
    values.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    });
  });

  it("returns the fallback and removes invalid persisted JSON", () => {
    localStorage.setItem("goals", "invalid JSON");

    expect(readStorageValue("goals", [])).toEqual([]);
    expect(localStorage.getItem("goals")).toBeNull();
  });

  it("round-trips stored data", () => {
    writeStorageValue("goals", ["privacy"]);

    expect(readStorageValue("goals", [])).toEqual(["privacy"]);
  });

  it("adds and removes an id without mutating the source set", () => {
    const source = new Set(["one"]);
    const withNewId = toggleId(source, "two");

    expect(source).toEqual(new Set(["one"]));
    expect(withNewId).toEqual(new Set(["one", "two"]));
    expect(toggleId(withNewId, "one")).toEqual(new Set(["two"]));
  });
});
