"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FeedItem } from "@/lib/data";

const PAGE_SIZE = 20;

export function Feed({
  category,
  initial,
}: {
  category: string | null;
  initial: FeedItem[];
}) {
  const [items, setItems] = useState(initial);
  const [liked, setLiked] = useState<ReadonlySet<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [since, setSince] = useState(() => Date.now());
  const [newCount, setNewCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(async () => {
      const res = await fetch(`/api/new-posts?since=${since}`);
      setNewCount((await res.json()).count);
    }, 30_000);
    return () => clearInterval(timer);
  }, [since]);

  const loadMore = async () => {
    setLoading(true);
    const query = new URLSearchParams({
      offset: String(items.length),
      limit: String(PAGE_SIZE),
    });
    if (category) query.set("category", category);
    const more: FeedItem[] = await (await fetch(`/api/feed?${query}`)).json();
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
            <Link href={`/items/${item.id}`}>{item.title}</Link>
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
