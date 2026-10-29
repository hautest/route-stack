const PROGRESS = "--route-stack-progress";

/**
 * `--route-stack-progress` on the root element during a slide, for elements
 * outside the stack (a shared header). Writes nothing unless enabled: each
 * write restyles the whole document.
 */
export class ProgressVar {
  enabled = false;
  private ticking = false;

  write(value: number) {
    if (this.enabled)
      document.documentElement.style.setProperty(PROGRESS, String(value));
  }

  clear() {
    document.documentElement.style.removeProperty(PROGRESS);
  }

  /** Writes `read()` every frame until it gives null, then clears. */
  track(read: () => number | null) {
    if (!this.enabled || this.ticking) return;

    this.ticking = true;
    const tick = () => {
      const value = read();
      if (value !== null) {
        this.write(value);
        requestAnimationFrame(tick);
        return;
      }

      this.ticking = false;
      this.clear();
    };
    tick();
  }
}
