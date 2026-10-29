import {
  isRouteErrorResponse,
  Link,
  Outlet,
  ScrollRestoration,
  useRouteError,
} from "react-router";
import { Stack } from "route-stack/react-router";
import { ConfirmProvider, TabBar, ToastProvider } from "../ui";

export function Component() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <Stack>
          <Outlet />
        </Stack>
        <TabBar />
        <ScrollRestoration />
      </ConfirmProvider>
    </ToastProvider>
  );
}

export function HydrateFallback() {
  return <div className="loading">불러오는 중…</div>;
}

// Errors no route handles itself (e.g. /crash) end up here and replace the whole app.
export function ErrorBoundary() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : "알 수 없는 오류";
  return (
    <main className="error">
      <h1>앱 오류</h1>
      <p>{message}</p>
      <Link to="/">홈으로</Link>
    </main>
  );
}
