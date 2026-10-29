import { Header } from "../Header";

export function Me() {
  return (
    <div className="page">
      <Header title="마이" back={false} />
      <div className="content">
        <p>이 앱에는 로그인이 없어요.</p>
      </div>
    </div>
  );
}
