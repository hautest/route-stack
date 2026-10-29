"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { SESSION_COOKIE } from "@/lib/session";
import { Header } from "../ui";

const subscribe = () => () => {};

export default function Settings() {
  const router = useRouter();
  // null while prerendering/hydrating: the cookie is only known in the browser.
  const loggedIn = useSyncExternalStore(
    subscribe,
    () => document.cookie.split("; ").includes(`${SESSION_COOKIE}=1`),
    () => null,
  );
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(false);

  useEffect(() => {
    if (loggedIn === false) router.replace("/login?next=/settings");
  }, [loggedIn, router]);

  return (
    <div className="page">
      <Header title="설정" />
      {loggedIn ? (
        <div className="content stack">
          <label className="row">
            <input
              type="checkbox"
              checked={push}
              onChange={(e) => setPush(e.target.checked)}
            />
            푸시 알림
          </label>
          <label className="row">
            <input
              type="checkbox"
              checked={email}
              onChange={(e) => setEmail(e.target.checked)}
            />
            이메일 알림
          </label>
        </div>
      ) : (
        <p className="loading">로그인 확인 중…</p>
      )}
    </div>
  );
}
