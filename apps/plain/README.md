# plain

라우터 라이브러리 없이 History API만 쓰는 React 앱. route-stack 테스트 앱 (포트 3105). route-stack 없이 만든 기준선이다.

## 생성

```sh
npx create-vite@9.2.1 plain --template react-ts --no-interactive
```

- 버전: react·react-dom 19.3.0, vite 8.3.4, @vitejs/plugin-react 6.1.2, typescript 6.0.3

생성 뒤 바꾼 것

- `react`·`react-dom`을 19.3.0으로 고정, 포트가 붙은 `dev`·`start` 스크립트, `typecheck` 스크립트 추가
- 템플릿 데모 삭제, `.oxlintrc.json`·`lint` 스크립트 삭제 (레포 루트 oxlint 설정을 씀)

## 라우팅

`src/router.tsx`: `useSyncExternalStore`로 `popstate`를 구독하고 `pushState`/`replaceState`로 이동한다. push 뒤에는 맨 위로 스크롤하고, back 스크롤은 브라우저 기본(`history.scrollRestoration = "auto"`)에 맡긴다. `#` 링크는 브라우저 기본 동작.

라우터 기능(loader·redirect·blocker)이 없으므로 쿼리·hash·back·스와이프·스크롤 시나리오용 경로만 있다: `/`(`?category=`·`?rows=`), `/about`, `/search`(`?q=` replace), `/search/results?q=`(push, `sort` 정규화 replace), `/items/:id`(`?tab=`, `#comments`), `/products?id=`, `/lab`, `/me`(로그인 없음).

## route-stack을 붙일 곳

`src/App.tsx`의 `{page(url)}`를 `<Stack path={url.pathname + url.search}>{page(url)}</Stack>`으로 바꾼다. 탭바는 그 밖에 있다.

## 실행

```sh
pnpm --filter plain build
pnpm --filter plain start   # http://localhost:3105 (vite preview)
```

스모크 테스트: 서버를 띄운 뒤 `node apps/e2e/smoke.mjs plain`.
