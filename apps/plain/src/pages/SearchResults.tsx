import { useEffect, useState } from "react";
import { search, type Item } from "../api";
import { Header } from "../Header";
import { Link, navigate } from "../router";

export function SearchResults({ q, sort }: { q: string; sort: string | null }) {
  const [results, setResults] = useState<Item[] | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  const [text, setText] = useState(q);
  const base = `/search/results?q=${encodeURIComponent(q)}`;

  useEffect(() => {
    if (!sort) navigate(`${base}&sort=new`, { replace: true });
  }, [base, sort]);

  useEffect(() => {
    let active = true;
    search(q, sort ?? "new").then((r) => active && setResults(r));
    return () => {
      active = false;
    };
  }, [q, sort]);

  return (
    <div className="page">
      <Header title={`"${q}" 검색 결과`} />
      <div className="content">
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
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </form>
      </div>
      <nav className="tabs">
        <Link
          href={`${base}&sort=new`}
          replace
          aria-current={(sort ?? "new") === "new"}
        >
          최신순
        </Link>
        <Link
          href={`${base}&sort=popular`}
          replace
          aria-current={sort === "popular"}
        >
          인기순
        </Link>
      </nav>
      {results === null ? (
        <p className="loading">검색 중…</p>
      ) : results.length === 0 ? (
        <p className="loading">검색 결과가 없어요.</p>
      ) : (
        <ul className="list">
          {results.map((item) => (
            <li key={item.id}>
              <Link href={`/items/${item.id}`}>{item.title}</Link>
              <button
                className="like"
                aria-expanded={expanded.has(item.id)}
                onClick={() =>
                  setExpanded((prev) => new Set(prev).add(item.id))
                }
              >
                미리보기
              </button>
              {expanded.has(item.id) && <p className="muted">{item.body[0]}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
