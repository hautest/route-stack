import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { CATEGORIES, getFeed, getNewPostCount, type Item } from "../api";
import { Header } from "../ui";

const PAGE_SIZE = 20;

export const Route = createFileRoute("/")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { category?: string; rows?: number } => ({
    category: typeof search.category === "string" ? search.category : undefined,
    rows: Number(search.rows) || undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps: { category, rows = 300 } }) =>
    getFeed({ data: { category, limit: rows } }),
  component: Home,
});

function Home() {
  const { category } = Route.useSearch();
  const items = Route.useLoaderData();
  return (
    <div className="page">
      <Header title="홈" back={false} />
      <nav className="chips">
        <Link className="chip" to="/" aria-current={!category}>
          전체
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c.id}
            className="chip"
            to="/"
            search={{ category: c.id }}
            aria-current={category === c.id}
          >
            {c.label}
          </Link>
        ))}
      </nav>
      <nav className="quick">
        <Link to="/about">소개</Link>
        <Link to="/products" search={{ id: 1 }}>
          상품
        </Link>
        <Link to="/orders">주문</Link>
        <Link to="/settings">설정</Link>
        <Link to="/lab">실험실</Link>
        <Link to="/slow">느린 페이지</Link>
        <Link to="/error">오류 페이지</Link>
        <Link to="/crash">앱 오류</Link>
        <Link to="/items/$id" params={{ id: "999" }}>
          삭제된 글
        </Link>
        <Link to="/items/$id" params={{ id: "1" }} search={{ fail: 1 }}>
          불러오기 실패
        </Link>
        <a href="/about">소개(문서 이동)</a>
        <a href="https://example.com">외부 링크</a>
      </nav>
      <Feed key={category ?? ""} category={category} initial={items} />
    </div>
  );
}

function Feed({ category, initial }: { category?: string; initial: Item[] }) {
  const [items, setItems] = useState(initial);
  const [liked, setLiked] = useState<ReadonlySet<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [since, setSince] = useState(() => Date.now());
  const [newCount, setNewCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      async () => setNewCount(await getNewPostCount({ data: since })),
      30_000,
    );
    return () => clearInterval(timer);
  }, [since]);

  const loadMore = async () => {
    setLoading(true);
    const more = await getFeed({
      data: { category, offset: items.length, limit: PAGE_SIZE },
    });
    setItems((prev) => [...prev, ...more]);
    setLoading(false);
  };

  const toggleLike = (id: number) =>
    setLiked((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <>
      {newCount > 0 && (
        <div className="banner" role="status">
          새 글 {newCount}개
          <button
            className="like"
            onClick={() => {
              setSince(Date.now());
              setNewCount(0);
            }}
          >
            확인
          </button>
        </div>
      )}
      {items.map((item) => (
        <article key={item.id} className="card">
          {item.video ? (
            <video src={item.video} autoPlay muted loop playsInline />
          ) : (
            <img src={item.image} alt="" width={390} height={180} />
          )}
          <h2>
            <Link to="/items/$id" params={{ id: String(item.id) }}>
              {item.title}
            </Link>
          </h2>
          <div className="row muted">
            <span>{item.author}</span>
            <button
              className="like"
              aria-pressed={liked.has(item.id)}
              onClick={() => toggleLike(item.id)}
            >
              ♥ {item.likes + (liked.has(item.id) ? 1 : 0)}
            </button>
          </div>
        </article>
      ))}
      <button
        className="button secondary more"
        onClick={loadMore}
        disabled={loading}
      >
        {loading ? "불러오는 중…" : "더 보기"}
      </button>
    </>
  );
}
