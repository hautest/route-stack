import { afterEach, beforeEach, expect, test } from "vitest";
import { lifted, scrolled, settled, slideAt } from "../test/browser";
import {
  at,
  mount,
  offsetX,
  pageOf,
  progress,
  router,
  setupStack,
  shown,
} from "../test/stack";

setupStack();

// A traversal the browser drew itself (Safari's swipe from the screen edge):
// its popstate says so.
const flag = Object.getOwnPropertyDescriptor(
  PopStateEvent.prototype,
  "hasUAVisualTransition",
);
beforeEach(() => {
  Object.defineProperty(PopStateEvent.prototype, "hasUAVisualTransition", {
    configurable: true,
    get: () => true,
  });
});
afterEach(() => {
  if (flag)
    Object.defineProperty(
      PopStateEvent.prototype,
      "hasUAVisualTransition",
      flag,
    );
  else
    delete (PopStateEvent.prototype as { hasUAVisualTransition?: boolean })
      .hasUAVisualTransition;
});

const opacity = (el: HTMLElement) => getComputedStyle(el).opacity;

test("a back the browser drew slides with nothing moving, back to the screen's scroll", async () => {
  const app = mount({ enableProgressCssVar: true });
  await scrolled(500);
  app.push(at("/post"));
  await settled();

  await app.back();
  expect(lifted()).toHaveLength(2);
  // Midway, where a slide of the stack's own has both screens off their place.
  slideAt(0.5);
  const arriving = lifted().find((host) => pageOf(host) === at("/home"))!;
  const leaving = lifted().find((host) => pageOf(host) === at("/post"))!;
  expect(offsetX(arriving)).toBe(0);
  expect(opacity(arriving)).toBe("1");
  expect(opacity(leaving)).toBe("0");
  // A header following the progress would move a second time.
  expect(progress()).toBe("");

  for (const animation of document.getAnimations()) animation.finish();
  await settled();
  expect(shown().map(pageOf)).toEqual([at("/home")]);
  expect(scrollY).toBe(500);
});

// A guard's redirect, a tab bar on replace: not the screen the browser drew.
test("the entry replaced by another screen after it slides as ever", async () => {
  const app = mount();
  app.push(at("/post"));
  await settled();
  await app.back();
  await settled();

  app.replace(at("/other"));
  expect(lifted()).toHaveLength(2);
  slideAt(0.5);
  const arriving = lifted().find((host) => pageOf(host) === at("/other"))!;
  expect(offsetX(arriving)).toBeGreaterThan(0);
  for (const animation of document.getAnimations()) animation.finish();
  await settled();
});

// The same before the router has rendered the back at all: it goes on to
// another screen, which the browser never drew.
test("a guard redirecting the back before its first render slides as ever", async () => {
  const app = mount();
  app.push(at("/post"));
  await settled();

  router.stale = at("/post");
  try {
    await app.back();
    expect(lifted()).toHaveLength(0);
    history.replaceState(null, "", at("/other"));
  } finally {
    router.stale = null;
  }
  app.render();
  expect(lifted()).toHaveLength(2);
  slideAt(0.5);
  const arriving = lifted().find((host) => pageOf(host) === at("/other"))!;
  // From the back's side: it is still a back, to another screen.
  expect(offsetX(arriving)).toBeLessThan(0);
  for (const animation of document.getAnimations()) animation.finish();
  await settled();
});

// While the still slide lasts (an effect, a late guard): the browser drew the
// screen replaced, not this one.
test("the screen arrived at replaced by another while its still slide lasts slides as ever", async () => {
  const app = mount();
  app.push(at("/post"));
  await settled();
  await app.back();
  expect(lifted()).toHaveLength(2);

  app.replace(at("/other"));
  slideAt(0.5);
  const arriving = lifted().find((host) => pageOf(host) === at("/other"))!;
  expect(offsetX(arriving)).not.toBe(0);
  for (const animation of document.getAnimations()) animation.finish();
  await settled();
  expect(shown().map(pageOf)).toEqual([at("/other")]);
});
