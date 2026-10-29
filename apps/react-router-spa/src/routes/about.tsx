import { Header } from "../ui";

export function Component() {
  return (
    <div className="page">
      <Header title="소개" />
      <div className="content">
        <p>
          작은 커뮤니티 앱입니다. 글을 읽고, 좋아요를 누르고, 댓글을 펼쳐 볼 수
          있어요.
        </p>
        <p>이 페이지는 데이터가 없는 정적 페이지입니다.</p>
      </div>
    </div>
  );
}
