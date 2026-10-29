import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { getSession, logout } from "../api";
import { Header, useToast } from "../ui";

export const Route = createFileRoute("/me")({
  beforeLoad: async () => {
    if (!(await getSession()))
      throw redirect({ to: "/login", search: { next: "/me" } });
  },
  component: Me,
});

function Me() {
  const toast = useToast();
  const navigate = useNavigate();
  return (
    <div className="page">
      <Header title="마이" back={false} />
      <div className="content stack">
        <p>user0 님, 안녕하세요.</p>
        <Link to="/orders">주문 내역</Link>
        <Link to="/settings">설정</Link>
        <button
          className="button secondary"
          onClick={async () => {
            await logout();
            toast("로그아웃했어요");
            await navigate({ to: "/", replace: true });
          }}
        >
          로그아웃
        </button>
      </div>
    </div>
  );
}
