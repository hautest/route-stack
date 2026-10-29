// Fake API: server functions over in-memory data. Deterministic so every run sees the same content.
import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  deleteCookie,
  getCookie,
  setCookie,
} from "@tanstack/react-start/server";

export const CATEGORIES = [
  { id: "daily", label: "일상" },
  { id: "dev", label: "개발" },
  { id: "qna", label: "질문" },
  { id: "photo", label: "사진" },
];

const TOPICS = ["리액트", "라우터", "스택", "애니메이션", "캐시", "스크롤"];
const ITEM_COUNT = 2000;
const DELETED_ID = 999;
const VIDEO_ID = 3;
const SESSION_COOKIE = "tss_session";

export type Item = {
  id: number;
  title: string;
  body: string[];
  category: string;
  author: string;
  likes: number;
  image: string;
  video?: string;
};

export type ItemDetail = Item & {
  comments: string[];
  related: Item[];
  views: number;
};

export type Product = {
  id: number;
  name: string;
  price: number;
  description: string;
};

export type Order = { id: string; name: string; price: number };

const edits = new Map<number, { title: string; body: string[] }>();
const views = new Map<number, number>();

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function image(id: number) {
  const hue = (id * 37) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="180"><rect width="100%" height="100%" fill="hsl(${hue} 70% 80%)"/><text x="50%" y="55%" font-size="40" text-anchor="middle" fill="hsl(${hue} 60% 30%)">#${id}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function exists(id: number) {
  return (
    Number.isInteger(id) && id >= 1 && id <= ITEM_COUNT && id !== DELETED_ID
  );
}

function makeItem(id: number): Item {
  const topic = TOPICS[id % TOPICS.length];
  const edit = edits.get(id);
  return {
    id,
    title: edit?.title ?? `${topic} 이야기 ${id}`,
    body: edit?.body ?? [
      `${topic}에 관한 ${id}번째 글입니다.`,
      "화면을 오래 내려야 댓글이 보이도록 본문을 길게 씁니다. ".repeat(12),
      "앱처럼 화면이 쌓이고 뒤로 가면 이전 화면이 그대로 남아 있으면 좋겠습니다. ".repeat(
        12,
      ),
      "마지막 문단입니다. ".repeat(10),
    ],
    category: CATEGORIES[id % CATEGORIES.length].id,
    author: `user${id % 17}`,
    likes: (id * 7) % 100,
    image: image(id),
    video: id === VIDEO_ID ? "/clip.mp4" : undefined,
  };
}

function nextIds(id: number, count: number) {
  const ids: number[] = [];
  for (let next = id + 1; ids.length < count; next++) {
    const wrapped = ((next - 1) % ITEM_COUNT) + 1;
    if (exists(wrapped)) ids.push(wrapped);
  }
  return ids;
}

function loggedIn() {
  return getCookie(SESSION_COOKIE) === "1";
}

export const getFeed = createServerFn()
  .validator(
    (input: { category?: string; offset?: number; limit: number }) => input,
  )
  .handler(async ({ data: { category, offset = 0, limit } }) => {
    const items: Item[] = [];
    let skipped = 0;
    for (let id = 1; id <= ITEM_COUNT && items.length < limit; id++) {
      if (!exists(id)) continue;
      const item = makeItem(id);
      if (category && item.category !== category) continue;
      if (skipped++ < offset) continue;
      items.push(item);
    }
    return items;
  });

// New posts arrive every 30 seconds after the given time.
export const getNewPostCount = createServerFn()
  .validator((since: number) => since)
  .handler(async ({ data: since }) =>
    Math.floor((Date.now() - since) / 30_000),
  );

export const getItem = createServerFn()
  .validator((input: { id: number; delay?: number; fail?: boolean }) => input)
  .handler(async ({ data: { id, delay = 300, fail = false } }) => {
    await wait(delay);
    if (fail) throw new Error("글을 불러오지 못했어요.");
    if (!exists(id)) throw notFound();
    const item = makeItem(id);
    return {
      ...item,
      comments: Array.from(
        { length: (id % 5) + 4 },
        (_, i) => `댓글 ${i + 1}: ${item.title} 잘 읽었어요.`,
      ),
      related: nextIds(id, 3).map(makeItem),
      views: views.get(id) ?? 0,
    } satisfies ItemDetail;
  });

export const logView = createServerFn({ method: "POST" })
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    const count = (views.get(id) ?? 0) + 1;
    views.set(id, count);
    return count;
  });

export const updateItem = createServerFn({ method: "POST" })
  .validator((input: { id: number; title: string; body: string }) => input)
  .handler(async ({ data: { id, title, body } }) => {
    await wait(300);
    edits.set(id, { title, body: body.split(/\n+/).filter(Boolean) });
  });

export const search = createServerFn()
  .validator((input: { q: string; sort: string }) => input)
  .handler(async ({ data: { q, sort } }) => {
    const results: Item[] = [];
    for (let id = 1; id <= ITEM_COUNT && results.length < 200; id++) {
      if (!exists(id)) continue;
      const item = makeItem(id);
      if (item.title.includes(q)) results.push(item);
    }
    if (sort === "popular")
      results.sort((a, b) => b.likes - a.likes || a.id - b.id);
    else results.sort((a, b) => b.id - a.id);
    return results.slice(0, 40);
  });

export const getProduct = createServerFn()
  .validator((id: number) => id)
  .handler(async ({ data: id }) => {
    await wait(300);
    if (!Number.isInteger(id) || id < 1 || id > 50) return null;
    return {
      id,
      name: `상품 ${id}`,
      price: 1000 * ((id % 9) + 1),
      description: `${id}번 상품 설명입니다. `.repeat(8),
    } satisfies Product;
  });

export const getOrders = createServerFn()
  .validator((delay: number) => delay)
  .handler(async ({ data: delay }) => {
    await wait(delay);
    if (!loggedIn()) return { status: "unauthorized" as const };
    const orders: Order[] = Array.from({ length: 5 }, (_, i) => ({
      id: `A-${1000 + i}`,
      name: `상품 ${i + 1}`,
      price: 1000 * (i + 1),
    }));
    return { status: "ok" as const, orders };
  });

export const slow = createServerFn().handler(async () => {
  await wait(3000);
  return { message: "3초 걸려 도착한 응답입니다." };
});

export const getSession = createServerFn().handler(async () => loggedIn());

export const login = createServerFn({ method: "POST" }).handler(async () => {
  setCookie(SESSION_COOKIE, "1", { path: "/", maxAge: 86400 });
});

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  deleteCookie(SESSION_COOKIE, { path: "/" });
});

// Only same-origin paths are accepted as a post-login destination.
export function safeNext(next: string | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
