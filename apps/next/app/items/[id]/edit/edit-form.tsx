"use client";

import { useState } from "react";
import { useToast } from "../../../ui";
import { useItem } from "../item-context";
import { saveItem } from "./actions";

export function EditForm() {
  const item = useItem();
  const toast = useToast();
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body.join("\n\n"));

  return (
    <form
      action={saveItem.bind(null, item.id)}
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
    </form>
  );
}
