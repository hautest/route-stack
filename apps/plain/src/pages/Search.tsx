import { useState } from "react";
import { Header } from "../Header";
import { Link, navigate } from "../router";

const POPULAR = ["리액트", "라우터", "스택"];

export function Search() {
  const [text, setText] = useState(
    () => new URLSearchParams(location.search).get("q") ?? "",
  );

  return (
    <div className="page">
      <Header title="탐색" back={false} />
      <div className="content stack">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate(`/search/results?q=${encodeURIComponent(text)}`);
          }}
        >
          <input
            className="field"
            type="search"
            name="q"
            placeholder="검색어를 입력하세요"
            autoFocus
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              const q = e.target.value;
              navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search", {
                replace: true,
              });
            }}
          />
        </form>
        <div>
          <p className="muted">인기 검색어</p>
          <div className="row">
            {POPULAR.map((q) => (
              <Link
                key={q}
                className="chip"
                href={`/search/results?q=${encodeURIComponent(q)}`}
              >
                {q}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
