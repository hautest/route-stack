import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("about", "routes/about.tsx"),
  route("search", "routes/search.tsx"),
  route("search/results", "routes/search-results.tsx"),
  route("items/:id", "routes/item.tsx", [
    index("routes/item-detail.tsx"),
    route("edit", "routes/item-edit.tsx"),
  ]),
  route("products", "routes/products.tsx"),
  route("me", "routes/me.tsx"),
  route("orders", "routes/orders.tsx"),
  route("settings", "routes/settings.tsx"),
  route("login", "routes/login.tsx"),
  route("lab", "routes/lab.tsx"),
  route("slow", "routes/slow.tsx"),
  route("error", "routes/error.tsx"),
  route("crash", "routes/crash.tsx"),
  route("api/feed", "routes/api.feed.ts"),
  route("api/new-posts", "routes/api.new-posts.ts"),
  route("api/views/:id", "routes/api.views.ts"),
  route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
