"use client";

import Link from "next/link";

// Production hides server error messages, so the boundary shows its own text.
export default function ItemError() {
  return (
    <div className="error">
      <p>글을 불러오지 못했어요.</p>
      <Link href="/">홈으로</Link>
    </div>
  );
}
