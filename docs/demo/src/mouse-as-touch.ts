// The stack's edge zone: a drag starting this close to the left edge.
const EDGE = 20;
// A drag longer than this is not a click (the stack decides a swipe at 10px).
const SLOP = 10;

/**
 * Desktop only, demo only: a mouse drag that starts at the left edge (or
 * anywhere, `anywhere()`: the full-screen swipe) is sent on as touch events to
 * the element under it, so the swipe can be tried without a touch screen.
 * Safari on macOS has no `Touch` constructor: no swipe there.
 */
export const canSwipeWithMouse = () =>
  typeof Touch !== "undefined" && !matchMedia("(pointer: coarse)").matches;

export function mouseAsTouch(anywhere: () => boolean) {
  if (!canSwipeWithMouse()) return;

  let target: Element | null = null;
  let x0 = 0;
  let dragged = false;

  const send = (type: string, event: MouseEvent) => {
    if (!target) return;
    const touch = new Touch({
      identifier: 1,
      target,
      clientX: event.clientX,
      clientY: event.clientY,
    });
    const down = type === "touchend" ? [] : [touch];
    target.dispatchEvent(
      new TouchEvent(type, {
        touches: down,
        targetTouches: down,
        changedTouches: [touch],
        bubbles: true,
        // As a real touch: the swipe cancels the moves it takes.
        cancelable: true,
      }),
    );
  };

  addEventListener(
    "mousedown",
    (event) => {
      dragged = false;
      if (event.button !== 0 || (event.clientX > EDGE && !anywhere())) return;
      // Not on form controls: preventing the mousedown would keep a field from
      // focusing and a select from opening.
      if ((event.target as Element).closest("input, select, textarea")) return;
      event.preventDefault();
      target = event.target as Element;
      x0 = event.clientX;
      send("touchstart", event);
    },
    true,
  );
  addEventListener(
    "mousemove",
    (event) => {
      if (target && Math.abs(event.clientX - x0) > SLOP) dragged = true;
      send("touchmove", event);
    },
    true,
  );
  addEventListener(
    "mouseup",
    (event) => {
      send("touchend", event);
      target = null;
    },
    true,
  );
  // A touch that moved never clicks; a mouse drag within one link would.
  addEventListener(
    "click",
    (event) => {
      if (!dragged) return;
      dragged = false;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );
}
