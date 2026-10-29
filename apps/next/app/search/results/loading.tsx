import { Header } from "../../ui";

export default function Loading() {
  return (
    <div className="page">
      <Header title="검색 결과" />
      <p className="loading">검색 중…</p>
    </div>
  );
}
