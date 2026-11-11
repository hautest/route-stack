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
 * On a lifted host, for the app's composited elements: iOS WebKit (bug 310087)
 * commits composited layers against the rect shown before a same-task window
 * scroll (aim.ts), so one paints blank for a frame or two. Apps turn
 * compositing off under this attribute.
 */
const ANIMATING = "data-stack-animating";

// The slide that last lifted each host: a drop put off leaves a host another
// slide has lifted since.
const owners = new WeakMap<HTMLElement, object>();

/**
 * Where the screens sit in the document, read when a slide starts (`across`
 * again when the window is resized under it, or the root grows).
 */
export function geometryOf(root: HTMLElement) {
  const rect = root.getBoundingClientRect();
  // Below content in flow above the stack (an app header).
  const origin = rect.top + scrollY;
  // Beside what is next to the stack (a sidebar): the layers take its place
  // across, not the viewport's.
  const across = { left: rect.left, width: rect.width };

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

  return { origin, offsetOf, across };
}

export type Geometry = ReturnType<typeof geometryOf>;

/**
 * Lifts screen hosts as fixed layers, the stack's width and down to the
 * viewport's end, and drops them, for one slide (`owner`). The content is
 * offset by margin, not scrollTop: a transformed layer would carry fixed
 * children with the scroll.
 */
export function layersOf(
  owner: object,
  bg: string,
  { origin, offsetOf, across }: Geometry,
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

  /** The screen takes focus (an autoFocus, a focus in an effect), no taps. */
  const allowFocus = (host: HTMLElement) => {
    host.inert = false;
    host.style.pointerEvents = "none";
  };

  /**
   * `offset` when already read, before other writes. `inert: false` for the
   * screen arriving: it takes focus.
   */
  const lift = (
    layer: Layer,
    zIndex: number,
    { offset, inert = true }: { offset?: number; inert?: boolean } = {},
  ) => {
    const { host } = layer;
    owners.set(host, owner);
    show(layer);
    Object.assign(host.style, {
      position: "fixed",
      bottom: "0",
      left: `${across.left}px`,
      width: `${across.width}px`,
      overflow: "hidden",
      // A focus scrolls it in one step, folded whole (slide.ts): an app's
      // smooth scrolling would be folded midway, its steps cut.
      scrollBehavior: "auto",
      zIndex: String(zIndex),
      background: bg,
    });
    host.setAttribute(ANIMATING, "");
    place(layer, offset);
    if (inert) host.inert = true;
    else allowFocus(host);
  };

  /** Back into the document: `shown`, or hidden as React hides it. */
  const restore = (host: HTMLElement, shown: boolean) => {
    if (owners.get(host) !== owner) return;
    owners.delete(host);

    for (const property of [
      "position",
      "top",
      "bottom",
      "left",
      "width",
      "overflow",
      "z-index",
      "background",
      "box-shadow",
      "scroll-behavior",
      "pointer-events",
    ])
      host.style.removeProperty(property);
    host.removeAttribute(ANIMATING);

    const content = contentOf(host);
    content.style.removeProperty("margin-top");
    host.inert = false;
    if (shown) content.style.removeProperty("display");
    else content.style.setProperty("display", "none", "important");
  };

  /** Still lifted by this slide: not by one that lifted it since. */
  const owns = (host: HTMLElement) => owners.get(host) === owner;

  return { show, place, lift, allowFocus, owns, restore };
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
