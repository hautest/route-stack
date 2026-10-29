"use client";

import Link from "next/link";
import { Header } from "../ui";

// Production hides server error messages, so the boundary shows its own text.
export default function RouteError() {
  return (
    <div className="page">
      <Header title="오류" />
      <div className="error">
        <p>/error 렌더 중 오류</p>
        <Link href="/">홈으로</Link>
      </div>
    </div>
  );
}
