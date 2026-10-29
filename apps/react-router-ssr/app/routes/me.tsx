import { Form, Link, redirect } from "react-router";
import { isLoggedIn, logoutCookie } from "../data.server";
import { Header, useToast } from "../ui";
import type { Route } from "./+types/me";

export function loader({ request }: Route.LoaderArgs) {
  if (!isLoggedIn(request)) throw redirect("/login?next=/me");
  return null;
}

export function action() {
  return redirect("/", { headers: { "Set-Cookie": logoutCookie } });
}

export default function Me() {
  const toast = useToast();
  return (
    <div className="page">
      <Header title="마이" back={false} />
      <div className="content stack">
        <p>user0 님, 안녕하세요.</p>
        <Link to="/orders">주문 내역</Link>
        <Link to="/settings">설정</Link>
        <Form method="post" onSubmit={() => toast("로그아웃했어요")}>
          <button className="button secondary" type="submit">
            로그아웃
          </button>
        </Form>
      </div>
    </div>
  );
}
