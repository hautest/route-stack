import {
  createFileRoute,
  Link,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { getSession, login, safeNext } from "../api";
import { Header, useToast } from "../ui";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { next?: string } => ({
    next: typeof search.next === "string" ? search.next : undefined,
  }),
  beforeLoad: async ({ search }) => {
    if (await getSession()) throw redirect({ href: safeNext(search.next) });
  },
  component: Login,
});

function Login() {
  const { next } = Route.useSearch();
  const router = useRouter();
  const toast = useToast();
  return (
    <div className="page">
      <Header title="로그인" />
      <form
        className="content stack"
        onSubmit={async (e) => {
          e.preventDefault();
          await login();
          toast("로그인했어요");
          await router.navigate({ href: safeNext(next), replace: true });
        }}
      >
        <p>로그인하면 마이, 주문, 설정을 볼 수 있어요.</p>
        <button className="button" type="submit">
          로그인
        </button>
        <Link to="/about">서비스 소개</Link>
      </form>
    </div>
  );
}
