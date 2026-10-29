// Controls that drag sideways themselves: a slider's thumb, a media scrubber
// (a JS slider, Radix or Headless UI, is known by its ARIA role), and the
// app's opt-out for any other JS gesture. They keep their drags at the edge
// too.
const SLIDES = [
  "input[type=range]",
  "video",
  "audio",
  '[role="slider"]',
  '[role="scrollbar"]',
  "[data-stack-no-swipe]",
].join(", ");

// Text moves its caret or selection sideways: away from the edge only, where
// a native edge gesture still wins over a text field.
const TEXT = [
  "input:not([type=checkbox], [type=radio], [type=button], [type=submit], [type=reset], [type=range])",
  "textarea",
  "select",
  '[contenteditable]:not([contenteditable="false"])',
].join(", ");

/**
 * Whether the page takes a drag right that starts on `target` in the screen
 * `host`. No browser signal tells a gesture of the page before the swipe
 * cancels the moves, so it is read off the touched path, once per touch, from
 * the element actually touched (inside a shadow root too) up to the screen:
 * - a control that drags sideways, or `data-stack-no-swipe`;
 * - away from the edge, text, an element declaring with `touch-action` that
 *   it handles a horizontal pan itself (a JS carousel's `pan-y`, a map's
 *   `none`), or a scroller that can scroll back left (at its start it would
 *   only bounce: the swipe goes back, as a native scroll view at its edge).
 * Above the screen nothing counts: a `touch-action` there only keeps the
 * browser from panning the page, and there is nothing to scroll sideways.
 */
export function claimsDrag(target: EventTarget, host: Element, edge: boolean) {
  for (
    let element = target instanceof Element ? target : null;
    element && element !== host;
    element = parentOf(element)
  ) {
    if (element.matches(SLIDES)) return true;
    if (edge) continue;
    if (element.matches(TEXT)) return true;
    if (element.scrollLeft > 0 && element.scrollWidth > element.clientWidth)
      return true;
    const action = getComputedStyle(element).touchAction;
    if (
      action &&
      action !== "auto" &&
      action !== "manipulation" &&
      !action.includes("pan-x")
    )
      return true;
  }
  return false;
}

/** The parent, or out of a shadow root, its host. */
const parentOf = (element: Element) =>
  element.parentElement ??
  (element.parentNode instanceof ShadowRoot ? element.parentNode.host : null);
