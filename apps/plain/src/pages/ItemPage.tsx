import { useEffect, useState } from "react";
import { getItem, logView, NotFoundError, type ItemDetail } from "../api";
import { Header } from "../Header";
import { Link } from "../router";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; item: ItemDetail };

export function ItemPage({ id, tab }: { id: number; tab: string | null }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    getItem(id).then(
      (item) => active && setState({ status: "ok", item }),
      (error: Error) =>
        active &&
        setState({
          status: "error",
          message:
            error instanceof NotFoundError
              ? error.message
              : "글을 불러오지 못했어요.",
        }),
    );
    return () => {
      active = false;
    };
  }, [id]);

  if (state.status === "loading") {
    return (
      <div className="page">
        <Header title="" />
        <p className="loading">불러오는 중…</p>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="page">
        <Header title="글 없음" />
        <div className="error">
          <p>{state.message}</p>
          <Link href="/">홈으로</Link>
        </div>
      </div>
    );
  }
  return <ItemView item={state.item} tab={tab === "info" ? "info" : "body"} />;
}

function ItemView({ item, tab }: { item: ItemDetail; tab: "body" | "info" }) {
  const [showAll, setShowAll] = useState(false);
  const [views, setViews] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    logView(item.id).then((count) => active && setViews(count));
    return () => {
      active = false;
    };
  }, [item.id]);

  // An anchor in the initial URL can only be scrolled to once the content exists.
  useEffect(() => {
    if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
  }, []);

  const comments = showAll ? item.comments : item.comments.slice(0, 2);

  return (
    <div className="page">
      <title>{item.title}</title>
      <Header title={item.title} />
      <nav className="tabs">
        <Link href={`/items/${item.id}`} aria-current={tab === "body"}>
          본문
        </Link>
        <Link href={`/items/${item.id}?tab=info`} aria-current={tab === "info"}>
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
          <Link href="#comments">댓글로 이동</Link>
        </div>
        <h3>관련 글</h3>
        <ul>
          {item.related.map((r) => (
            <li key={r.id}>
              <Link href={`/items/${r.id}`}>{r.title}</Link>
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
    </div>
  );
}
