import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
} from "@tanstack/react-router";
import { Stack } from "route-stack/tanstack-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import {
  ConfirmProvider,
  errorMessage,
  Header,
  TabBar,
  ToastProvider,
} from "../ui";

import "../styles.css";

export const Route = createRootRoute({
  head: () => ({ meta: [{ title: "커뮤니티 · TanStack Router" }] }),
  component: RootComponent,
  // Errors no route handles itself (e.g. /crash) end up here and replace the whole app.
  errorComponent: ({ error }) => (
    <main className="error">
      <h1>앱 오류</h1>
      <p>{errorMessage(error)}</p>
      <a href="/">홈으로</a>
    </main>
  ),
  notFoundComponent: () => (
    <div className="page">
      <Header title="없는 페이지" />
      <div className="error">
        <p>페이지를 찾을 수 없어요.</p>
        <Link to="/">홈으로</Link>
      </div>
    </div>
  ),
});

function RootComponent() {
  return (
    <>
      <HeadContent />
      <ToastProvider>
        <ConfirmProvider>
          <Stack>
            <Outlet />
          </Stack>
          <TabBar />
        </ConfirmProvider>
      </ToastProvider>
      <TanStackDevtools
        config={{
          position: "bottom-right",
        }}
        plugins={[
          {
            name: "TanStack Router",
            render: <TanStackRouterDevtoolsPanel />,
          },
        ]}
      />
    </>
  );
}
