import Form from "next/form";
import Link from "next/link";
import { search } from "@/lib/data";
import { Header } from "../../ui";
import { Results, SortDefault } from "./results";

export default async function SearchResults({
  searchParams,
}: PageProps<"/search/results">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const sort = params.sort === "popular" ? "popular" : "new";
  const results = await search(q, sort);

  return (
    <div className="page">
      <SortDefault hasSort={typeof params.sort === "string"} />
      <Header title={`"${q}" 검색 결과`} />
      <div className="content">
        <Form action="/search/results">
          <input
            className="field"
            type="search"
            name="q"
            defaultValue={q}
            key={q}
          />
        </Form>
      </div>
      <nav className="tabs">
        <Link
          href={`/search/results?q=${encodeURIComponent(q)}&sort=new`}
          replace
          aria-current={sort === "new"}
        >
          최신순
        </Link>
        <Link
          href={`/search/results?q=${encodeURIComponent(q)}&sort=popular`}
          replace
          aria-current={sort === "popular"}
        >
          인기순
        </Link>
      </nav>
      <Results
        key={q}
        results={results.map(({ id, title, body }) => ({
          id,
          title,
          summary: body[0],
        }))}
      />
    </div>
  );
}
