import Link from "next/link";
import { Header } from "./ui";

export default function NotFound() {
  return (
    <div className="page">
      <Header title="없는 페이지" />
      <div className="error">
        <p>페이지를 찾을 수 없어요.</p>
        <Link href="/">홈으로</Link>
      </div>
    </div>
  );
}
