import { useState } from "react";
import { Form, Link, useSearchParams } from "react-router";
import { Header } from "../ui";

const POPULAR = ["리액트", "라우터", "스택"];

export function Component() {
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(params.get("q") ?? "");

  return (
    <div className="page">
      <Header title="탐색" back={false} />
      <div className="content stack">
        <Form action="/search/results">
          <input
            className="field"
            type="search"
            name="q"
            placeholder="검색어를 입력하세요"
            autoFocus
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setParams(e.target.value ? { q: e.target.value } : {}, {
                replace: true,
              });
            }}
          />
        </Form>
        <div>
          <p className="muted">인기 검색어</p>
          <div className="row">
            {POPULAR.map((q) => (
              <Link
                key={q}
                className="chip"
                to={`/search/results?q=${encodeURIComponent(q)}`}
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
