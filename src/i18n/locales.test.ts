import { describe, expect, it } from "vitest";
import en from "./locales/en.json";
import ru from "./locales/ru.json";

function leafKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    leafKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

const tweakIds = [
  "enable_long_paths",
  "disable_advertising_id",
  "disable_consumer_features",
  "reduce_diagnostic_data",
] as const;

describe("locale coverage", () => {
  it("keeps complete English and Russian key parity", () => {
    expect(leafKeys(ru).sort()).toEqual(leafKeys(en).sort());
  });

  it.each(tweakIds)("contains English and Russian copy for %s", (id) => {
    expect(en.tweaks[id].label).not.toBe("");
    expect(en.tweaks[id].description).not.toBe("");
    expect(ru.tweaks[id].label).not.toBe("");
    expect(ru.tweaks[id].description).not.toBe("");
  });
});
