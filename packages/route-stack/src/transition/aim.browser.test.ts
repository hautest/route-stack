import { afterEach, expect, test } from "vitest";
import { frame } from "../test/browser";
import { slide, type Layer } from "./slide";
import { ios } from "./transitions";

const fast = { ...ios, duration: 80 };
const view = () => document.documentElement.clientHeight;

// Two screens in a root, as Stack renders them: the one arriving not shown.
function page(enterHeight: number, leaveHeight = 3000) {
  const root = document.createElement("div");
  const host = (height: number) => {
    const el = document.createElement("div");
    el.innerHTML = `<div style="height: ${height}px"></div>`;
    root.append(el);
    return { host: el, scroll: 0 } satisfies Layer;
  };
  // In the order of a back: Stack puts a new screen first (stack tests push).
  const enter = host(enterHeight);
  const leave = host(leaveHeight);
  (enter.host.firstElementChild as HTMLElement).style.display = "none";
  document.body.append(root);
  return { root, enter, leave };
}

let root: HTMLElement | null = null;
afterEach(() => {
  root?.remove();
  root = null;
  scrollTo(0, 0);
});

// iOS WebKit drops a scroll to the top while its scroll view sits above the
// page (under Safari's top bar), and went on drawing the screen left's scroll
// under the screen arrived at. Only seen on a device: here, the way the window
// takes so that the scroll to the top is never asked from under a bar.
test("the window reaches the top from less than a viewport down by way of a viewport down", async () => {
  const made = page(3000);
  root = made.root;
  scrollTo(0, 50);
  made.leave.scroll = 50;
  const control = slide(made.enter, made.leave, fast, false);
  control.aim("enter");
  expect(Math.round(scrollY)).toBe(view());
  // Through a whole frame, what observes the layers' content included: it
  // aims again at once, and must not cut the way short.
  await frame();
  await new Promise((resolve) => setTimeout(resolve));
  expect(Math.round(scrollY)).toBe(view());
  await frame();
  await frame();
  expect(scrollY).toBe(0);
  control.end(made.enter, true);
});

test("from a viewport down or more, the window goes straight to the top", () => {
  const made = page(3000);
  root = made.root;
  scrollTo(0, view() + 100);
  made.leave.scroll = view() + 100;
  const control = slide(made.enter, made.leave, fast, false);
  control.aim("enter");
  expect(scrollY).toBe(0);
  control.end(made.enter, true);
});

// Made shorter under a window scrolled further than the new height lets it,
// the document clamps the window: to under Safari's bar, where the scroll to
// the top that follows is dropped.
test("the document is not made shorter while the slide lasts, only when it ends", async () => {
  const made = page(view() + 60);
  root = made.root;
  scrollTo(0, 1500);
  made.leave.scroll = 1500;
  const before = document.documentElement.scrollHeight;
  const control = slide(made.enter, made.leave, fast, false);
  control.aim("enter");
  await frame();
  await frame();
  expect(document.documentElement.scrollHeight).toBeGreaterThanOrEqual(before);
  control.end(made.enter, true);
  expect(document.documentElement.scrollHeight).toBeLessThan(before);
  expect(scrollY).toBe(0);
});

test("a scrolled screen is aimed at where it was left", () => {
  const made = page(3000);
  root = made.root;
  made.enter.scroll = 400;
  const control = slide(made.enter, made.leave, fast, false);
  control.aim("enter");
  expect(scrollY).toBe(400);
  control.end(made.enter, true);
});

// The layers dropped with the window still on its way would show the screen
// a viewport down.
test("a slide ended while the window is on its way drops once it is there", async () => {
  const made = page(3000);
  root = made.root;
  scrollTo(0, 50);
  made.leave.scroll = 50;
  const control = slide(made.enter, made.leave, fast, false);
  control.aim("enter");
  control.end(made.enter);
  expect(control.pending).toBe(true);
  expect(made.enter.host.style.position).toBe("fixed");
  while (control.pending) await frame();
  expect(scrollY).toBe(0);
  expect(made.enter.host.style.position).toBe("");
});

// The stack unmounted, or another slide began: the layers go at once.
test("a slide dropped at once on the window's way to the top leaves it at the top", () => {
  const made = page(3000);
  root = made.root;
  scrollTo(0, 50);
  made.leave.scroll = 50;
  const control = slide(made.enter, made.leave, fast, false);
  control.aim("enter");
  expect(Math.round(scrollY)).toBe(view());
  control.end(made.enter, true);
  expect(scrollY).toBe(0);
});

// A window saved half a pixel down, or pulled above the page as the slide
// began, is at the top for the browser's bar: the way there is the same.
test.each([0.4, -20])(
  "a screen saved at %f is reached as the top",
  async (saved) => {
    const made = page(3000);
    root = made.root;
    scrollTo(0, 50);
    made.leave.scroll = 50;
    made.enter.scroll = saved;
    const control = slide(made.enter, made.leave, fast, false);
    control.aim("enter");
    expect(Math.round(scrollY)).toBe(view());
    await frame();
    await new Promise((resolve) => setTimeout(resolve));
    expect(Math.round(scrollY)).toBe(view());
    await frame();
    await frame();
    expect(scrollY).toBe(0);
    // The window is there already: the layers drop at once.
    control.end(made.enter);
    expect(control.pending).toBe(false);
  },
);

// The layers are placed where the stack is on screen: a slide that put the
// window back at the left would leave them beside it.
test("a window scrolled across stays there through a slide", () => {
  const made = page(3000);
  root = made.root;
  made.root.style.width = "200vw";
  scrollTo(250, 600);
  made.leave.scroll = 600;
  const control = slide(made.enter, made.leave, fast, false);
  control.aim("enter");
  expect(scrollX).toBe(250);
  expect(made.enter.host.style.left).toBe(
    `${made.root.getBoundingClientRect().left}px`,
  );
  control.end(made.enter, true);
  expect(scrollX).toBe(250);
});

// The root grows with the screen aimed at, from the observer of its content:
// an observer of the root itself would be left undelivered in that pass, which
// the browser reports to the page as an error. (Where a scrollbar that takes
// room comes with the growth, the screens get narrower in that pass and the
// browser reports it all the same, as with layers sized by the viewport.)
test("the root growing under a slide is not observed: no error to the page", async () => {
  const made = page(3000);
  root = made.root;
  const errors: string[] = [];
  const onError = (event: ErrorEvent) => errors.push(event.message);
  addEventListener("error", onError);
  const control = slide(made.enter, made.leave, fast, false);
  control.aim("enter");
  await frame();
  (made.enter.host.firstElementChild as HTMLElement).style.height = "6000px";
  await frame();
  await frame();
  expect(made.root.style.minHeight).toBe("6000px");
  removeEventListener("error", onError);
  control.end(made.enter, true);
  expect(errors).toEqual([]);
});
