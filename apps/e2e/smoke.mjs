// Baseline smoke test for the test apps (production servers must already be
// running).
// Usage: node smoke.mjs [app ...]   e.g. node smoke.mjs react-router-spa next
import { chromium } from "playwright";

const APPS = {
  next: { port: 3100, blocker: false },
  "react-router-spa": { port: 3101, blocker: true },
  "react-router-ssr": { port: 3102, blocker: true },
  "tanstack-router": { port: 3103, blocker: true },
  "tanstack-start": { port: 3104, blocker: true },
  plain: { port: 3105, plain: true },
};

const ROUTES = [
  "/",
  "/?category=dev",
  "/?rows=1000",
  "/about",
  "/search",
  "/search?q=리액트",
  "/search/results?q=리액트",
  "/items/1",
  "/items/1?tab=info",
  "/items/1#comments",
  "/items/1/edit",
  "/products?id=1",
  "/login",
  "/lab",
  "/slow",
];
const PLAIN_ROUTES = [
  "/",
  "/?category=dev",
  "/?rows=1000",
  "/about",
  "/search",
  "/search/results?q=리액트",
  "/items/1",
  "/items/1?tab=info",
  "/items/1#comments",
  "/products?id=1",
  "/lab",
];
const ERROR_ROUTES = [
  ["/error", "/error 렌더 중 오류"],
  ["/crash", "앱 오류"],
  ["/items/999", "찾을 수 없어요"],
  ["/items/1?fail=1", "불러오지 못했어요"],
  ["/no-such-page", "찾을 수 없어요"],
];

const names = process.argv.slice(2).length
  ? process.argv.slice(2)
  : Object.keys(APPS);
let failed = 0;

const browser = await chromium.launch();
for (const name of names) {
  const app = APPS[name];
  const base = `http://localhost:${app.port}`;
  const results = [];
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const errors = [];
  let page;

  // Kept screens of a route-stack stay in the DOM, hidden: page locators only
  // match visible elements.
  // Each check gets a fresh tab so history.length starts at 1 (Chromium caps it
  // at 50).
  const check = async (label, fn) => {
    page = await context.newPage();
    page.on(
      "console",
      (message) => message.type() === "error" && errors.push(message.text()),
    );
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      const note = await fn();
      results.push(["ok", label, note]);
    } catch (error) {
      failed++;
      results.push(["FAIL", label, error.message.split("\n")[0]]);
    } finally {
      await page.close();
    }
  };

  const goto = async (path) => {
    await page.goto(base + path, { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
  };
  const path = () =>
    decodeURIComponent(
      new URL(page.url()).pathname + new URL(page.url()).search,
    );
  const historyLength = () => page.evaluate(() => history.length);
  const expect = (cond, message) => {
    if (!cond) throw new Error(message);
  };

  // Then until the route-stack screens are quiet for 500ms (longer than the
  // apps' 300ms loaders): a slide may start after the URL changes, and while it
  // runs both screens are visible.
  const waitPath = async (pred) => {
    await page.waitForURL((url) =>
      pred(decodeURIComponent(url.pathname + url.search)),
    );
    await page.evaluate(() => (window.__quiet = null));
    await page.waitForFunction(
      () => {
        const hosts = [...document.querySelectorAll("[data-stack-screen]")];
        const lifted = hosts.some((host) => host.style.position === "fixed");
        const state = hosts
          .map((host) => host.dataset.stackScreen + host.style.display)
          .join();
        const quiet = window.__quiet;
        if (lifted || !quiet || quiet.state !== state)
          window.__quiet = { state, since: performance.now() };
        return (
          !lifted &&
          quiet?.state === state &&
          performance.now() - quiet.since > 500
        );
      },
      null,
      { polling: 50 },
    );
  };

  const back = async () => {
    await page.goBack({ waitUntil: "commit" });
  };

  for (const route of app.plain ? PLAIN_ROUTES : ROUTES) {
    await check(`load ${route}`, async () => {
      errors.length = 0;
      await goto(route);
      await page
        .locator(".header h1")
        .filter({ visible: true })
        .first()
        .waitFor();
      expect(errors.length === 0, `console errors: ${errors.join(" | ")}`);
    });
  }

  if (!app.plain) {
    for (const [route, text] of ERROR_ROUTES) {
      await check(`error ${route}`, async () => {
        await goto(route);
        await page
          .getByText(text)
          .filter({ visible: true })
          .first()
          .waitFor({ timeout: 5000 });
      });
    }
  }

  await check("feed push → back", async () => {
    await goto("/");
    const like = page.locator(".card .like").filter({ visible: true }).first();
    await like.click();
    expect(
      (await like.getAttribute("aria-pressed")) === "true",
      "like did not toggle",
    );

    await page
      .getByRole("button", { name: "더 보기" })
      .filter({ visible: true })
      .click();
    await page.waitForFunction(
      () => document.querySelectorAll(".card").length > 300,
    );
    await page.evaluate(() => window.scrollTo(0, 3000));

    const before = await historyLength();
    await page.locator(".card h2 a").filter({ visible: true }).nth(4).click();
    await waitPath((current) => current === "/items/5");
    expect((await historyLength()) === before + 1, "item link did not push");
    await page.locator("#comments").filter({ visible: true }).waitFor();

    await back();
    await waitPath((current) => current === "/");
    await page.locator(".card").filter({ visible: true }).first().waitFor();

    const kept = await page.evaluate(() => ({
      liked:
        document.querySelector(".card .like")?.getAttribute("aria-pressed") ===
        "true",
      cards: document.querySelectorAll(".card").length,
      scrollY: Math.round(scrollY),
    }));
    return `back ok; liked=${kept.liked} cards=${kept.cards} scrollY=${kept.scrollY}`;
  });

  await check("category chip push → back", async () => {
    await goto("/");
    const before = await historyLength();
    await page
      .locator(".chips a", { hasText: "개발" })
      .filter({ visible: true })
      .click();
    await waitPath((current) => current === "/?category=dev");
    expect((await historyLength()) === before + 1, "category did not push");
    await back();
    await waitPath((current) => current === "/");
  });

  await check("/search typing replaces ?q=", async () => {
    await goto("/search");
    const before = await historyLength();
    const input = page.locator('input[name="q"]').filter({ visible: true });
    expect(
      await input.evaluate((el) => el === document.activeElement),
      "search input not focused",
    );
    await input.pressSequentially("스택", { delay: 50 });
    await waitPath((current) => current === "/search?q=스택");
    expect((await historyLength()) === before, "typing pushed history entries");
    expect(
      await input.evaluate((el) => el === document.activeElement),
      "focus lost while typing",
    );
    await input.press("Enter");
    await waitPath((current) => current.startsWith("/search/results?q=스택"));
    expect((await historyLength()) === before + 1, "submit did not push");
  });

  await check("/search/results sort normalize + push", async () => {
    await goto("/search/results?q=리액트");
    await waitPath(
      (current) => current === "/search/results?q=리액트&sort=new",
    );
    const before = await historyLength();
    expect(
      before === 2,
      `sort normalization pushed (history.length=${before})`,
    );
    await page
      .getByRole("button", { name: "미리보기" })
      .filter({ visible: true })
      .first()
      .click();
    const input = page
      .locator('.content input[name="q"]')
      .filter({ visible: true });
    await input.fill("라우터");
    await input.press("Enter");
    await waitPath(
      (current) => current === "/search/results?q=라우터&sort=new",
    );
    expect((await historyLength()) === before + 1, "new query did not push");
    await back();
    await waitPath(
      (current) => current === "/search/results?q=리액트&sort=new",
    );
    await page
      .locator(".header h1", { hasText: "리액트" })
      .filter({ visible: true })
      .waitFor();
  });

  await check("/products?id= push → back", async () => {
    await goto("/products?id=1");
    await page
      .getByRole("button", { name: "+" })
      .filter({ visible: true })
      .click();
    const before = await historyLength();
    await page
      .getByRole("link", { name: "상품 2" })
      .filter({ visible: true })
      .click();
    await waitPath((current) => current === "/products?id=2");
    expect((await historyLength()) === before + 1, "product link did not push");
    await page
      .locator(".header h1", { hasText: "상품 2" })
      .filter({ visible: true })
      .waitFor();
    await back();
    await waitPath((current) => current === "/products?id=1");
    await page.getByText("상품 1").filter({ visible: true }).first().waitFor();
  });

  await check("/items hash links + tab push", async () => {
    await goto("/items/1");
    const before = await historyLength();
    await page
      .getByRole("link", { name: "댓글 보기 ↓" })
      .filter({ visible: true })
      .click();
    await waitPath((current) => current === "/items/1");
    expect(new URL(page.url()).hash === "#comments", "hash not set");
    expect(
      (await page.evaluate(() => scrollY)) > 0,
      "did not scroll to comments",
    );
    await page
      .getByRole("link", { name: "정보" })
      .filter({ visible: true })
      .click();
    await waitPath((current) => current === "/items/1?tab=info");
    expect((await historyLength()) === before + 2, "hash/tab did not push");
  });

  if (!app.plain) {
    await check("logged out: /me redirects before render", async () => {
      await context.clearCookies();
      await goto("/");
      await page.evaluate(() =>
        document.querySelector('.tabbar a[href="/me"]').click(),
      );
      await waitPath((current) => current === "/login?next=/me");
    });

    await check("logged out: /orders redirects after loading", async () => {
      await goto("/orders");
      await waitPath((current) => current.startsWith("/login?next=/orders"));
    });

    await check("logged out: /settings client guard", async () => {
      await goto("/settings");
      await waitPath((current) => current === "/login?next=/settings");
    });

    await check("login → next (replace)", async () => {
      await goto("/");
      await goto("/login?next=/settings");
      const before = await historyLength();
      await page
        .getByRole("button", { name: "로그인" })
        .filter({ visible: true })
        .click();
      await waitPath((current) => current === "/settings");
      await page.getByText("푸시 알림").filter({ visible: true }).waitFor();
      expect((await historyLength()) === before, "login did not replace");
    });

    await check("logged in: /me /orders /settings", async () => {
      await goto("/me");
      await page
        .getByRole("button", { name: "로그아웃" })
        .filter({ visible: true })
        .waitFor();
      await goto("/orders");
      await page
        .getByText("A-1000")
        .filter({ visible: true })
        .waitFor({ timeout: 5000 });
      await goto("/settings");
      await page.getByText("푸시 알림").filter({ visible: true }).waitFor();
      await goto("/login?next=/orders");
      await waitPath((current) => current === "/orders");
    });

    await check("edit save replaces to detail", async () => {
      await goto("/items/2");
      await page
        .getByRole("link", { name: "수정" })
        .filter({ visible: true })
        .click();
      await waitPath((current) => current === "/items/2/edit");
      const before = await historyLength();
      await page
        .locator('input[name="title"]')
        .filter({ visible: true })
        .fill("수정한 제목 2");
      await page
        .getByRole("button", { name: "저장" })
        .filter({ visible: true })
        .click();
      await waitPath((current) => current === "/items/2");
      await page
        .locator(".header h1", { hasText: "수정한 제목 2" })
        .filter({ visible: true })
        .waitFor();
      expect((await historyLength()) === before, "save did not replace");
    });

    if (app.blocker) {
      await check("edit blocker modal", async () => {
        await goto("/items/3");
        await page
          .getByRole("link", { name: "수정" })
          .filter({ visible: true })
          .click();
        await waitPath((current) => current === "/items/3/edit");
        await page
          .locator('input[name="title"]')
          .filter({ visible: true })
          .fill("저장 안 할 제목");
        await page
          .getByRole("button", { name: "뒤로 가기" })
          .filter({ visible: true })
          .click();
        const dialog = page.getByRole("alertdialog").filter({ visible: true });
        await dialog.waitFor();
        await dialog.getByRole("button", { name: "취소" }).click();
        await dialog.waitFor({ state: "hidden" });
        await page.waitForTimeout(300);
        expect(path() === "/items/3/edit", `cancel left the page: ${path()}`);
        expect(
          (await page
            .locator('input[name="title"]')
            .filter({ visible: true })
            .inputValue()) === "저장 안 할 제목",
          "input lost after cancel",
        );
        await page
          .getByRole("button", { name: "뒤로 가기" })
          .filter({ visible: true })
          .click();
        await dialog.waitFor();
        await dialog.getByRole("button", { name: "나가기" }).click();
        await waitPath((current) => current === "/items/3");
      });
    }

    await check("logout", async () => {
      await goto("/me");
      await page
        .getByRole("button", { name: "로그아웃" })
        .filter({ visible: true })
        .click();
      await waitPath((current) => current === "/");
      await goto("/me");
      await waitPath((current) => current === "/login?next=/me");
    });
  }

  await context.close();
  console.log(`\n== ${name} (${base})`);
  for (const [status, label, note] of results) {
    console.log(`${status.padEnd(4)} ${label}${note ? `  — ${note}` : ""}`);
  }
}
await browser.close();
process.exitCode = failed ? 1 : 0;
