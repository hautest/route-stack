import { Link, useRouteError } from "react-router";
import { Header } from "../ui";

export function Component(): never {
  throw new Error("/error 렌더 중 오류");
}

export function ErrorBoundary() {
  const error = useRouteError();
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
