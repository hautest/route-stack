"use client";

import {
  Activity,
  use,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Core } from "../core/core";
import { defaultSameScreen } from "../history/screens";
import { defaultAnimate, onAndroid } from "../transition/transitions";
import type { AdapterProps, StackProps, View } from "../types";

// A thenable already marked pending: React reads the status and suspends
// without subscribing (a plain promise gets a then() per render).
const never = {
  status: "pending",
  then() {},
} as unknown as Promise<never>;

/** A hidden screen suspends, so it does not re-render while kept. */
function Gate({ frozen, children }: { frozen: boolean; children: ReactNode }) {
  if (frozen) use(never);
  return children;
}

const current = (): View => "current";

export function Stack({
  path,
  view = current,
  animate = defaultAnimate,
  swipe = onAndroid() ? false : "edge",
  sameScreen = defaultSameScreen,
  enableProgressCssVar = false,
  children,
}: StackProps & AdapterProps) {
  const [, refresh] = useReducer((count: number) => count + 1, 0);
  const [core] = useState(() => new Core());
  const [elements] = useState(() => new Map<number, ReactNode>());
  const root = useRef<HTMLDivElement>(null);

  // No history on the server for an adapter to compare with: a render there is
  // the one screen there is.
  const render = { path, view: typeof window === "undefined" ? current : view };
  const id = core.resolve(render);
  elements.set(id, children);
  const screens = core.screens();
  for (const kept of elements.keys())
    if (!screens.some((screen) => screen.id === kept)) elements.delete(kept);

  // Every commit: the shown screen can change on any render.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    core.update({
      animate,
      progress: enableProgressCssVar,
      swipe: typeof swipe === "function" ? swipe : () => swipe,
      sameScreen,
    });
    core.commit(id, render);
  });

  const listening = swipe !== false;
  useEffect(() => core.listen(listening), [core, listening]);

  useEffect(() => {
    core.attach({
      host: (screen) =>
        root.current?.querySelector<HTMLElement>(
          `:scope > [data-stack-screen="${screen}"]`,
        ) ?? null,
      rerender: refresh,
    });
    return () => core.detach();
  }, [core]);

  return (
    <div ref={root} data-stack-root="" style={{ isolation: "isolate" }}>
      {/* The screen element is the layer a slide lifts and moves; React hides
          and shows the content inside it. Hiding the element whose animation
          runs (a back committed mid-swipe) made iOS WebKit rebuild the
          animation: the screen jumped back and held. */}
      {screens.map((screen) => (
        // flow-root: a page's top margin stays inside its screen at rest, as
        // in a lifted (fixed) layer, so lifting does not shift the content.
        <div
          key={screen.id}
          data-stack-screen={screen.id}
          style={{ display: "flow-root" }}
        >
          <Activity mode={screen.id === id ? "visible" : "hidden"}>
            <div data-stack-content="">
              <Gate frozen={screen.id !== id}>{elements.get(screen.id)}</Gate>
            </div>
          </Activity>
        </div>
      ))}
    </div>
  );
}
