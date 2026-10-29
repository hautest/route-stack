import { Link, useLocation } from "./router";
import { Home } from "./pages/Home";
import { About } from "./pages/About";
import { Search } from "./pages/Search";
import { SearchResults } from "./pages/SearchResults";
import { ItemPage } from "./pages/ItemPage";
import { Products } from "./pages/Products";
import { Lab } from "./pages/Lab";
import { Me } from "./pages/Me";
import { NotFound } from "./pages/NotFound";

function page(url: URL) {
  const params = url.searchParams;
  const item = url.pathname.match(/^\/items\/(\d+)$/);
  if (item)
    return (
      <ItemPage key={item[1]} id={Number(item[1])} tab={params.get("tab")} />
    );
  switch (url.pathname) {
    case "/":
      return (
        <Home
          key={params.get("category")}
          category={params.get("category")}
          rows={Number(params.get("rows")) || 300}
        />
      );
    case "/about":
      return <About />;
    case "/search":
      return <Search />;
    case "/search/results":
      return (
        <SearchResults
          key={params.get("q")}
          q={params.get("q") ?? ""}
          sort={params.get("sort")}
        />
      );
    case "/products":
      return <Products key={params.get("id")} id={Number(params.get("id"))} />;
    case "/lab":
      return <Lab />;
    case "/me":
      return <Me />;
    default:
      return <NotFound />;
  }
}

export function App() {
  const url = useLocation();
  const tab = (href: string) => (
    <Link
      href={href}
      replace
      aria-current={url.pathname === href ? "page" : undefined}
    >
      {{ "/": "홈", "/search": "탐색", "/me": "마이" }[href]}
    </Link>
  );
  return (
    <>
      {page(url)}
      <nav className="tabbar">
        {tab("/")}
        {tab("/search")}
        {tab("/me")}
      </nav>
    </>
  );
}
