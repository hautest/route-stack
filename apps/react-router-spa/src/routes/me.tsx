import { Form, Link, redirect } from "react-router";
import { isLoggedIn, logout } from "../api";
import { Header, useToast } from "../ui";

export function loader() {
  if (!isLoggedIn()) throw redirect("/login?next=/me");
  return null;
}

export function action() {
  logout();
  return redirect("/");
}

export function Component() {
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
