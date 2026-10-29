import { useEffect, useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router";
import { Header } from "../ui";

const subscribe = () => () => {};

export default function Settings() {
  const navigate = useNavigate();
  // null during SSR and hydration: the guard only decides in the browser.
  const loggedIn = useSyncExternalStore(
    subscribe,
    () => document.cookie.split("; ").includes("rrssr_session=1"),
    () => null,
  );
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(false);

  useEffect(() => {
    if (loggedIn === false)
      navigate("/login?next=/settings", { replace: true });
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
