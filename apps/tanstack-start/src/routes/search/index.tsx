import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Header } from "../../ui";

const POPULAR = ["리액트", "라우터", "스택"];

export const Route = createFileRoute("/search/")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" && search.q ? search.q : undefined,
  }),
  component: Search,
});

function Search() {
  const { q } = Route.useSearch();
  const navigate = useNavigate({ from: "/search/" });
  const [text, setText] = useState(q ?? "");

  return (
    <div className="page">
      <Header title="탐색" back={false} />
      <div className="content stack">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ to: "/search/results", search: { q: text } });
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
              navigate({
                search: { q: e.target.value || undefined },
                replace: true,
              });
            }}
          />
        </form>
        <div>
          <p className="muted">인기 검색어</p>
          <div className="row">
            {POPULAR.map((word) => (
              <Link
                key={word}
                className="chip"
                to="/search/results"
                search={{ q: word }}
              >
                {word}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
