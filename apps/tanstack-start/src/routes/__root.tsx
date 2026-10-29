import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { Stack } from "route-stack/tanstack-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { ConfirmProvider, Header, TabBar, ToastProvider } from "../ui";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "커뮤니티 · TanStack Start",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
  component: RootComponent,
  // Errors no route handles itself (e.g. /crash) end up here and replace the whole app.
  errorComponent: RootError,
  notFoundComponent: NotFound,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <Stack>
          <Outlet />
        </Stack>
        <TabBar />
      </ConfirmProvider>
    </ToastProvider>
  );
}

function RootError({ error }: ErrorComponentProps) {
  return (
    <main className="error">
      <h1>앱 오류</h1>
      <p>{error instanceof Error ? error.message : "알 수 없는 오류"}</p>
      <Link to="/">홈으로</Link>
    </main>
  );
}

function NotFound() {
  return (
    <div className="page">
      <Header title="없는 페이지" />
      <div className="error">
        <p>페이지를 찾을 수 없어요.</p>
        <Link to="/">홈으로</Link>
      </div>
    </div>
  );
}
