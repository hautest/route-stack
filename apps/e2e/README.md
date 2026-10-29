# e2e

테스트 앱 하네스. 앱 코드가 아니다.

`smoke.mjs`: 기준선 스모크 테스트 (Playwright Chromium, 390×844). 각 앱의 production 서버를 먼저 띄운다.

```sh
pnpm --filter react-router-spa build && pnpm --filter react-router-spa start &
node apps/e2e/smoke.mjs react-router-spa   # 앱 이름을 생략하면 6개 모두
```

확인하는 것: 경로별 로드와 콘솔 오류, 에러 경로의 경계 화면, push → back, `/search` 입력의 `?q=` replace와 포커스, `/search/results`·`/products?id=` push, redirect 세 종류(로그아웃·로그인 상태), 로그인 replace, 수정 저장 replace, 수정 화면 blocker 모달(react-router·tanstack).

`stack.spec.ts`: route-stack Playwright e2e (프로젝트 = 앱, Chromium 390×844 터치 + react-router-spa WebKit). `webServer`가 각 앱을 build → start 한다 (이미 떠 있으면 재사용).

```sh
pnpm --filter e2e test                       # 전체
pnpm --filter e2e test --project=tanstack-router
```
