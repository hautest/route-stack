import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { isLoggedIn, login, safeNext } from "../api";
import { Header, useToast } from "../ui";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { next?: string } => ({
    next: typeof search.next === "string" ? search.next : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (isLoggedIn()) throw redirect({ href: safeNext(search.next ?? null) });
  },
  component: Login,
});

function Login() {
  const { next } = Route.useSearch();
  const navigate = Route.useNavigate();
  const toast = useToast();
  return (
    <div className="page">
      <Header title="로그인" />
      <div className="content stack">
        <p>로그인하면 마이, 주문, 설정을 볼 수 있어요.</p>
        <button
          className="button"
          onClick={() => {
            login();
            toast("로그인했어요");
            navigate({ href: safeNext(next ?? null), replace: true });
          }}
        >
          로그인
        </button>
        <Link to="/about">서비스 소개</Link>
      </div>
    </div>
  );
}
