# react-router-spa

React Router **data mode** SPA(`createBrowserRouter` + `RouterProvider`). route-stack 테스트 앱 (포트 3101). route-stack 없이 만든 기준선이다.

## 생성

React Router는 data mode용 템플릿이 없어 공식 문서(“Data Mode → Installation”)대로 Vite React 템플릿에 `react-router`를 더했다.

```sh
npx create-vite@9.2.1 react-router-spa --template react-ts --no-interactive
pnpm add react-router@^8.4.0
```

- 생성 옵션: `react-ts` 템플릿(React + TypeScript + Oxlint 설정)
- 버전: react-router 8.4.0, react·react-dom 19.3.0, vite 8.3.4, @vitejs/plugin-react 6.1.2, typescript 6.0.3

생성 뒤 바꾼 것

- `react`·`react-dom`을 19.3.0으로 고정, 포트가 붙은 `dev`·`start` 스크립트, `typecheck` 스크립트 추가
- 템플릿 데모(`App.tsx`, `App.css`, `src/assets`, `public/icons.svg`) 삭제
- `.oxlintrc.json`·`lint` 스크립트 삭제 (레포 루트 oxlint 설정을 씀)

## 라우터 설정

- 문서 권장대로 루트 route 요소 안에 `<ScrollRestoration />`
- preload 없음, `<Link viewTransition>` 안 씀

## route-stack을 붙일 곳

`src/routes/root.tsx`의 `<Outlet />` 한 줄을 `<Stack><Outlet /></Stack>`으로 바꾼다. 탭바·토스트·확인 모달(portal)은 `<Outlet />` 밖, 헤더(뒤로 가기)는 각 화면 안에 있다.

## 경로와 구현

| 경로                                                           | 구현                                                                                                                                                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`, `/?category=`, `/?rows=1000`                              | loader(메모리), 카테고리 칩 `<Link>` push, 더 보기·좋아요는 컴포넌트 상태, 30초 polling(`setInterval`)                                                                                |
| `/about`                                                       | 정적                                                                                                                                                                                  |
| `/search`                                                      | `autoFocus` 입력, 입력 중 `setSearchParams(..., { replace: true })`, GET `<Form action="/search/results">`(push)                                                                      |
| `/search/results?q=`                                           | loader, `sort`가 없으면 effect에서 `&sort=new`로 replace                                                                                                                              |
| `/items/:id`                                                   | 레이아웃 route loader(300ms, `?delay=`·`?fail=1`), React context로 상세·수정에 전달, `<title>`, `?tab=` push, `<a href="#comments">`와 `<Link to="#comments">`, 마운트 때 조회수 기록 |
| `/items/:id/edit`                                              | `action` → `replace()`로 상세, `useBlocker` + 루트 확인 모달                                                                                                                          |
| `/products?id=`                                                | loader 300ms                                                                                                                                                                          |
| `/me`                                                          | loader `redirect` (렌더 전)                                                                                                                                                           |
| `/orders?delay=`                                               | loader가 Promise를 담은 객체 반환 + `<Await>`, 미로그인이면 `<Navigate replace>` (기본 1200ms)                                                                                        |
| `/settings`                                                    | 클라이언트 가드(effect에서 `navigate(..., { replace: true })`)                                                                                                                        |
| `/login?next=`                                                 | 로그인 상태면 loader `redirect(next)`, 로그인은 `action`에서 쿠키(`rrspa_session`) 설정 후 `replace(next)`                                                                            |
| `/lab`                                                         | sticky·화면 안 fixed 바·캐러셀·내부 스크롤·화면 소유 portal 모달                                                                                                                      |
| `/slow`                                                        | 3초 걸리는 `await` loader (이전 화면에 머묾)                                                                                                                                          |
| `/error`, `/items/999`, `/items/1?fail=1`, `/crash`, 없는 경로 | route `ErrorBoundary`, 404, loader 실패, 루트 `ErrorBoundary`, `*` route                                                                                                              |

## 실행

```sh
pnpm --filter react-router-spa build
pnpm --filter react-router-spa start   # http://localhost:3101 (vite preview)
pnpm --filter react-router-spa dev     # 개발 서버, 같은 포트
```

스모크 테스트: 서버를 띄운 뒤 `node apps/e2e/smoke.mjs react-router-spa`.
