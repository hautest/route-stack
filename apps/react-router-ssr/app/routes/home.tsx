import { useEffect, useState } from "react";
import { Link, useFetcher } from "react-router";
import { CATEGORIES, getFeed, type Item } from "../data.server";
import { Header } from "../ui";
import type { Route } from "./+types/home";
import type { loader as newPostsLoader } from "./api.new-posts";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  const rows = Number(url.searchParams.get("rows")) || 300;
  return {
    categories: CATEGORIES,
    category,
    items: await getFeed({ category, limit: rows }),
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { categories, category, items } = loaderData;
  return (
    <div className="page">
      <Header title="홈" back={false} />
      <nav className="chips">
        <Link className="chip" to="/" aria-current={!category}>
          전체
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            className="chip"
            to={`/?category=${c.id}`}
            aria-current={category === c.id}
          >
            {c.label}
          </Link>
        ))}
      </nav>
      <nav className="quick">
        <Link to="/about">소개</Link>
        <Link to="/products?id=1">상품</Link>
        <Link to="/orders">주문</Link>
        <Link to="/settings">설정</Link>
        <Link to="/lab">실험실</Link>
        <Link to="/slow">느린 페이지</Link>
        <Link to="/error">오류 페이지</Link>
        <Link to="/crash">앱 오류</Link>
        <Link to="/items/999">삭제된 글</Link>
        <Link to="/items/1?fail=1">불러오기 실패</Link>
        <a href="/about">소개(문서 이동)</a>
        <a href="https://example.com">외부 링크</a>
      </nav>
      <Feed key={category ?? ""} category={category} initial={items} />
    </div>
  );
}

function Feed({
  category,
  initial,
}: {
  category: string | null;
  initial: Item[];
}) {
  const [items, setItems] = useState(initial);
  const [liked, setLiked] = useState<ReadonlySet<number>>(new Set());
  const [since, setSince] = useState(() => Date.now());
  const [loading, setLoading] = useState(false);
  const newPosts = useFetcher<typeof newPostsLoader>();
  const { load: loadNewPosts } = newPosts;

  useEffect(() => {
    const timer = setInterval(
      () => loadNewPosts(`/api/new-posts?since=${since}`),
      30_000,
    );
    return () => clearInterval(timer);
  }, [since, loadNewPosts]);

  // A response for an earlier `since` is stale after the banner was dismissed.
  const newCount = newPosts.data?.since === since ? newPosts.data.count : 0;

  // Appends pages, which a fetcher's single `data` slot doesn't model, so this is a plain fetch.
  const loadMore = async () => {
    setLoading(true);
    const params = new URLSearchParams({ offset: String(items.length) });
    if (category) params.set("category", category);
    const res = await fetch(`/api/feed?${params}`);
    const more: Item[] = await res.json();
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
          <button className="like" onClick={() => setSince(Date.now())}>
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
            <Link to={`/items/${item.id}`}>{item.title}</Link>
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
