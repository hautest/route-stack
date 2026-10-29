"use client";

import { useSearchParams } from "next/navigation";
import { login } from "../actions";
import { useToast } from "../ui";

export function LoginForm() {
  const next = useSearchParams().get("next");
  const toast = useToast();
  return (
    <form
      action={login.bind(null, next)}
      className="content stack"
      onSubmit={() => toast("로그인했어요")}
    >
      <p>로그인하면 마이, 주문, 설정을 볼 수 있어요.</p>
      <button className="button" type="submit">
        로그인
      </button>
    </form>
  );
}
