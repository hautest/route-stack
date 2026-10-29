import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import "./index.css";
import * as root from "./routes/root";
import * as home from "./routes/home";
import * as about from "./routes/about";
import * as search from "./routes/search";
import * as searchResults from "./routes/search-results";
import * as item from "./routes/item";
import * as itemDetail from "./routes/item-detail";
import * as itemEdit from "./routes/item-edit";
import * as products from "./routes/products";
import * as me from "./routes/me";
import * as orders from "./routes/orders";
import * as settings from "./routes/settings";
import * as login from "./routes/login";
import * as lab from "./routes/lab";
import * as slow from "./routes/slow";
import * as errorPage from "./routes/error";
import * as crash from "./routes/crash";
import * as notFound from "./routes/not-found";

const router = createBrowserRouter([
  {
    path: "/",
    ...root,
    children: [
      { index: true, ...home },
      { path: "about", ...about },
      { path: "search", ...search },
      { path: "search/results", ...searchResults },
      {
        path: "items/:id",
        ...item,
        children: [
          { index: true, ...itemDetail },
          { path: "edit", ...itemEdit },
        ],
      },
      { path: "products", ...products },
      { path: "me", ...me },
      { path: "orders", ...orders },
      { path: "settings", ...settings },
      { path: "login", ...login },
      { path: "lab", ...lab },
      { path: "slow", ...slow },
      { path: "error", ...errorPage },
      { path: "crash", ...crash },
      { path: "*", ...notFound },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
