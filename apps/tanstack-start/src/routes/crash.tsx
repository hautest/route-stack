import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/crash")({
  component: Crash,
  // Without its own boundary the error reaches the root route's errorComponent.
  errorComponent: false,
});

function Crash(): never {
  throw new Error("/crash 렌더 중 오류");
}
