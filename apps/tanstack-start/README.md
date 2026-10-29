# tanstack-start (:3104)

TanStack Start로 만든 route-stack 테스트 앱(기준선, route-stack 없음). 사용자 기능·경로·최종 결과는 다른 라우터 앱과 같다.

## 생성

```sh
npx @tanstack/cli@0.71.1 create tanstack-start --no-examples --no-toolchain --no-git --no-install --no-intent --package-manager pnpm -y
```

생성된 옵션(`.cta.json`): `mode: file-router`, `typescript: true`, `tailwind: true`, `projectPreset: default`, `includeExamples: false`, `routerOnly: false`, `framework: react`, add-on 없음.

버전(설치 기준): @tanstack/react-start 1.169.1, @tanstack/react-router 1.170.44, @tanstack/react-router-devtools 1.167.2, @tanstack/react-devtools 0.10.13, react·react-dom 19.3.0, vite 8.3.4, typescript 6.0.3, tailwindcss 4.3.3.

### 템플릿 라우터 기본값 (`src/router.tsx`, 그대로 둠)

- `scrollRestoration: true`
- `defaultPreload: 'intent'`
- `defaultPreloadStaleTime: 0`
- `defaultViewTransition`: 설정 없음(꺼짐)
- pending 기본값(`pendingMs` 1000, `pendingMinMs` 500)도 그대로.

### 생성 후 바꾼 것

- `package.json`: react·react-dom을 19.3.0으로 고정, 포트 3104(`dev`, `start`), `typecheck: tsc --noEmit` 추가, 템플릿의 `pnpm.onlyBuiltDependencies`와 `pnpm-workspace.yaml`은 루트 `pnpm-workspace.yaml`로 옮김.
- `typecheck`가 `tsr generate`를 부르지 않는 이유: `tsr generate`는 Start용 `Register`(ssr·router) 선언이 빠진 routeTree를 만든다. `src/routeTree.gen.ts`는 `vite build`/`vite dev`(Start 플러그인)가 만든 것을 커밋한다.
- `src/styles.css`: 템플릿의 `@import "tailwindcss";`는 두고 앱 CSS(평범한 CSS)로 교체.
- 루트 `<html lang="ko">`, 기본 title 변경. devtools(`TanStackDevtools`)는 템플릿대로 `shellComponent`에 둠 (production 빌드에서 플러그인이 제거).
- 템플릿 데모 `index.tsx` 내용을 앱 홈으로 교체. `public/clip.mp4`(자동재생 영상) 추가.

## route-stack을 감쌀 곳

`src/routes/__root.tsx`의 `RootComponent` 안 `<Outlet />` 한 줄. 탭바(`TabBar`)·토스트(`ToastProvider`)·확인 모달(`ConfirmProvider`, portal)은 그 바깥이다. 헤더(뒤로 가기 = `router.history.back()`)는 각 화면 안.

## 경로와 구현

데이터는 모두 `src/api.ts`의 server function(`createServerFn`)이 서버 메모리의 가짜 데이터를 돌려준다. 로그인 쿠키 이름은 `tss_session`.

| 경로                              | 구현                                                                                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`, `/?category=`, `/?rows=1000` | loader(`getFeed`), 카테고리 칩 push, 더 보기·새 글 polling(30초)도 server fn                                                                                        |
| `/about`                          | 정적                                                                                                                                                                |
| `/search`                         | `navigate({ search, replace: true })`로 `?q=` 갱신, 제출은 `/search/results`로 push                                                                                 |
| `/search/results?q=`              | loader(`search`), `sort` 없으면 마운트 때 `sort=new` replace                                                                                                        |
| `/items/$id`                      | 레이아웃 route(`items/$id/route.tsx`) loader 300ms, React context로 상세·수정에 공유, `head()`로 문서 title, `?delay=`·`?fail=1`                                    |
| `/items/$id/edit`                 | `useBlocker({ shouldBlockFn, withResolver: true })` + 루트 확인 모달. 저장 = server fn → `router.invalidate()` → `navigate({ replace: true, ignoreBlocker: true })` |
| `/products?id=`                   | loader 300ms                                                                                                                                                        |
| `/me`                             | `beforeLoad`에서 `redirect` (렌더 전)                                                                                                                               |
| `/orders?delay=`                  | loader가 server fn(기본 1200ms)을 기다린 뒤 비로그인이면 `throw redirect`, `pendingComponent`                                                                       |
| `/settings`                       | 클라이언트 가드(`useEffect` + `navigate({ replace: true })`)                                                                                                        |
| `/login?next=`                    | 로그인 상태면 `beforeLoad` redirect. 버튼 → 쿠키 설정 → `next`로 replace                                                                                            |
| `/lab`                            | sticky, 화면 안 fixed 바, 캐러셀, 내부 스크롤, 화면 소유 portal 모달                                                                                                |
| `/slow`                           | loader 3초                                                                                                                                                          |
| `/error`                          | 렌더 오류 → 그 route의 `errorComponent`                                                                                                                             |
| `/crash`                          | `errorComponent: false`로 루트 route `errorComponent`까지 올라감 (탭바 포함 앱 전체가 바뀜)                                                                         |
| `/items/999`                      | server fn이 `notFound()` → `items/$id`의 `notFoundComponent`                                                                                                        |
| `/items/1?fail=1`                 | server fn 오류 → `items/$id`의 `errorComponent`. production에서는 server fn 오류 메시지가 그대로 오지 않아 고정 문구를 보여 줌                                      |
| 없는 경로                         | 루트 `notFoundComponent` (탭바 유지)                                                                                                                                |

## 실행

```sh
pnpm --filter tanstack-start build
pnpm --filter tanstack-start start   # vite preview가 SSR 서버(dist/server/server.js)까지 띄움, http://localhost:3104
pnpm --filter tanstack-start dev     # 개발 서버, 같은 포트
```

## 실측 기록 (Chromium, production 빌드)

- `/orders` 비로그인 클라이언트 이동: 클릭 즉시 URL이 `/orders`로 push(이전 화면 유지) → 약 1000ms에 `pendingComponent` 커밋 → 1200ms에 `/login?next=%2Forders`로 replace (history 길이 그대로).
- `/me`(push 이동): `/me` push 뒤 `/login?next=%2Fme`로 replace. history 1개 증가, back은 이동 전 화면. 탭바 마이는 `replace` 링크라 history가 늘지 않는다.
- 막힌 이동의 확인 모달은 TanStack 쪽 `withResolver` 대기로 열린다. `enableBeforeUnload`는 입력이 바뀌었을 때만 켬.
- 수정 저장 뒤 같은 레이아웃 match로 이동하면 loader를 다시 기다리지 않고 이전 데이터로 그려지므로 `router.invalidate()`를 먼저 부른다.
