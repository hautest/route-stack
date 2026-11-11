import { afterEach, expect, test } from "vitest";
import {
  dispatchTouch,
  frame,
  lifted,
  scrolled,
  settled,
  until,
} from "../test/browser";
import { at, heights, mount, offsetX, setupStack } from "../test/stack";

setupStack();

// What an app puts around the stack. A slide changes nothing of it: not where
// it is, not what it takes.
const added: Element[] = [];
afterEach(() => {
  for (const el of added.splice(0)) el.remove();
  document.body.style.margin = "";
});

const stackRoot = () =>
  document.querySelector<HTMLElement>("[data-stack-root]")!;

const el = (html: string, where: "before" | "after" | "body" = "body") => {
  const made = Object.assign(document.createElement("div"), { innerHTML: html })
    .firstElementChild as HTMLElement;
  const container = stackRoot().parentElement!;
  if (where === "body") document.body.append(made);
  else container[where](made);
  added.push(made);
  return made;
};

const box = (of: Element) => {
  const { top, left, width, height } = of.getBoundingClientRect();
  return [top, left, width, height].map(Math.round);
};

// Every frame of a slide, not only its ends.
async function eachFrame(check: () => void) {
  while (lifted().length) {
    check();
    await frame();
  }
  check();
}

test("fixed elements outside, and a bar stuck to the bottom, stay where they are through a push and a back", async () => {
  const app = mount();
  const tabs = el(
    `<nav style="position: fixed; inset: auto 0 0 0; height: 50px; z-index: 10"></nav>`,
  );
  const stuck = el(
    `<div style="position: sticky; bottom: 0; height: 30px"></div>`,
    "after",
  );
  await scrolled(700);
  const [tabsAt, stuckAt] = [box(tabs), box(stuck)];
  const still = () => {
    expect(box(tabs)).toEqual(tabsAt);
    expect(box(stuck)).toEqual(stuckAt);
  };

  app.push(at("/post"));
  await eachFrame(still);
  await app.back();
  await eachFrame(still);
  expect(scrollY).toBe(700);
});

// Below a long screen the footer is out of view. A slide to a short screen at
// the top ends with it in view, under that screen: not before, over the
// sliding screens.
test("content in flow below the stack does not come into view while a slide lasts", async () => {
  const app = mount();
  heights.set(at("/post"), 300);
  const footer = el(
    `<footer style="position: relative; height: 80px"></footer>`,
    "after",
  );
  await scrolled(40);
  const top = () => footer.getBoundingClientRect().top;
  const below = async () => {
    while (lifted().length) {
      expect(top()).toBeGreaterThanOrEqual(innerHeight);
      await frame();
    }
  };

  app.push(at("/post"));
  await below();
  expect(top()).toBeLessThan(innerHeight);
  await app.back();
  await below();
  expect(top()).toBeGreaterThanOrEqual(innerHeight);
});

// The layers start below it: it is not under what holds the stack's touches.
test("a header in flow above the stack keeps its touches while a slide runs", async () => {
  document.body.style.margin = "0";
  const app = mount();
  const header = el(`<header style="height: 60px"></header>`, "before");
  app.push(at("/post"));
  expect(lifted()).toHaveLength(2);
  expect(document.elementFromPoint(100, 30)).toBe(header);
  expect(
    document.elementFromPoint(100, 200)?.hasAttribute("data-stack-shield"),
  ).toBe(true);
  await settled();
});

test("a stack beside a sidebar slides in its own place, and the sidebar keeps its touches", async () => {
  document.body.style.margin = "0";
  const app = mount();
  const side = el(
    `<aside style="position: fixed; inset: 0 auto 0 0; width: 120px; z-index: 10"></aside>`,
  );
  const container = stackRoot().parentElement!;
  container.style.paddingLeft = "120px";
  const page = () =>
    document.querySelector<HTMLElement>(`[data-page="${at("/home")}"]`)!;
  const [left, width] = [
    page().getBoundingClientRect().left,
    page().offsetWidth,
  ];
  expect(left).toBe(120);

  app.push(at("/post"));
  expect(lifted()).toHaveLength(2);
  // The screen left stays where it was, as wide as it was.
  for (const host of lifted()) {
    expect(host.style.left).toBe("120px");
    expect(host.offsetWidth).toBe(width);
  }
  expect(page().offsetWidth).toBe(width);
  // The sidebar is touched, not what holds the stack's touches.
  expect(document.elementFromPoint(60, 200)).toBe(side);
  await settled();
  const post = document.querySelector(`[data-page="${at("/post")}"]`)!;
  expect(post.getBoundingClientRect().left).toBe(left);
  container.style.removeProperty("padding-left");
});

// Its edge is the stack's, and the screen follows the finger across the
// stack's width, not the viewport's.
test("a swipe in a stack beside a sidebar starts at the stack's edge and follows the finger", async () => {
  document.body.style.margin = "0";
  const app = mount({ swipe: "edge" });
  const container = stackRoot().parentElement!;
  container.style.paddingLeft = "120px";
  app.push(at("/post"));
  await settled();
  const page = document.querySelector(`[data-page="${at("/post")}"]`)!;
  const width = innerWidth - 120;

  dispatchTouch(page, "touchstart", 125, 300, { at: 0 });
  dispatchTouch(page, "touchmove", 125 + width / 4, 300, { at: 16 });
  dispatchTouch(page, "touchmove", 125 + width / 2, 300, { at: 32 });
  await until(() => lifted().length === 2, "the swipe");
  const leaving = lifted().find((host) => host.contains(page))!;
  await until(
    () => Math.abs(offsetX(leaving) - width / 2) < 2,
    "the screen under the finger",
  );
  dispatchTouch(page, "touchend", 125 + width / 2, 300, { at: 400 });
  await settled();
  container.style.removeProperty("padding-left");
});

test("a screen's own fixed button stays where it is when its screen is lifted", async () => {
  const app = mount();
  const button = () =>
    document.querySelector<HTMLElement>(
      `[data-page="${at("/home")}"] [data-fixed]`,
    )!;
  const before = box(button());
  app.push(at("/post"));
  expect(lifted()).toHaveLength(2);
  expect(box(button())).toEqual(before);
  await settled();
});

// The entry the anchor added carries no stamp of the stack's: which of the
// two entries of the page a back lands on is not known, so no swipe opens
// (rather than one to a screen that may be the wrong one).
test("a page has no swipe back once its #fragment was visited, and has it again after a push", async () => {
  const app = mount({ swipe: "edge" });
  app.push(at("/post"));
  await settled();
  const landed = () =>
    new Promise((resolve) =>
      addEventListener("popstate", resolve, { once: true }),
    );
  let there = landed();
  location.hash = "#sec";
  await there;
  there = landed();
  history.back();
  await there;
  expect(location.hash).toBe("");

  const drag = (path: string) => {
    const page = document.querySelector(`[data-page="${at(path)}"]`)!;
    dispatchTouch(page, "touchstart", 5, 300, { at: 0 });
    dispatchTouch(page, "touchmove", innerWidth / 4, 300, { at: 16 });
    dispatchTouch(page, "touchmove", innerWidth / 2, 300, { at: 32 });
    return () =>
      dispatchTouch(page, "touchend", innerWidth * 0.8, 300, { at: 200 });
  };
  let release = drag("/post");
  await frame();
  await frame();
  expect(lifted()).toHaveLength(0);
  release();

  app.push(at("/next"));
  await settled();
  release = drag("/next");
  await until(() => lifted().length === 2, "the swipe");
  release();
  await settled();
  expect(location.pathname).toBe(at("/post"));
});
