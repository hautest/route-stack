"use client";

import { logout } from "../actions";
import { useToast } from "../ui";

export function LogoutButton() {
  const toast = useToast();
  return (
    <form action={logout} onSubmit={() => toast("로그아웃했어요")}>
      <button className="button secondary" type="submit">
        로그아웃
      </button>
    </form>
  );
}
