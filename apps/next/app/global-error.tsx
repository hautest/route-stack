"use client";

import "./globals.css";

// Errors no segment handles (e.g. /crash) replace the root layout, so this renders its own document.
export default function GlobalError() {
  return (
    <html lang="ko">
      <body>
        <main className="error">
          <h1>앱 오류</h1>
          <p>앱을 표시하는 중 오류가 났어요.</p>
          <a href="/">홈으로</a>
        </main>
      </body>
    </html>
  );
}
