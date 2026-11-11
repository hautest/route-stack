import { afterEach, expect, test, vi } from "vitest";
import { frame } from "../test/browser";
import { slide, type Layer } from "./slide";
import { ios } from "./transitions";

const fast = { ...ios, duration: 80 };

// A stack beside a sidebar drawn over it, as an app shell lays them out.
function shell() {
  const wrap = document.createElement("div");
  wrap.innerHTML = `<aside style="position: fixed; inset: 0 auto 0 0; width: 100px; z-index: 10"></aside><div style="margin-left: 100px"></div>`;
  const root = wrap.children[1] as HTMLElement;
  const host = () => {
    const el = document.createElement("div");
    el.innerHTML = `<div style="height: 2000px"></div>`;
    root.append(el);
    return { host: el, scroll: 0 } satisfies Layer;
  };
  document.body.append(wrap);
  return { wrap, root, aside: wrap.children[0]!, enter: host(), leave: host() };
}

const shieldOf = (root: HTMLElement) =>
  root.querySelector<HTMLElement>("[data-stack-shield]");

// Whether the page would scroll: a real touch or wheel goes to what is under
// it, so the events are sent there.
const scrolls = (x: number, y: number, type: "touchmove" | "wheel") => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  document.elementFromPoint(x, y)!.dispatchEvent(event);
  return !event.defaultPrevented;
};

const margin = document.body.style.margin;
let wrap: HTMLElement | null = null;
afterEach(() => {
  wrap?.remove();
  wrap = null;
  document.body.style.margin = margin;
});

test("no touch or wheel on the stack scrolls the page while the layers are up; beside it they do", () => {
  document.body.style.margin = "0";
  const made = shell();
  wrap = made.wrap;
  const [onStack, beside] = [300, 50];
  for (const type of ["touchmove", "wheel"] as const)
    expect([scrolls(onStack, 200, type), scrolls(beside, 200, type)]).toEqual([
      true,
      true,
    ]);

  const control = slide(made.enter, made.leave, fast, false);
  const shield = shieldOf(made.root)!;
  // Before any event: a touch that starts on it pans nothing.
  expect(shield.style.touchAction).toBe("none");
  expect(document.elementFromPoint(onStack, 200)).toBe(shield);
  expect(document.elementFromPoint(beside, 200)).toBe(made.aside);
  for (const type of ["touchmove", "wheel"] as const)
    expect([scrolls(onStack, 200, type), scrolls(beside, 200, type)]).toEqual([
      false,
      true,
    ]);

  // A scroll already under way cannot be held: left alone (a call would be
  // warned about as ignored).
  const underWay = new Event("touchmove", { cancelable: false });
  const prevent = vi.spyOn(underWay, "preventDefault");
  shield.dispatchEvent(underWay);
  expect(prevent).not.toHaveBeenCalled();

  control.end(made.enter, true);
  expect(shieldOf(made.root)).toBeNull();
  expect(scrolls(onStack, 200, "wheel")).toBe(true);
});

test("held until the layers are gone, through a drop put off", async () => {
  const made = shell();
  wrap = made.wrap;
  made.enter.scroll = 300;
  const control = slide(made.enter, made.leave, fast, false);
  control.end(made.enter);
  expect(control.pending).toBe(true);
  expect(shieldOf(made.root)).not.toBeNull();
  while (control.pending) await frame();
  expect(shieldOf(made.root)).toBeNull();
});

// A rotation under a slide: the stack's place across changed.
test("the layers and what holds the touches follow the stack's width", () => {
  document.body.style.margin = "0";
  const made = shell();
  wrap = made.wrap;
  const control = slide(made.enter, made.leave, fast, false);
  const across = (el: HTMLElement) => [el.style.left, el.style.width];
  const wide = `${innerWidth - 100}px`;
  for (const el of [made.enter.host, made.leave.host, shieldOf(made.root)!])
    expect(across(el)).toEqual(["100px", wide]);

  made.root.style.marginLeft = "40px";
  dispatchEvent(new Event("resize"));
  for (const el of [made.enter.host, made.leave.host, shieldOf(made.root)!])
    expect(across(el)).toEqual(["40px", `${innerWidth - 40}px`]);
  control.end(made.enter, true);
  expect(across(made.enter.host)).toEqual(["", ""]);
});

// A scrollbar that takes room appears as the root grows with a taller screen:
// the stack is narrower, the window the same size.
test("the layers follow a stack made narrower as it grows, with no resize of the window", async () => {
  document.body.style.margin = "0";
  const made = shell();
  wrap = made.wrap;
  const control = slide(made.enter, made.leave, fast, false);
  const widths = () =>
    [made.enter.host, made.leave.host, shieldOf(made.root)!].map(
      (el) => el.style.width,
    );
  expect(widths()).toEqual(Array(3).fill(`${innerWidth - 100}px`));

  control.aim("enter");
  made.root.style.marginRight = "15px";
  (made.enter.host.firstElementChild as HTMLElement).style.height = "6000px";
  await frame();
  await frame();
  expect(widths()).toEqual(Array(3).fill(`${innerWidth - 115}px`));
  control.end(made.enter, true);
});

// Back from a short screen to a tall one: the root grows as the window is
// aimed, outside any observer, and the layers are narrower at once.
test("the layers follow a stack made narrower as the window is aimed at a taller screen", () => {
  document.body.style.margin = "0";
  const made = shell();
  wrap = made.wrap;
  (made.enter.host.firstElementChild as HTMLElement).style.height = "6000px";
  const control = slide(made.enter, made.leave, fast, false);
  made.root.style.marginRight = "15px";
  control.aim("enter");
  for (const el of [made.enter.host, made.leave.host, shieldOf(made.root)!])
    expect(el.style.width).toBe(`${innerWidth - 115}px`);
  control.end(made.enter, true);
});

// A redirect's screen is the first taller one: fitted as the entering layer.
test("a layer retargeted to is fitted when the root grows for it", () => {
  document.body.style.margin = "0";
  const made = shell();
  wrap = made.wrap;
  const control = slide(made.enter, made.leave, fast, false);
  control.aim("enter");
  const redirect = document.createElement("div");
  redirect.innerHTML = `<div style="height: 6000px"></div>`;
  made.root.append(redirect);
  made.root.style.marginRight = "15px";
  control.retarget({ host: redirect, scroll: 0 });
  expect(redirect.style.width).toBe(`${innerWidth - 115}px`);
  control.end({ host: redirect, scroll: 0 }, true);
});
