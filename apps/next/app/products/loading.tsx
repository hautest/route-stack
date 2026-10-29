import { Header } from "../ui";

export default function Loading() {
  return (
    <div className="page">
      <Header title="상품" />
      <p className="loading">불러오는 중…</p>
    </div>
  );
}
