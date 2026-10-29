import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getSession } from "../api";
import { Header } from "../ui";

export const Route = createFileRoute("/settings")({ component: Settings });

function Settings() {
  const navigate = useNavigate();
  const [loggedIn, setLoggedIn] = useState(false);
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(false);

  useEffect(() => {
    let active = true;
    getSession().then((ok) => {
      if (!active) return;
      if (ok) setLoggedIn(true);
      else
        navigate({
          to: "/login",
          search: { next: "/settings" },
          replace: true,
        });
    });
    return () => {
      active = false;
    };
  }, [navigate]);

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
