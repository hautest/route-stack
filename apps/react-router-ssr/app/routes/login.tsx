import { Form, Link, redirect, replace } from "react-router";
import { isLoggedIn, loginCookie, safeNext } from "../data.server";
import { Header, useToast } from "../ui";
import type { Route } from "./+types/login";

export function loader({ request }: Route.LoaderArgs) {
  const next = safeNext(new URL(request.url).searchParams.get("next"));
  if (isLoggedIn(request)) throw redirect(next);
  return null;
}

export function action({ request }: Route.ActionArgs) {
  const next = safeNext(new URL(request.url).searchParams.get("next"));
  return replace(next, { headers: { "Set-Cookie": loginCookie } });
}

export default function Login() {
  const toast = useToast();
  return (
    <div className="page">
      <Header title="로그인" />
      <Form
        method="post"
        className="content stack"
        onSubmit={() => toast("로그인했어요")}
      >
        <p>로그인하면 마이, 주문, 설정을 볼 수 있어요.</p>
        <button className="button" type="submit">
          로그인
        </button>
        <Link to="/about">서비스 소개</Link>
      </Form>
    </div>
  );
}
