import { describe, expect, it } from "vitest";
import en from "./locales/en.json";
import ru from "./locales/ru.json";

const tweakIds = [
  "enable_long_paths",
  "disable_advertising_id",
  "disable_consumer_features",
  "reduce_diagnostic_data",
] as const;

describe("locale coverage", () => {
  it.each(tweakIds)("contains English and Russian copy for %s", (id) => {
    expect(en.tweaks[id].label).not.toBe("");
    expect(en.tweaks[id].description).not.toBe("");
    expect(ru.tweaks[id].label).not.toBe("");
    expect(ru.tweaks[id].description).not.toBe("");
  });
});
