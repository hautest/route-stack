# react-router-ssr

React Router framework mode(SSR) 테스트 앱. 포트 3102. route-stack 없이 만든 기준선이다.

## 생성

```sh
npx create-react-router@8.4.0 react-router-ssr --yes --no-install --no-git-init --no-agent-skills --package-manager pnpm
```

생성된 옵션 (기본 템플릿 `remix-run/react-router-templates/default`):

- `react-router.config.ts`: `ssr: true`
- `app/root.tsx`의 `Layout`에 `<ScrollRestoration />`, `<Scripts />`, Google Fonts(Inter) `links`
- Tailwind CSS 4 (`@tailwindcss/vite`), `Dockerfile`·`.dockerignore` (그대로 둠)

생성 뒤 바꾼 것:

- `react`·`react-dom`을 `19.3.0`으로 고정 (템플릿은 `^19.2.8`)
- 스크립트 포트: `dev`는 `--port 3102`, `start`는 `PORT=3102 react-router-serve ./build/server/index.js`
- 템플릿 welcome 페이지 삭제, `app/app.css`에 Tailwind import 뒤로 앱 CSS 추가, `<html lang="ko">`

## 버전

| 패키지                                     | 버전   |
| ------------------------------------------ | ------ |
| react-router, @react-router/dev·node·serve | 8.4.0  |
| react, react-dom                           | 19.3.0 |
| vite                                       | 8.3.4  |
| typescript                                 | 5.9.3  |
| tailwindcss                                | 4.3.3  |

## `<Stack>` 위치

`app/root.tsx`의 `App()`에서 `<Outlet />`을 감싼다. 탭바·토스트·확인 모달(portal)은 `<Outlet />` 밖, 헤더(뒤로 가기)는 각 페이지 안에 있다.

## 경로 → React Router 기능

| 경로                            | 구현                                                                                                                                                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                             | loader(서버 메모리) 피드 300개(`?rows=`), 카테고리 `Link` push, 더 보기는 resource route `/api/feed` fetch, 새 글 polling은 `useFetcher`로 `/api/new-posts`(30초)                                                |
| `/about`                        | 정적                                                                                                                                                                                                             |
| `/search`                       | `useSearchParams` replace로 `?q=`, GET `<Form action="/search/results">`(push)                                                                                                                                   |
| `/search/results`               | loader, 마운트 때 `sort` 없으면 `setSearchParams(..., { replace: true })`                                                                                                                                        |
| `/items/:id`                    | 레이아웃 route loader(300ms, `?delay=`, `?fail=1`) + index(상세)·`edit`, context로 공유. `meta`로 문서 title. 조회수는 resource route `/api/views/:id`에 POST(fetcher POST는 loader 재검증을 일으켜 plain fetch) |
| `/items/:id/edit`               | `action` → `replace()`로 상세, `useBlocker` + 루트 확인 모달                                                                                                                                                     |
| `/products?id=`                 | loader 300ms                                                                                                                                                                                                     |
| `/me`                           | loader `redirect` (렌더 전)                                                                                                                                                                                      |
| `/orders?delay=`                | loader가 Promise를 담은 객체 반환 → `<Suspense><Await>`, 미로그인이면 `<Navigate replace>` (로딩 뒤)                                                                                                             |
| `/settings`                     | 클라이언트 가드: `document.cookie`를 읽어 effect에서 `navigate(..., { replace: true })`                                                                                                                          |
| `/login`                        | 로그인 상태면 loader `redirect(next)`, 버튼은 `action`이 `Set-Cookie` + `replace(next)`                                                                                                                          |
| `/lab`                          | sticky·fixed·캐러셀·내부 스크롤·화면 portal 모달                                                                                                                                                                 |
| `/slow`                         | `await` loader 3초 (이전 화면에 머묾)                                                                                                                                                                            |
| `/error`                        | 렌더 오류 → 라우트 `ErrorBoundary`                                                                                                                                                                               |
| `/crash`                        | 경계 없음 → 루트 `ErrorBoundary` (탭바 포함 앱 전체 교체)                                                                                                                                                        |
| `/items/999`, `/items/1?fail=1` | loader가 `data(message, { status })`를 throw → 아이템 `ErrorBoundary`                                                                                                                                            |
| 그 외                           | `*` 라우트(404 상태)                                                                                                                                                                                             |

쿠키: `rrssr_session` (HttpOnly 아님: `/settings` 클라이언트 가드가 읽음).

## 실행

```sh
pnpm --filter react-router-ssr build && pnpm --filter react-router-ssr start   # http://localhost:3102
pnpm --filter react-router-ssr dev
```

## 관찰

- production에서는 서버에서 던진 `Error`의 메시지가 가려진다. 그래서 loader 오류는 `data()` 응답으로 던지고, `/error` 경계는 고정 문구를 쓴다.
- 편집 저장과 로그인은 `replace()`(X-Remix-Replace)로 돌아가며, smoke에서 `history.length`가 늘지 않음을 확인했다.
- 템플릿 루트 `ErrorBoundary`는 `Layout` 안에서 `App` 대신 그려지므로 `/crash`는 탭바까지 사라진다.
