import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useItem } from "./item-context";

export default function ItemDetailPage() {
  const item = useItem();
  const [params] = useSearchParams();
  const tab = params.get("tab") === "info" ? "info" : "body";
  const [showAll, setShowAll] = useState(false);
  const [views, setViews] = useState<number | null>(null);

  useEffect(() => {
    // Plain fetch, not a fetcher: a fetcher POST would revalidate the item loader.
    const controller = new AbortController();
    fetch(`/api/views/${item.id}`, {
      method: "POST",
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((body: { views: number }) => setViews(body.views))
      .catch(() => {});
    return () => controller.abort();
  }, [item.id]);

  const comments = showAll ? item.comments : item.comments.slice(0, 2);

  return (
    <>
      <nav className="tabs">
        <Link to={`/items/${item.id}`} aria-current={tab === "body"}>
          본문
        </Link>
        <Link to={`/items/${item.id}?tab=info`} aria-current={tab === "info"}>
          정보
        </Link>
      </nav>
      <div className="content">
        {tab === "body" ? (
          <>
            <img
              src={item.image}
              alt=""
              width={390}
              height={180}
              style={{ width: "100%", height: "auto" }}
            />
            {item.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </>
        ) : (
          <dl>
            <dt>작성자</dt>
            <dd>{item.author}</dd>
            <dt>카테고리</dt>
            <dd>{item.category}</dd>
            <dt>좋아요</dt>
            <dd>{item.likes}</dd>
          </dl>
        )}
        <p className="muted">조회수 {views ?? "-"}</p>
        <div className="row">
          <a href="#comments">댓글 보기 ↓</a>
          <Link to="#comments">댓글로 이동</Link>
          <Link to={`/items/${item.id}/edit`}>수정</Link>
        </div>
        <h3>관련 글</h3>
        <ul>
          {item.related.map((r) => (
            <li key={r.id}>
              <Link to={`/items/${r.id}`}>{r.title}</Link>
            </li>
          ))}
        </ul>
        <section id="comments">
          <h3>댓글 {item.comments.length}개</h3>
          <ul>
            {comments.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          {!showAll && (
            <button
              className="button secondary"
              onClick={() => setShowAll(true)}
            >
              댓글 {item.comments.length - 2}개 더 보기
            </button>
          )}
        </section>
      </div>
    </>
  );
}
