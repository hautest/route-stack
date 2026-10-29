import { useEffect, useState } from "react";
import {
  createFileRoute,
  useBlocker,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { updateItem } from "../../../api";
import { useItem } from "../../../item-context";
import { useConfirm, useToast } from "../../../ui";

export const Route = createFileRoute("/items/$id/edit")({
  component: ItemEdit,
});

function ItemEdit() {
  const item = useItem();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const router = useRouter();
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body.join("\n\n"));
  const dirty = title !== item.title || body !== item.body.join("\n\n");

  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      dirty && current.pathname !== next.pathname,
    enableBeforeUnload: () => dirty,
    withResolver: true,
  });

  useEffect(() => {
    if (blocker.status !== "blocked") return;
    confirm("저장하지 않고 나갈까요?").then((ok) =>
      ok ? blocker.proceed() : blocker.reset(),
    );
  }, [blocker, confirm]);

  return (
    <form
      className="content stack"
      onSubmit={async (e) => {
        e.preventDefault();
        toast("저장했어요");
        await updateItem({ data: { id: item.id, title, body } });
        await router.invalidate();
        await navigate({
          to: "/items/$id",
          params: { id: String(item.id) },
          replace: true,
          ignoreBlocker: true,
        });
      }}
    >
      <label className="stack">
        제목
        <input
          className="field"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label className="stack">
        본문
        <textarea
          className="field"
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>
      <button className="button" type="submit">
        저장
      </button>
    </form>
  );
}
