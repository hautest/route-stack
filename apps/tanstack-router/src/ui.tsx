import {
  createContext,
  use,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Link, useRouter } from "@tanstack/react-router";

export function Header({
  title,
  back = true,
}: {
  title: string;
  back?: boolean;
}) {
  const router = useRouter();
  return (
    <header className="header">
      {back && (
        <button
          className="back"
          aria-label="뒤로 가기"
          onClick={() => router.history.back()}
        >
          ‹
        </button>
      )}
      <h1>{title}</h1>
    </header>
  );
}

const exact = { exact: true, includeSearch: false };

export function TabBar() {
  return (
    <nav className="tabbar">
      <Link to="/" replace activeOptions={exact}>
        홈
      </Link>
      <Link to="/search" replace activeOptions={exact}>
        탐색
      </Link>
      <Link to="/me" replace activeOptions={exact}>
        마이
      </Link>
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

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "오류가 났어요.";
}
