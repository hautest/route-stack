// Development log of transition phases: an app (or a test harness) sets a
// function on this symbol to receive them, e.g. to send them from a phone to a
// computer. Nothing is logged otherwise.
const SINK = Symbol.for("route-stack.log");

type Sink = (event: string, data?: object) => void;

export const log = (event: string, data?: object) =>
  (globalThis as { [SINK]?: Sink })[SINK]?.(event, data);

declare const process: { env: { NODE_ENV?: string } };

// The app's bundler inlines NODE_ENV; without one, `process` is not defined in
// a browser and the checks are off.
export const dev = (() => {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
})();
