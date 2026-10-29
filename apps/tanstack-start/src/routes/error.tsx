import {
  Link,
  createFileRoute,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { Header } from "../ui";

export const Route = createFileRoute("/error")({
  component: ErrorPage,
  errorComponent: RouteError,
});

function ErrorPage(): never {
  throw new Error("/error 렌더 중 오류");
}

function RouteError({ error }: ErrorComponentProps) {
  return (
    <div className="page">
      <Header title="오류" />
      <div className="error">
        <p>{error instanceof Error ? error.message : "오류가 났어요."}</p>
        <Link to="/">홈으로</Link>
      </div>
    </div>
  );
}
