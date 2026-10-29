import { entries as documentEntries, type Tracked } from "../history/index";
import { defaultSameScreen, pathnameOf, pathOfUrl } from "../history/screens";
import { dev, log } from "../log";
import { listenSwipe, type Drag, type Swipe } from "../swipe/swipe";
import { firstScroll } from "../transition/layers";
import { slide, type Side, type SlideControl } from "../transition/slide";
import { defaultAnimate } from "../transition/transitions";
import type { Animate, Direction, SameScreen, SwipeMode, View } from "../types";
import { ProgressVar } from "./progress";

/** A render of the stack: the path drawn, and what it is for history. */
export interface Render {
  path: string;
  view(): View;
}

/** The only DOM the core reaches: the screen elements, through its binding. */
export interface Driver {
  host(id: number): HTMLElement | null;
  rerender(): void;
}

export interface CoreOptions {
  animate: Animate;
  progress: boolean;
  swipe: (from: string, to: string) => SwipeMode;
  sameScreen: SameScreen;
}

interface Screen {
  /** Internal id (React key, `data-stack-screen`). */
  id: number;
  path: string;
  /** The screen map's screen it shows; set at the commit of a new one. */
  historyId: number | null;
}

/**
 * The one slide in progress, finger-driven or not. `await`: a swipe's back
 * whose commit has not come yet.
 */
type Run =
  | { phase: "drag"; control: SlideControl; to: number }
  | {
      phase: "play" | "rest";
      control: SlideControl;
      to: number;
      end: Side;
      await: boolean;
    };

type Moving = Extract<Run, { phase: "play" | "rest" }>;

// One stack per document: it owns the window scroll and assigns entries in the
// document's screen map.
let attached = 0;

/**
 * The stack as a state machine: which screens there are, which is shown, and
 * the slide between them. Its inputs are a render and its commit, history's
 * events, a finger and a slide played to its end; its outputs the slide's
 * commands, the window scroll, and a re-render when screens are dropped. The
 * rules R1–R12 of the design are marked where they apply. One per document: it
 * assigns entries to screens in the document's screen map, and owns the window
 * scroll.
 */
export class Core {
  private committed: Screen[] = [];
  /** A new screen being rendered, not committed yet. */
  private pending: Screen | null = null;
  private shownId: number | null = null;
  private seq = 0;
  // Per instance: ids start over on a new mount, its scrolls with them.
  private readonly scrolls = new Map<number, number>(); // screen id -> scroll
  private readonly progressVar = new ProgressVar();
  private options: CoreOptions = {
    animate: defaultAnimate,
    progress: false,
    swipe: () => "edge",
    sameScreen: defaultSameScreen,
  };
  private run: Run | null = null;
  /** The last slide ended, while its drop is put off a frame. */
  private dropping: SlideControl | null = null;
  private swipe: Swipe | null = null;
  private driver: Driver | null = null;
  /** The last render committed, whose view a blocker check reads. */
  private render: Render | null = null;
  private unsubscribe: (() => void) | null = null;
  private restoration: ScrollRestoration = "auto";

  constructor(private readonly entries: Tracked = documentEntries) {}

  update(options: CoreOptions) {
    this.options = options;
    this.progressVar.enabled = options.progress;
    this.entries.setSameScreen(options.sameScreen);
  }

  /**
   * R1, at render: the screen to draw this path. Idempotent: a new screen keeps
   * its id while rendered for the same path.
   */
  resolve(render: Render): number {
    const { entries } = this;
    const { path } = render;
    const shown = this.shown();
    const currentHistoryId = entries.screenOf(entries.current().key);

    // The screen of the current entry. At another path, not the shown one:
    // Next renders before it writes history, so the current entry is still
    // the one being left. Nor for a stale render: the router still draws the
    // screen left. A hidden one at another path absorbed this entry: the same
    // screen, as without a hint.
    let screen = this.committed.find(
      (kept) => kept.historyId === currentHistoryId,
    );
    // Only a hidden one that can show this path absorbs it (a query the
    // router never told apart): a render of another page claiming the entry
    // (an app whose path lags history) would draw that page into this screen.
    if (
      screen &&
      screen.path !== path &&
      (screen === shown ||
        !this.couldBeSameScreen(screen.path, path) ||
        render.view() !== "current")
    )
      screen = undefined;

    if (!screen && shown) {
      if (shown.path === path) screen = shown;
      // A navigation `sameScreen` keeps on the screen (a #fragment, a search
      // being typed): no remount. Its path is the commit's to set: a render
      // can be thrown away. The view is read only here, where the kind decides
      // (a router may match routes to tell). Ahead of history, the rule is
      // asked as the screen map will ask it, from the entry being left.
      else if (
        shown.historyId === currentHistoryId &&
        this.couldBeSameScreen(shown.path, path)
      ) {
        const view = render.view();
        if (
          typeof view !== "object" ||
          this.options.sameScreen(
            pathOfUrl(entries.current().url),
            pathOfUrl(view.url),
            view.ahead,
          )
        )
          screen = shown;
      }
    }

    if (!screen) {
      if (this.pending?.path !== path)
        this.pending = { id: this.seq++, path, historyId: null };
      screen = this.pending;
    }

    return screen.id;
  }

  /**
   * Whether one screen can show both paths: at the same pathname (a query a
   * router without a hint never told apart), or as `sameScreen` keeps them.
   */
  private couldBeSameScreen(from: string, to: string) {
    const { sameScreen } = this.options;
    // Either kind: a rule may keep only one, and the router has not said
    // which it will write.
    return (
      pathnameOf(from) === pathnameOf(to) ||
      sameScreen(from, to, "push") ||
      sameScreen(from, to, "replace")
    );
  }

  /** Render order: newest first, so the first DOM match of an id is current. */
  screens(): readonly { id: number; path: string }[] {
    return [
      ...this.committed,
      ...(this.pending ? [this.pending] : []),
    ].reverse();
  }

  /** After every commit of a render that drew screen `id`. */
  commit(id: number, render: Render) {
    const { entries } = this;
    this.render = render;
    const { pending } = this;
    if (pending && pending.id !== id) this.pending = null;

    // R2: a render not of the current entry changes nothing. The first one is
    // the screen there is, whatever it is for.
    if (render.view() !== "current" && this.shownId !== null)
      return this.openSwipe();

    const { key } = entries.current();
    const currentHistoryId = entries.screenOf(key);
    const from = this.shown();
    const to =
      pending?.id === id
        ? pending
        : this.committed.find((screen) => screen.id === id);
    if (!to) return;

    let absorbed = false;
    if (to === pending) {
      if (
        dev &&
        this.committed.some((screen) => screen.historyId === currentHistoryId)
      )
        console.error("route-stack: two screens for one history screen.");
      to.historyId = currentHistoryId;
      this.committed.push(to);
      this.pending = null;
    } else if (to.historyId !== currentHistoryId) {
      // R2: the shown screen drawn for an entry no screen shows yet (a guard
      // sending a back on to the screen it left, navigations the router
      // skipped past) shows that entry.
      if (
        to !== from ||
        to.historyId === null ||
        currentHistoryId === null ||
        this.committed.some((screen) => screen.historyId === currentHistoryId)
      )
        return this.openSwipe();
      entries.assign(key, to.historyId);
      absorbed = true;
    }

    to.path = render.path;

    if (!from) {
      this.shownId = to.id;
      return this.openSwipe();
    }

    // R3
    if (from === to) {
      if (absorbed) this.backToRest("returned");
      return this.openSwipe();
    }

    this.shownId = to.id;
    this.change(from, to, entries.direction(from.historyId, to.historyId));
  }

  /** Saves the shown screen's window scroll; wires the swipe. */
  listen(swipe: boolean) {
    const onScroll = () => {
      // Not during a slide: that scroll aims the window behind the layers.
      if (this.driver && !this.run && this.shownId != null)
        this.scrolls.set(this.shownId, scrollY);
    };

    addEventListener("scroll", onScroll, { passive: true });
    this.swipe = swipe ? listenSwipe(() => this.beginSwipe()) : null;
    this.openSwipe();

    return () => {
      removeEventListener("scroll", onScroll);
      // A finger mid-drag would never release into the swipe disposed next.
      if (this.run?.phase === "drag") this.settle();
      this.swipe?.dispose();
      this.swipe = null;
    };
  }

  /** Takes the window scroll from the browser and listens to history. */
  attach(driver: Driver) {
    if (dev && attached && !this.driver)
      console.warn("route-stack: one <Stack> per document is supported.");
    if (!this.driver) attached++;
    this.driver = driver;
    addEventListener("pagehide", this.onPageHide);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.restoration = history.scrollRestoration;
    history.scrollRestoration = "manual";
    // A guard's redirect is no traversal: its commit absorbs it (R2).
    this.unsubscribe = this.entries.subscribe((event) => {
      if (event.type === "traverse") this.onHistory();
    });
    this.openSwipe();
  }

  /** Gives the window scroll back. The scrolls stay: StrictMode remounts. */
  detach() {
    if (this.driver) attached--;
    removeEventListener("pagehide", this.onPageHide);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    history.scrollRestoration = this.restoration;
    this.unsubscribe?.();
    this.unsubscribe = null;
    (this.run?.control ?? this.dropping)?.end(this.layerOf(this.shownId), true);
    this.run = null;
    this.dropping = null;
    this.progressVar.clear();
    this.driver = null;
  }

  /**
   * R12: a page hidden (bfcache, a tab switched, the app backgrounded) ends
   * its slide, and a back not sent yet is not: nothing runs or moves history
   * while away, where frames stop. iOS WKWebView tells a backgrounded app by
   * visibilitychange only.
   */
  private readonly onPageHide = () => {
    if (this.run) this.settle();
  };

  private readonly onVisibilityChange = () => {
    if (document.visibilityState === "hidden") this.onPageHide();
  };

  private shown(): Screen | undefined {
    return this.committed.find((screen) => screen.id === this.shownId);
  }

  private hostOf(id: number | null | undefined) {
    return id == null ? null : (this.driver?.host(id) ?? null);
  }

  private layerOf(id: number | null | undefined) {
    const host = this.hostOf(id);
    return host && { host, scroll: this.scrolls.get(id ?? -1) ?? 0 };
  }

  /** The shown screen changed. */
  private change(from: Screen, to: Screen, direction: Direction) {
    const run = this.run;
    log("commit", {
      from: from.id,
      to: to.id,
      direction,
      phase: run?.phase,
    });

    // R9: the commit of the back a swipe decided; its slide already goes there.
    if (run && run.phase !== "drag" && run.await && run.to === to.id) {
      this.run = { ...run, await: false };
      run.control.reveal();
      // The screen rendered is now the one sliding in.
      this.writeProgress();
      if (run.phase === "rest") this.settle();
      return;
    }

    // Under a swipe's back still awaited, the screen in view is the one it
    // brings in, not the shown one it leaves.
    const leaving =
      (run?.phase !== "drag" &&
        run?.await &&
        this.committed.find((screen) => screen.id === run.to)) ||
      from;
    const fromHost = this.hostOf(leaving.id);
    const toHost = this.hostOf(to.id);

    // R5: the screen being slid to was replaced (a redirect): the running
    // slide goes on to the new one.
    if (run && toHost && direction === "replace" && run.to === from.id) {
      // At its first scroll, as R4: a redirect to `/doc#section` opens there.
      const scroll = this.scrolls.get(to.id) ?? firstScroll(toHost);
      this.scrolls.set(to.id, scroll);
      run.control.retarget({ host: toHost, scroll });
      this.run = { ...run, to: to.id };
      return;
    }

    // R6: a new navigation cuts the running slide, which ends on the screen
    // arrived at, as React shows it. A finger still down is then ignored.
    this.swipe?.forget();

    // R4. Not by direction: a forward traversal can land on a kept screen.
    if (toHost && !this.scrolls.has(to.id))
      this.scrolls.set(to.id, firstScroll(toHost));

    const transition = this.options.animate(leaving.path, to.path, direction);
    if (!transition || !fromHost || !toHost) {
      // Settle ends a cut slide: the window first goes where this screen
      // sits, behind its layers.
      return this.settle();
    }

    // The slide below lifts the hosts again at once, and aims the window.
    run?.control.end(this.layerOf(to.id), true);

    const control = slide(
      { host: toHost, scroll: this.scrolls.get(to.id) ?? 0 },
      { host: fromHost, scroll: this.scrolls.get(leaving.id) ?? 0 },
      transition,
      direction === "back",
    );

    this.play({
      phase: "play",
      control,
      to: to.id,
      end: "enter",
      await: false,
    });
    this.trackProgress();
  }

  /**
   * Lets the slide run to one end, the window already aimed at the screen
   * there.
   */
  private play(run: Moving) {
    const { control, end } = run;
    this.run = run;
    control.aim(end);
    this.openSwipe();

    void control.play(end === "enter").then((done) => {
      if (done && this.run?.control === control) this.played();
    });
  }

  /** R11: at its end, the slide is over unless a back it started awaits. */
  private played() {
    const run = this.run as Moving;
    log("finished", { end: run.end, waiting: run.await });
    if (run.await) this.run = { ...run, phase: "rest" };
    else this.settle();
  }

  /**
   * R11, the one exit: drop the layers on the shown screen, restore its
   * scroll, prune unreachable screens.
   */
  private settle() {
    if (!this.driver) return;

    const { scrolls, shownId } = this;
    log("settle", {
      shown: shownId,
      scrollY,
      saved: scrolls.get(shownId ?? -1),
    });

    // Without a slide, the last one ended: a drop it put off a frame lands on
    // the screen shown now, not the one it was ended with.
    this.dropping = this.run?.control ?? this.dropping;
    this.dropping?.end(this.layerOf(shownId));
    // Kept only while its drop is put off: a later settle in that frame decides
    // it again.
    if (!this.dropping?.pending) this.dropping = null;
    // A drag ended by something else (R12). A finger down that has not
    // decided yet (a slide ending under it) stays: it can still swipe.
    if (this.run?.phase === "drag") this.swipe?.forget();
    this.run = null;
    this.progressVar.clear();

    scrollTo(0, scrolls.get(shownId ?? -1) ?? 0);

    if (this.prune()) {
      for (const id of scrolls.keys())
        if (!this.committed.some((screen) => screen.id === id))
          scrolls.delete(id);
      this.driver.rerender();
    }

    this.openSwipe();
  }

  /**
   * Drops the screens no entry at or behind the current one shows. Whether any
   * was dropped.
   */
  private prune() {
    const before = this.committed.length;
    this.committed = this.committed.filter(
      (screen) =>
        screen.id === this.shownId ||
        (screen.historyId !== null && this.entries.kept(screen.historyId)),
    );
    return this.committed.length !== before;
  }

  /**
   * A frame after a traversal (not in the event itself: that runs before the
   * router's own listeners). R10, under a swipe's back: the router restored
   * history to the screen shown (React Router's blocker), or holds the entry
   * history went to (TanStack's).
   */
  private onHistory() {
    const run = this.run;
    requestAnimationFrame(() => {
      if (
        run?.phase !== "drag" &&
        run?.await &&
        this.run?.control === run.control
      )
        this.backToRest("blocked");
      // A traversal between two entries of one URL (a tab that replaced its
      // entry with the page behind) renders nothing in Next: no commit would
      // ever show the entry's screen, and a swipe's back would wait for it.
      const { key } = this.entries.current();
      if (this.shown()?.historyId !== this.entries.screenOf(key))
        this.driver?.rerender();
    });
  }

  /**
   * R10: a back a swipe decided that ends on the screen shown slides back to
   * rest: `blocked` after a traversal (a blocker), `returned` after a commit
   * (a guard's redirect). Leaving after all is then a back of its own.
   */
  private backToRest(reason: "blocked" | "returned") {
    const run = this.run;
    if (!run || run.phase === "drag" || !run.await) return;

    const { key } = this.entries.current();
    const held = this.render?.view() === "held";
    const shown = this.shown();
    if (
      !held &&
      (shown?.historyId == null ||
        this.entries.screenOf(key) !== shown.historyId)
    )
      return;

    log(reason);
    this.play({ ...run, phase: "play", end: "leave", await: false });
  }

  /**
   * How far the screen the router renders is in: a push rises to 1, a swipe
   * back falls from 1 until the router commits the back, then rises.
   */
  private progress() {
    const run = this.run;
    if (!run) return null;
    const { progress } = run.control;
    return run.to === this.shownId ? progress : 1 - progress;
  }

  private writeProgress() {
    const progress = this.progress();
    if (this.progressVar.enabled && progress !== null)
      this.progressVar.write(progress);
  }

  private trackProgress() {
    this.progressVar.track(() => this.progress());
  }

  private swipeTarget() {
    if (!this.driver || this.run) return null;

    const from = this.shown();
    const backScreen = this.entries.backScreen();
    const to =
      backScreen === null
        ? undefined
        : this.committed.find((screen) => screen.historyId === backScreen);
    if (!from || !to || to === from) return null;
    const mode = this.options.swipe(from.path, to.path);
    if (!mode) return null;

    const transition = this.options.animate(from.path, to.path, "back");
    const fromHost = this.hostOf(from.id);
    const toHost = this.hostOf(to.id);

    return transition && fromHost && toHost
      ? { from, to, mode, transition, fromHost, toHost }
      : null;
  }

  /**
   * A touch can start a swipe only idle with a screen to go back to: on the
   * shown screen, at its edge, or anywhere if the back allows it. A drag keeps
   * it open.
   */
  private openSwipe() {
    if (!this.swipe || this.run?.phase === "drag") return;
    const target = this.swipeTarget();
    this.swipe?.open(
      target && { host: target.fromHost, fullScreen: target.mode === "full" },
    );
  }

  private beginSwipe(): Drag | null {
    const target = this.swipeTarget();
    if (!target) return null;

    const { from, to, transition, fromHost, toHost } = target;
    this.scrolls.set(from.id, scrollY);

    const control = slide(
      { host: toHost, scroll: this.scrolls.get(to.id) ?? 0 },
      { host: fromHost, scroll: scrollY },
      transition,
      true,
    );

    this.run = { phase: "drag", control, to: to.id };
    log("begin", { from: from.id, to: to.id });
    this.trackProgress();

    return {
      // R7
      seek: (progress) => {
        if (control.ended) return;

        control.seek(progress);
        // Now: the seek runs in a frame callback queued after the tick's.
        this.writeProgress();
        // Whichever end the release decides, the window is already at the
        // nearer screen. (With a margin, so a finger resting at half does not
        // flip it, and scroll, every frame.)
        if (progress > 0.55) control.aim("enter");
        else if (progress < 0.45) control.aim("leave");
      },
      // R8
      release: (back, progress) => {
        if (control.ended) return;

        log("release", { progress, back, shown: control.progress });
        control.seek(progress);

        this.play({
          phase: "play",
          control,
          to: to.id,
          end: back ? "enter" : "leave",
          await: back,
        });

        // A frame later, once the slide plays on the compositor: the router's
        // handling of the back (a render, its loaders) then runs beside the
        // slide, not in the frame that starts it, which it held for tens of ms.
        if (back)
          requestAnimationFrame(() => {
            const run = this.run;
            if (run?.control === control && run.phase !== "drag" && run.await)
              this.entries.back();
          });
      },
    };
  }
}
