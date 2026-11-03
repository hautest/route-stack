const PROGRESS = "--route-stack-progress";

/**
 * `--route-stack-progress` on the root element during a slide, for elements
 * outside the stack (a shared header). Writes nothing unless enabled: each
 * write restyles the whole document.
 */
export class ProgressVar {
  enabled = false;
  private ticking = false;
  /** The value on the root now: written again it would restyle for nothing. */
  private written: number | null = null;

  write(value: number) {
    if (!this.enabled || value === this.written) return;
    this.written = value;
    document.documentElement.style.setProperty(PROGRESS, String(value));
  }

  clear() {
    this.written = null;
    document.documentElement.style.removeProperty(PROGRESS);
  }

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
