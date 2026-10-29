"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FeedItem } from "@/lib/data";
import { useItem } from "./item-context";

export function ItemDetail({
  tab,
  comments,
  related,
}: {
  tab: "body" | "info";
  comments: string[];
  related: FeedItem[];
}) {
  const item = useItem();
  const [showAll, setShowAll] = useState(false);
  const [views, setViews] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/views/${item.id}`, { method: "POST" })
      .then((res) => res.json())
      .then(({ count }) => active && setViews(count));
    return () => {
      active = false;
    };
  }, [item.id]);

  const shown = showAll ? comments : comments.slice(0, 2);

  return (
    <>
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
          <Link href={`/items/${item.id}/edit`}>수정</Link>
        </div>
        <h3>관련 글</h3>
        <ul>
          {related.map((r) => (
            <li key={r.id}>
              <Link href={`/items/${r.id}`}>{r.title}</Link>
            </li>
          ))}
        </ul>
        <section id="comments">
          <h3>댓글 {comments.length}개</h3>
          <ul>
            {shown.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          {!showAll && (
            <button
              className="button secondary"
              onClick={() => setShowAll(true)}
            >
              댓글 {comments.length - 2}개 더 보기
            </button>
          )}
        </section>
      </div>
    </>
  );
}
