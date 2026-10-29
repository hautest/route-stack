import { Suspense } from "react";
import { Header } from "../ui";
import { SearchForm } from "./search-form";

export default function Search() {
  return (
    <div className="page">
      <Header title="탐색" back={false} />
      <Suspense>
        <SearchForm />
      </Suspense>
    </div>
  );
}
