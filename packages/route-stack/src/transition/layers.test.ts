import { describe, expect, test } from "vitest";
import { isTransparent } from "./layers";

describe("isTransparent", () => {
  test.each([
    "transparent",
    "rgba(0, 0, 0, 0)",
    "rgba(255, 255, 255, 0)",
    "rgba(0, 0, 0, 0%)",
    "color(srgb 0 0 0 / 0)",
    "oklch(0 0 0 / 0)",
    "color(srgb 0 0 0 / none)",
    "oklch(0.5 0.1 0 / none)",
  ])("%s is transparent", (color) => {
    expect(isTransparent(color)).toBe(true);
  });

  test.each([
    "rgb(0, 0, 0)",
    "rgb(255, 0, 0)",
    "rgb(255, 200, 0)",
    "rgb(18, 18, 18)",
    "rgba(0, 0, 0, 1)",
    "color(srgb 0 0 0)",
    "oklch(0.2 0 0)",
    "rgba(0, 0, 0, 0.5)",
    "color(srgb 0 0 0 / 0.5)",
    "rgba(0, 0, 0, 0.004)",
    "",
    "foo",
  ])("%s is not transparent", (color) => {
    expect(isTransparent(color)).toBe(false);
  });
});
