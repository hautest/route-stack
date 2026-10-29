import Link from "next/link";
import { Suspense } from "react";
import { CATEGORIES, getFeed } from "@/lib/data";
import { Feed } from "./feed";
import { Header } from "./ui";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <div className="page">
      <Header title="홈" back={false} />
      <Suspense fallback={<p className="loading">불러오는 중…</p>}>
        <FeedSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function FeedSection({
  searchParams,
}: Pick<PageProps<"/">, "searchParams">) {
  const params = await searchParams;
  const category = typeof params.category === "string" ? params.category : null;
  const rows = Number(params.rows) || 300;
  const items = await getFeed({ category, limit: rows });

  return (
    <>
      <nav className="chips">
        <Link className="chip" href="/" aria-current={!category}>
          전체
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c.id}
            className="chip"
            href={`/?category=${c.id}`}
            aria-current={category === c.id}
          >
            {c.label}
          </Link>
        ))}
      </nav>
      <nav className="quick">
        <Link href="/about">소개</Link>
        <Link href="/products?id=1">상품</Link>
        <Link href="/orders">주문</Link>
        <Link href="/settings">설정</Link>
        <Link href="/lab">실험실</Link>
        <Link href="/slow">느린 페이지</Link>
        <Link href="/error">오류 페이지</Link>
        <Link href="/crash">앱 오류</Link>
        <Link href="/items/999">삭제된 글</Link>
        <Link href="/items/1?fail=1">불러오기 실패</Link>
        {/* Plain anchors on purpose: a full document navigation. */}
        <a href="/about">소개(문서 이동)</a>
        <a href="https://example.com">외부 링크</a>
      </nav>
      <Feed key={category ?? ""} category={category} initial={items} />
    </>
  );
}
