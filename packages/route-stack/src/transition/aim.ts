import { contentOf, type Layer } from "./layers";

// The slide that last set each root's height: a drop deferred a frame leaves
// it to a slide that has aimed since.
const owners = new WeakMap<HTMLElement, object>();

/**
 * The window behind the layers. Dropping the layers and scrolling the window
 * in the same frame is what iOS WebKit paints blank, so the window is put
 * where the screen sits frames before the end, behind the layers (fixed, so
 * nothing moves), and the end only drops them. The root keeps that screen's
 * height meanwhile: the lifted hosts are out of flow and the scroll would
 * clamp.
 */
export function aimOf(
  root: HTMLElement,
  owner: object,
  offsetOf: (layer: Layer) => number,
) {
  let aimed: Layer | null = null;

  return {
    /** The layer the window was last put at. */
    get aimed() {
      return aimed;
    },
    /** `height` and `offset` when already read, before other writes. */
    at(
      layer: Layer,
      height = contentOf(layer.host).offsetHeight,
      offset = offsetOf(layer),
    ) {
      aimed = layer;
      owners.set(root, owner);
      root.style.minHeight = `${height}px`;
      scrollTo(0, offset);
    },
    /** Lets the root size to its content again, unless another slide holds it. */
    release() {
      if (owners.get(root) === owner) root.style.removeProperty("min-height");
    },
  };
}
