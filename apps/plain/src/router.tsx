// Minimal History API routing: no router library.
import {
  useSyncExternalStore,
  type ComponentProps,
  type MouseEvent,
} from "react";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    removeEventListener("popstate", listener);
  };
}

// The hash is not part of the location: jumping to an anchor stays on the same page.
const getLocation = () => location.pathname + location.search;

export function useLocation() {
  const current = useSyncExternalStore(subscribe, getLocation);
  return new URL(current, location.origin);
}

export function navigate(to: string, { replace = false } = {}) {
  if (replace) history.replaceState(null, "", to);
  else history.pushState(null, "", to);
  for (const listener of listeners) listener();
  if (!replace) scrollTo(0, 0);
}

export function Link({
  href,
  replace,
  onClick,
  ...props
}: ComponentProps<"a"> & { replace?: boolean }) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      !href ||
      href.startsWith("#")
    ) {
      return;
    }
    event.preventDefault();
    navigate(href, { replace });
  };
  return <a href={href} onClick={handleClick} {...props} />;
}
