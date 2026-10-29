export interface Layer {
  host: HTMLElement;
  /**
   * Window scroll of the screen, shown by offsetting its content while lifted
   * (as far as its content reaches).
   */
  scroll: number;
}

export const contentOf = (host: HTMLElement) =>
  host.firstElementChild as HTMLElement;

/**
 * Where a screen shown for the first time starts: at its #fragment's element
 * (less its scroll-margin), as a browser lands a link to one, else at the top.
 * Read at the commit, before the layers lift it out of flow.
 */
export function firstScroll(host: HTMLElement) {
  let id = "";
  try {
    id = decodeURIComponent(location.hash.slice(1));
  } catch {
    return 0;
  }
  const target = id && host.querySelector(`[id="${CSS.escape(id)}"]`);
  if (!target) return 0;
  const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
  return Math.max(0, target.getBoundingClientRect().top + scrollY - margin);
}

/**
 * The color behind the screens: the nearest ancestor of the stack that paints
 * one (a theme wrapper, body or html), as where a screen does not cover.
 */
export const background = (from: HTMLElement) => {
  for (let el: Element | null = from; el; el = el.parentElement) {
    const color = getComputedStyle(el).backgroundColor;
    if (color && color !== "transparent" && !color.endsWith(", 0)"))
      return color;
  }
  // The page's own default: white, or dark under `color-scheme: dark`.
  return "Canvas";
};

/**
 * Set to `hidden` on a lifted host, unset at rest, for the app's scrolling
 * elements: `overflow-x: var(--route-stack-overflow, auto)`. iOS WebKit paints
 * a composited scroller inside a lifted layer blank for a frame whenever the
 * window scrolls behind it; one not scrollable is painted with the layer.
 */
const OVERFLOW = "--route-stack-overflow";

// The slide that last lifted each host: a drop deferred a frame leaves a host
// another slide has lifted since.
const owners = new WeakMap<HTMLElement, object>();

/** Where the screens sit in the document, read when a slide starts. */
export function geometryOf(root: HTMLElement) {
  // Below content in flow above the stack (an app header).
  const origin = root.getBoundingClientRect().top + scrollY;

  /**
   * The window scroll a layer shows: the saved one, clamped to where its
   * content lets the window scroll now. Content can be shorter than when it
   * was saved (a router refetching on back renders a skeleton); past its end
   * the layer would show nothing.
   */
  const offsetOf = ({ host, scroll }: Layer) =>
    Math.min(
      scroll,
      Math.max(
        0,
        origin +
          contentOf(host).offsetHeight -
          document.documentElement.clientHeight,
      ),
    );

  return { origin, offsetOf };
}

export type Geometry = ReturnType<typeof geometryOf>;

/**
 * Lifts screen hosts as viewport-sized fixed layers and drops them, for one
 * slide (`owner`). The content is offset by margin, not scrollTop: a
 * transformed layer would carry fixed children with the scroll.
 */
export function layersOf(
  owner: object,
  bg: string,
  { origin, offsetOf }: Geometry,
) {
  // The screen where the window shows it at that scroll: the layer starts
  // below what is above the stack while that is in view, and does not cover it.
  const place = (layer: Layer, offset = offsetOf(layer)) => {
    const shift = origin - offset;
    layer.host.style.top = `${Math.max(0, shift)}px`;
    contentOf(layer.host).style.marginTop = `${Math.min(0, shift)}px`;
  };

  /** Shown for measuring: hidden content measures 0. */
  const show = ({ host }: Layer) =>
    contentOf(host).style.removeProperty("display");

  /** `offset` when already read, before other writes. */
  const lift = (layer: Layer, zIndex: number, offset?: number) => {
    const { host } = layer;
    owners.set(host, owner);
    show(layer);
    Object.assign(host.style, {
      position: "fixed",
      inset: "0",
      overflow: "hidden",
      zIndex: String(zIndex),
      background: bg,
    });
    host.style.setProperty(OVERFLOW, "hidden");
    place(layer, offset);
    host.inert = true;
  };

  /** Back into the document: `shown`, or hidden as React hides it. */
  const restore = (host: HTMLElement, shown: boolean) => {
    if (owners.get(host) !== owner) return;
    owners.delete(host);

    for (const property of [
      "position",
      "inset",
      "top",
      "overflow",
      "z-index",
      "background",
      "box-shadow",
      OVERFLOW,
    ])
      host.style.removeProperty(property);

    const content = contentOf(host);
    content.style.removeProperty("margin-top");
    host.inert = false;
    if (shown) content.style.removeProperty("display");
    else content.style.setProperty("display", "none", "important");
  };

  return { show, place, lift, restore };
}

// What makes an element contain its fixed descendants instead of the viewport:
// named in the warning only. The check itself is a probe.
const containsFixed = (style: CSSStyleDeclaration) =>
  [
    style.transform !== "none" && `transform: ${style.transform}`,
    style.translate !== "none" &&
      style.translate &&
      `translate: ${style.translate}`,
    style.scale !== "none" && style.scale && `scale: ${style.scale}`,
    style.rotate !== "none" && style.rotate && `rotate: ${style.rotate}`,
    style.perspective !== "none" && `perspective: ${style.perspective}`,
    style.filter !== "none" && `filter: ${style.filter}`,
    style.backdropFilter &&
      style.backdropFilter !== "none" &&
      `backdrop-filter: ${style.backdropFilter}`,
    /transform|translate|scale|rotate|perspective|filter/.test(
      style.willChange,
    ) && `will-change: ${style.willChange}`,
    /paint|layout|strict|content/.test(style.contain) &&
      `contain: ${style.contain}`,
  ].filter(Boolean);

// Roots checked: the probe forces a layout, once per stack, not per slide.
const checked = new WeakSet<HTMLElement>();

/**
 * Development only. The layers are `position: fixed`, placed on the viewport;
 * an ancestor with a transform, filter, will-change or paint containment
 * becomes their containing block instead (CSS), and a slide lands on it. A
 * fixed probe covering the viewport shows it, whatever property does it.
 */
export function warnFixedContainer(root: HTMLElement) {
  if (checked.has(root)) return;
  checked.add(root);

  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;inset:0;visibility:hidden;pointer-events:none";
  root.append(probe);
  const rect = probe.getBoundingClientRect();
  probe.remove();
  const viewport = document.documentElement;
  if (
    Math.abs(rect.left) < 1 &&
    Math.abs(rect.top) < 1 &&
    Math.abs(rect.width - viewport.clientWidth) < 1 &&
    Math.abs(rect.height - viewport.clientHeight) < 1
  )
    return;

  for (let el = root.parentElement; el; el = el.parentElement) {
    const found = containsFixed(getComputedStyle(el));
    if (found.length) {
      console.warn(
        `route-stack: an ancestor of the stack has ${found.join(", ")}, so screens slide relative to it, not the viewport. Remove it from the stack's ancestors.`,
        el,
      );
      return;
    }
  }
  console.warn(
    "route-stack: an ancestor of the stack contains fixed elements, so screens slide relative to it, not the viewport.",
  );
}
