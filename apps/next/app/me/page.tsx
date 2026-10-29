import Link from "next/link";
import { Header } from "../ui";
import { LogoutButton } from "./logout-button";

// Access is checked in proxy.ts before this page renders.
export default function Me() {
  return (
    <div className="page">
      <Header title="마이" back={false} />
      <div className="content stack">
        <p>user0 님, 안녕하세요.</p>
        <Link href="/orders">주문 내역</Link>
        <Link href="/settings">설정</Link>
        <LogoutButton />
      </div>
    </div>
  );
}
