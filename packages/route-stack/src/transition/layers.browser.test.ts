import { afterEach, describe, expect, test } from "vitest";
import { background } from "./layers";

let outer: HTMLElement | null = null;

// Nested divs in body, outermost first, each with the given background;
// returns the innermost and registers the outermost in `outer` for cleanup.
function chain(...colors: string[]) {
  let parent: HTMLElement = document.body;
  for (const color of colors) {
    const el = document.createElement("div");
    el.style.background = color;
    if (parent === document.body) outer = el;
    parent.append(el);
    parent = el;
  }
  return parent;
}

const bodyBackground = document.body.style.background;
const htmlBackground = document.documentElement.style.background;
const htmlColorScheme = document.documentElement.style.colorScheme;
afterEach(() => {
  outer?.remove();
  outer = null;
  document.body.style.background = bodyBackground;
  document.documentElement.style.background = htmlBackground;
  document.documentElement.style.colorScheme = htmlColorScheme;
});

describe("background", () => {
  test("takes a black ancestor over a gray one above it", () => {
    expect(background(chain("#121212", "#000", "transparent"))).toBe(
      "rgb(0, 0, 0)",
    );
  });

  test("skips a transparent ancestor up to a black one", () => {
    expect(background(chain("#000", "transparent"))).toBe("rgb(0, 0, 0)");
  });

  test("takes an opaque color whose last channel is 0", () => {
    expect(background(chain("red", "transparent"))).toBe("rgb(255, 0, 0)");
  });

  test("falls back when nothing paints", () => {
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
    expect(background(chain("transparent", "transparent"))).toBe(
      "rgb(255, 255, 255)",
    );
  });

  test("falls back to the page's dark canvas", () => {
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
    document.documentElement.style.colorScheme = "dark";
    const color = background(chain("transparent"));
    expect(color).toMatch(/^rgb\(/);
    expect(color).not.toBe("rgb(255, 255, 255)");
  });

  test("falls back to the canvas whatever author rules match the probe", () => {
    const style = document.createElement("style");
    style.textContent =
      "html { color-scheme: dark } head { color-scheme: light } div { background-color: transparent !important }";
    document.head.append(style);
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
    const color = background(chain("transparent"));
    style.remove();
    expect(color).toMatch(/^rgb\(/);
    expect(color).not.toBe("rgb(255, 255, 255)");
  });

  test("leaves no probe behind", () => {
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
    const children = document.head.childElementCount;
    background(chain("transparent"));
    expect(document.head.childElementCount).toBe(children);
  });

  test("ignores a dark scheme below html", () => {
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
    const wrapper = chain("transparent", "transparent");
    wrapper.parentElement!.style.colorScheme = "dark";
    expect(background(wrapper)).toBe("rgb(255, 255, 255)");
  });
});
