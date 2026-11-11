import { contentOf, type Layer } from "./layers";

// The slide that last set each root's height: a drop put off leaves it to a
// slide that has aimed since.
const owners = new WeakMap<HTMLElement, object>();

/**
 * The window at `y`, at once: a page's own `scroll-behavior: smooth` would
 * take frames to get there, the layers dropped meanwhile.
 */
export const scrollWindow = (y: number) =>
  // Across, it stays where it is: the layers were placed there.
  scrollTo({ top: y, left: scrollX, behavior: "instant" });

/**
 * The window behind the layers. Dropping the layers and scrolling the window
 * in the same frame is what iOS WebKit paints blank, so the window is put
 * where the screen sits frames before the end, behind the layers (fixed, so
 * nothing moves), and the end only drops them. The root keeps the height the
 * window needs meanwhile: the lifted hosts are out of flow and the scroll
 * would clamp. Only ever more of it while the slide lasts: a document made
 * shorter clamps the window where it is, and iOS WebKit drops a scroll to the
 * top while its scroll view sits above the page (under Safari's top bar, a
 * window scrolled less than the bar's height), then draws the old scroll
 * under a window that reads 0. So the top is reached from below any bar: a
 * window less than a viewport down goes a viewport down first, and to the top
 * two frames later, each a scroll of its own for the browser.
 */
export function aimOf(
  root: HTMLElement,
  owner: object,
  offsetOf: (layer: Layer) => number,
  /** The root was made taller: a scrollbar that takes room may have come. */
  grown: () => void,
) {
  let aimed: Layer | null = null;
  let tall = 0;
  let hop = 0; // the frame of a scroll to the top put off

  const grow = (height: number) => {
    owners.set(root, owner);
    if (height <= tall) return;
    tall = height;
    root.style.minHeight = `${height}px`;
    grown();
  };

  const stop = () => {
    cancelAnimationFrame(hop);
    hop = 0;
  };

  return {
    /** The layer the window was last put at. */
    get aimed() {
      return aimed;
    },
    /** On its way to the top: the window is not where it was aimed yet. */
    get busy() {
      return hop !== 0;
    },
    /** `height` and `offset` when already read, before other writes. */
    at(
      layer: Layer,
      height = contentOf(layer.host).offsetHeight,
      offset = offsetOf(layer),
    ) {
      aimed = layer;
      grow(height);
      // Already on its way to the top: aimed there again (a screen's content
      // grew, a redirect took its place), the two frames are not cut short.
      if (hop && Math.round(offset) <= 0) return;
      stop();

      // By the pixel: a window half a pixel down, or pulled above the page,
      // is at the top as far as the browser's bar goes.
      const view = document.documentElement.clientHeight;
      const from = Math.round(scrollY);
      const to = Math.max(0, Math.round(offset));
      // Rounded to decide only: the window goes where the screen was, to the
      // fraction, so the scroll that settles it after the drop moves nothing.
      if (to > 0 || from <= 0 || from >= view)
        return scrollWindow(to > 0 ? offset : 0);

      grow(2 * view);
      scrollWindow(view);
      hop = requestAnimationFrame(() => {
        hop = requestAnimationFrame(() => {
          hop = 0;
          scrollWindow(0);
        });
      });
    },
    /** Lets the root size to its content again, unless another slide holds it. */
    release() {
      // Let go on its way to the top (the stack unmounted, or another slide
      // began): it goes there.
      if (hop) scrollWindow(0);
      stop();
      if (owners.get(root) === owner) root.style.removeProperty("min-height");
    },
  };
}
