import {
  createContext,
  use,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { NavLink, useNavigate } from "react-router";

export function Header({
  title,
  back = true,
}: {
  title: string;
  back?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <header className="header">
      {back && (
        <button
          className="back"
          aria-label="뒤로 가기"
          onClick={() => navigate(-1)}
        >
          ‹
        </button>
      )}
      <h1>{title}</h1>
    </header>
  );
}

export function TabBar() {
  return (
    <nav className="tabbar">
      <NavLink to="/" end replace>
        홈
      </NavLink>
      <NavLink to="/search" end replace>
        탐색
      </NavLink>
      <NavLink to="/me" end replace>
        마이
      </NavLink>
    </nav>
  );
}

const ToastContext = createContext<(message: string) => void>(() => {});

export function useToast() {
  return use(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 2000);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <ToastContext value={setMessage}>
      {children}
      {message && (
        <div className="toast" role="status">
          {message}
        </div>
      )}
    </ToastContext>
  );
}

type Pending = { message: string; resolve: (ok: boolean) => void };

const ConfirmContext = createContext<(message: string) => Promise<boolean>>(
  async () => false,
);

export function useConfirm() {
  return use(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback(
    (message: string) =>
      new Promise<boolean>((resolve) => setPending({ message, resolve })),
    [],
  );

  const close = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  return (
    <ConfirmContext value={confirm}>
      {children}
      {pending &&
        createPortal(
          <div className="modal-backdrop">
            <div
              className="modal"
              role="alertdialog"
              aria-modal="true"
              aria-label="확인"
            >
              <p>{pending.message}</p>
              <div className="row">
                <button
                  className="button secondary"
                  onClick={() => close(false)}
                >
                  취소
                </button>
                <button className="button" onClick={() => close(true)}>
                  나가기
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </ConfirmContext>
  );
}
