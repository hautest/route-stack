"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

// Normalizes the URL so every results page carries an explicit sort.
export function SortDefault({ hasSort }: { hasSort: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    if (hasSort) return;
    const next = new URLSearchParams(params);
    next.set("sort", "new");
    router.replace(`${pathname}?${next}`, { scroll: false });
  }, [hasSort, params, pathname, router]);

  return null;
}

export function Results({
  results,
}: {
  results: { id: number; title: string; summary: string }[];
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());
  if (results.length === 0)
    return <p className="loading">검색 결과가 없어요.</p>;
  return (
    <ul className="list">
      {results.map((item) => (
        <li key={item.id}>
          <Link href={`/items/${item.id}`}>{item.title}</Link>
          <button
            className="like"
            aria-expanded={expanded.has(item.id)}
            onClick={() => setExpanded((prev) => new Set(prev).add(item.id))}
          >
            미리보기
          </button>
          {expanded.has(item.id) && <p className="muted">{item.summary}</p>}
        </li>
      ))}
    </ul>
  );
}
