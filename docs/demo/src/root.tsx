import { useEffect, useState } from "react";
import { Outlet } from "react-router";
import { android, defaultAnimate, ios, material, onAndroid } from "route-stack";
import { Stack } from "route-stack/react-router";
import { canSwipeWithMouse, mouseAsTouch } from "./mouse-as-touch";

const presets = {
  default: null,
  ios,
  android,
  material,
  off: false,
} as const;

type Preset = keyof typeof presets;
const swipes = ["default", "edge", "full", "false"] as const;
type Swipe = (typeof swipes)[number];

const query = new URLSearchParams(location.search);
const pick = <T extends string>(
  key: string,
  values: readonly T[],
  fallback: T,
) => {
  const asked = query.get(key);
  return values.includes(asked as T) ? (asked as T) : fallback;
};

// Browsers on iOS (Safari and the others, all WebKit) have their own edge swipe
// back, and both ran at once: there the demo starts with the stack's swipe off
// (the select still turns it on).
const iosSafari =
  /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const swipeOff = onAndroid() || iosSafari;

let anywhere = false;
mouseAsTouch(() => anywhere);

export function Root() {
  const [preset, setPreset] = useState(() =>
    pick("preset", Object.keys(presets) as Preset[], "default"),
  );
  const [swipe, setSwipe] = useState(() => pick("swipe", swipes, "default"));

  const mode = swipe === "default" ? (swipeOff ? "false" : "edge") : swipe;
  useEffect(() => {
    anywhere = mode === "full";
    document.documentElement.dataset.swipe = mode;
  }, [mode]);

  const where = mode === "full" ? "anywhere" : "from the left edge";

  return (
    <>
      <Stack
        animate={(from, to, direction) => {
          const chosen = presets[preset];
          return chosen === null ? defaultAnimate(from, to, direction) : chosen;
        }}
        swipe={mode === "false" ? false : mode}
      >
        <Outlet />
      </Stack>
      {/* Outside the stack: fixed, so it stays while the screens slide. */}
      <header className="bar">
        <label>
          animate
          <select
            value={preset}
            onChange={(event) => setPreset(event.target.value as Preset)}
          >
            {Object.keys(presets).map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        <label>
          swipe
          <select
            value={swipe}
            onChange={(event) => setSwipe(event.target.value as Swipe)}
          >
            {swipes.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      </header>
      <p className="hint">
        {mode === "false"
          ? iosSafari && swipe === "default"
            ? "Swipe is off in Safari, which has its own: the back button still animates"
            : "Swipe is off: the back button still animates"
          : matchMedia("(pointer: coarse)").matches
            ? `Swipe ${where} to go back`
            : canSwipeWithMouse()
              ? `Drag ${where} to go back`
              : "Open on a phone to try the swipe"}
      </p>
    </>
  );
}
