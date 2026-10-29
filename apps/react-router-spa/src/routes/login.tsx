import {
  Form,
  Link,
  redirect,
  replace,
  type LoaderFunctionArgs,
} from "react-router";
import { isLoggedIn, login, safeNext } from "../api";
import { Header, useToast } from "../ui";

export function loader({ request }: LoaderFunctionArgs) {
  const next = safeNext(new URL(request.url).searchParams.get("next"));
  if (isLoggedIn()) throw redirect(next);
  return null;
}

export function action({ request }: LoaderFunctionArgs) {
  login();
  return replace(safeNext(new URL(request.url).searchParams.get("next")));
}

export function Component() {
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
