import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/crash")({
  component: Crash,
  // No boundary here, so the error reaches the root route.
  errorComponent: false,
});

function Crash(): never {
  throw new Error("/crash 렌더 중 오류");
}
