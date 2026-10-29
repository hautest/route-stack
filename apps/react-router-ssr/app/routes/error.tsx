import { Link } from "react-router";
import { Header } from "../ui";

export default function ErrorPage(): never {
  throw new Error("/error 렌더 중 오류");
}

// Fixed text: production SSR replaces server error messages with a generic one.
export function ErrorBoundary() {
  return (
    <div className="page">
      <Header title="오류" />
      <div className="error">
        <p>/error 렌더 중 오류가 났어요.</p>
        <Link to="/">홈으로</Link>
      </div>
    </div>
  );
}
