import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { isLoggedIn } from "../api";
import { Header } from "../ui";

export function Component() {
  const navigate = useNavigate();
  const loggedIn = isLoggedIn();
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(false);

  useEffect(() => {
    if (!loggedIn) navigate("/login?next=/settings", { replace: true });
  }, [loggedIn, navigate]);

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
