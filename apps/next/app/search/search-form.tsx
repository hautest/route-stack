"use client";

import Form from "next/form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const POPULAR = ["리액트", "라우터", "스택"];

export function SearchForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [text, setText] = useState(params.get("q") ?? "");

  return (
    <div className="content stack">
      <Form action="/search/results">
        <input
          className="field"
          type="search"
          name="q"
          placeholder="검색어를 입력하세요"
          autoFocus
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const q = e.target.value;
            router.replace(
              q ? `/search?q=${encodeURIComponent(q)}` : "/search",
              { scroll: false },
            );
          }}
        />
      </Form>
      <div>
        <p className="muted">인기 검색어</p>
        <div className="row">
          {POPULAR.map((q) => (
            <Link
              key={q}
              className="chip"
              href={`/search/results?q=${encodeURIComponent(q)}`}
            >
              {q}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
