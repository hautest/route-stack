import { Header } from "../ui";

export default function Loading() {
  return (
    <div className="page">
      <Header title="주문 내역" />
      <p className="loading">주문 내역을 불러오는 중…</p>
    </div>
  );
}
