import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { Artist } from "./artist";
import { Home } from "./home";
import { Item } from "./item";
import { Root } from "./root";
import { Track } from "./track";
import "./style.css";

const router = createBrowserRouter(
  [
    {
      path: "/",
      Component: Root,
      children: [
        { index: true, Component: Home },
        { path: "items/:id", Component: Item },
        { path: "items/:id/tracks/:track", Component: Track },
        { path: "artists/:name", Component: Artist },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, "") },
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
