export function Header({
  title,
  back = true,
}: {
  title: string;
  back?: boolean;
}) {
  return (
    <header className="header">
      {back && (
        <button
          className="back"
          aria-label="뒤로 가기"
          onClick={() => history.back()}
        >
          ‹
        </button>
      )}
      <h1>{title}</h1>
    </header>
  );
}
