"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  Suspense,
  use,
  useEffect,
  useState,
  type ReactNode,
} from "react";

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
          onClick={() => router.back()}
        >
          ‹
        </button>
      )}
      <h1>{title}</h1>
    </header>
  );
}

const TABS = [
  { href: "/", label: "홈" },
  { href: "/search", label: "탐색" },
  { href: "/me", label: "마이" },
];

// The pathname is runtime data on dynamic routes; the prerendered shell shows the bar without a current tab.
export function TabBar() {
  return (
    <Suspense fallback={<TabLinks />}>
      <CurrentTabLinks />
    </Suspense>
  );
}

function CurrentTabLinks() {
  return <TabLinks pathname={usePathname()} />;
}

function TabLinks({ pathname }: { pathname?: string }) {
  return (
    <nav className="tabbar">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          replace
          aria-current={pathname === tab.href ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
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
