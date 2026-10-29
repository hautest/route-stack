import { useEffect, useState } from "react";
import { Form, replace, useBlocker } from "react-router";
import { updateItem } from "../data.server";
import { useConfirm, useToast } from "../ui";
import type { Route } from "./+types/item-edit";
import { useItem } from "./item-context";

export async function action({ params, request }: Route.ActionArgs) {
  const form = await request.formData();
  await updateItem(
    Number(params.id),
    String(form.get("title")),
    String(form.get("body")),
  );
  return replace(`/items/${params.id}`);
}

export const meta: Route.MetaFunction = ({ matches }) => [
  { title: `수정: ${matches[1].loaderData.title}` },
];

export default function ItemEdit() {
  const item = useItem();
  const toast = useToast();
  const confirm = useConfirm();
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body.join("\n\n"));
  const dirty = title !== item.title || body !== item.body.join("\n\n");

  // Submitting posts to this same URL, so only leaving for another path is blocked.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    confirm("저장하지 않고 나갈까요?").then((ok) =>
      ok ? blocker.proceed() : blocker.reset(),
    );
  }, [blocker, confirm]);

  return (
    <Form
      method="post"
      className="content stack"
      onSubmit={() => toast("저장했어요")}
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
    </Form>
  );
}
