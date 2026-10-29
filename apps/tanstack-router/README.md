# tanstack-router

TanStack Router(file-based routing, Vite SPA)로 만든 테스트 앱. route-stack 없이 만든 기준선이다. 포트 3103.

## 생성

```sh
npx @tanstack/cli@0.71.1 create tanstack-router --router-only --no-examples --no-toolchain --no-git --no-install --no-intent --package-manager pnpm -y
```

- `create-tsrouter-app@0.54.44`는 실행하면 deprecated 경고와 함께 위 명령(`tanstack create --router-only`)을 쓰라고 안내한다.
- 생성 옵션(`.cta.json`): `mode: file-router`, `typescript: true`, `tailwind: true`, `projectPreset: default`, `routerOnly: true`, `includeExamples: false`, `chosenAddOns: []`.

## 버전 (lockfile 기준)

| 패키지                                                           | 버전                               |
| ---------------------------------------------------------------- | ---------------------------------- |
| @tanstack/react-router                                           | 1.170.44                           |
| @tanstack/router-plugin                                          | 1.168.45                           |
| @tanstack/router-cli                                             | 1.167.41                           |
| @tanstack/react-devtools / react-router-devtools / devtools-vite | 0.10.13 / 1.167.2 / 0.8.5          |
| react / react-dom                                                | 19.3.0 (템플릿 `^19.2.0`에서 고정) |
| vite / @vitejs/plugin-react                                      | 8.3.4 / 6.1.2                      |
| tailwindcss / @tailwindcss/vite                                  | 4.3.3                              |
| typescript                                                       | 6.0.3                              |

## 템플릿 기본값 (스펙 확인 항목)

`src/main.tsx`의 `createRouter`를 그대로 둔다.

- `scrollRestoration: true` (라우터 기본은 꺼짐, 템플릿이 켬). 실행 중 `history.scrollRestoration`은 `manual`.
- `defaultPreload: 'intent'` (링크 hover/touch 시 loader 미리 실행).
- `defaultViewTransition`: 설정 없음(꺼짐). 고칠 것 없음.
- `defaultPendingMs`/`defaultPendingMinMs`: 설정 없음 → 라우터 기본 1000 / 500.
- 템플릿에는 쓰이지 않는 `src/router.tsx`(`getRouter()`, `defaultPreloadStaleTime: 0`)도 생성된다. 엔트리는 `main.tsx`이고 `router.tsx`는 아무 데서도 import하지 않으며, 둘 다 `Register`를 선언해 충돌하므로 `router.tsx`를 지웠다. 따라서 `defaultPreloadStaleTime: 0`은 적용되지 않는다(라우터 기본값).
- 템플릿의 TanStack Devtools는 `__root.tsx`에 그대로 둔다. production 빌드에서는 `@tanstack/devtools-vite`가 제거해 화면에 없다.

## 생성 뒤 바꾼 것

- 데모 `src/routes/index.tsx` 내용과 `src/router.tsx` 삭제, 앱 라우트 추가.
- `src/styles.css`: 템플릿의 `@import "tailwindcss"` 뒤에 앱 CSS(plain CSS) 추가.
- `index.html`: `lang="ko"`, `<title>` 제거(문서 제목은 루트 route `head()`와 `<HeadContent />`가 관리).
- `package.json`: react 고정, 포트 3103(`dev`/`start`), `start`(= `vite preview --port 3103 --strictPort`), `typecheck`(`tsr generate && tsc --noEmit`) 추가, 템플릿의 `pnpm.onlyBuiltDependencies`는 루트 `pnpm-workspace.yaml`의 `allowBuilds`로 옮김. 템플릿의 `pnpm-workspace.yaml` 삭제(워크스페이스 하위 패키지라서).
- `src/routeTree.gen.ts`는 커밋한다(lint/format 대상에서 제외).

## `<Stack>` 위치

`src/routes/__root.tsx`의 `<Outlet />`. 토스트·확인 모달(portal)·하단 탭바·Devtools는 그 바깥 형제다. 뒤로 가기 버튼이 있는 헤더는 각 화면 안에 있다.

## 라우트와 구현

| 경로                              | 파일                         | 구현                                                                                                                                                                                           |
| --------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`, `/?category=`, `/?rows=1000` | `routes/index.tsx`           | `validateSearch` + `loaderDeps` + loader(메모리). 피드 300개, 영상 1개(`/clip.mp4`), 더 보기, 좋아요, 카테고리 칩(push), 새 글 30초 polling                                                    |
| `/about`                          | `routes/about.tsx`           | 정적                                                                                                                                                                                           |
| `/search`                         | `routes/search/index.tsx`    | `autoFocus`, 입력 중 `navigate({ search, replace: true })`, 제출은 `/search/results`로 push                                                                                                    |
| `/search/results?q=`              | `routes/search/results.tsx`  | loader, `sort` 없으면 마운트 때 `&sort=new`로 replace, 다른 검색어 push, 미리보기 펼침                                                                                                         |
| `/items/$id`                      | `routes/items/$id/route.tsx` | 상세·수정이 공유하는 레이아웃 route. loader 300ms(`?delay=`, `?fail=1`), `head()`로 문서 제목, React context로 자식에 전달, `notFound()` → `notFoundComponent`, loader 오류 → `errorComponent` |
| `/items/$id` (index)              | `routes/items/$id/index.tsx` | `?tab=info` push, `<a href="#comments">`와 `<Link hash="comments">`, 관련 글, 댓글 펼치기, 마운트 때 조회수 기록                                                                               |
| `/items/$id/edit`                 | `routes/items/$id/edit.tsx`  | `useBlocker({ shouldBlockFn, withResolver: true })` + 루트 확인 모달, 저장 → `navigate({ replace: true, ignoreBlocker: true })`                                                                |
| `/products?id=`                   | `routes/products.tsx`        | 쿼리로 나뉘는 상세 300ms, 다른 상품 push                                                                                                                                                       |
| `/me`                             | `routes/me.tsx`              | `beforeLoad`에서 `redirect` (렌더 전), 로그아웃                                                                                                                                                |
| `/orders?delay=`                  | `routes/orders.tsx`          | loader가 지연(기본 1200ms) 뒤 로그아웃 상태면 `throw redirect`, `pendingComponent`                                                                                                             |
| `/settings`                       | `routes/settings.tsx`        | 클라이언트 가드(`useEffect` + `navigate({ replace: true })`)                                                                                                                                   |
| `/login?next=`                    | `routes/login.tsx`           | 로그인 상태면 `beforeLoad` redirect, 버튼 → 쿠키(`tsr_session`) → `next`로 replace                                                                                                             |
| `/lab`                            | `routes/lab.tsx`             | sticky, 화면 안 fixed 하단바, 왼쪽 끝 캐러셀, 내부 스크롤, 화면 소유 portal 모달                                                                                                               |
| `/slow`                           | `routes/slow.tsx`            | loader 3초 (pendingComponent 없음)                                                                                                                                                             |
| `/error`                          | `routes/error.tsx`           | 렌더 오류 → 그 route의 `errorComponent`                                                                                                                                                        |
| `/crash`                          | `routes/crash.tsx`           | `errorComponent: false`로 경계를 두지 않아 루트 route `errorComponent`까지 감(탭바 포함 앱 전체가 교체됨)                                                                                      |
| 없는 경로                         | `routes/__root.tsx`          | 루트 `notFoundComponent` (탭바는 남음)                                                                                                                                                         |

## 실행

```sh
pnpm --filter tanstack-router build && pnpm --filter tanstack-router start   # http://localhost:3103
pnpm --filter tanstack-router dev                                            # 개발 서버, 같은 포트
```

## 관찰 (Chromium, production 빌드)

- `/orders` 로딩 뒤 redirect: 로그아웃 상태로 링크 이동 시 약 1000ms에 `pendingComponent`가 커밋되고(URL은 이미 `/orders`) 약 1216ms에 `/login?next=/orders`로 바뀐다. redirect가 오면 `pendingMinMs`(500)를 기다리지 않는다. 로그인 상태에서는 pending 1005ms → 내용 1522ms(최소 500ms 유지).
- history: `/orders`(push 링크) → redirect 뒤 `history.length` +1 (push 뒤 replace). `/settings` 클라이언트 가드도 +1. 탭바(replace)로 `/me` → `/login` 은 +0.
- 루트 `errorComponent`(`/crash`)는 루트 컴포넌트를 통째로 바꿔 탭바가 사라지고, 루트 `notFoundComponent`는 루트 `<Outlet />` 자리에 렌더돼 탭바가 남는다.
