import { createFileRoute, Link } from "@tanstack/react-router";
import { errorMessage, Header } from "../ui";

export const Route = createFileRoute("/error")({
  component: ErrorPage,
  errorComponent: ({ error }) => (
    <div className="page">
      <Header title="오류" />
      <div className="error">
        <p>{errorMessage(error)}</p>
        <Link to="/">홈으로</Link>
      </div>
    </div>
  ),
});

function ErrorPage(): never {
  throw new Error("/error 렌더 중 오류");
}
