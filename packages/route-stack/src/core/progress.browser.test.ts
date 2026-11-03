import { afterEach, expect, test, vi } from "vitest";
import { ProgressVar } from "./progress";

afterEach(() => vi.restoreAllMocks());

// Each write restyles the whole document: a value already there is not
// written again (a drag writes from its seek and its tick in one frame; a back
// awaiting its commit holds one value every frame).
test("a value already written is not written again", () => {
  const set = vi.spyOn(document.documentElement.style, "setProperty");
  const progress = new ProgressVar();
  progress.enabled = true;

  progress.write(0.5);
  progress.write(0.5);
  progress.write(0.6);
  expect(set).toHaveBeenCalledTimes(2);

  progress.clear();
  progress.write(0.6);
  expect(set).toHaveBeenCalledTimes(3);
  progress.clear();
});
