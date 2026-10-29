# next — Next.js App Router 테스트 앱 (:3100)

route-stack 검증용 작은 커뮤니티 앱. route-stack 없이 만든 기준선(baseline)이다.

## 생성

```sh
npx create-next-app@16.4.0 next --yes --use-pnpm --skip-install --disable-git
```

`--yes`(기본값)로 생성된 옵션:

- TypeScript, Tailwind CSS(`@tailwindcss/turbopack`), App Router, `src/` 없음, 린터 없음, import alias `@/*`, `AGENTS.md` 포함
- React Compiler 끔(기본값)
- `next.config.ts`: `cacheComponents: true`, `partialPrefetching: true` (16.4 템플릿 기본값, 그대로 둠)
- Geist 폰트(`next/font/google`)

## 버전

| 패키지                           | 버전                                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| next                             | 16.4.0                                                                                               |
| react / react-dom (앱 의존성)    | 19.3.0                                                                                               |
| Next가 App Router에 번들한 React | `19.3.0-canary-278794d7-20261002` (`next/dist/compiled/react`, 빌드된 클라이언트 청크에도 이 문자열) |
| typescript                       | 5.9.3                                                                                                |

App Router 화면은 앱의 `react@19.3.0`이 아니라 Next에 번들된 canary를 쓴다.

## 생성 후 바꾼 것

- 템플릿 데모 페이지·`public/*.svg` 삭제, `public/clip.mp4`(ffmpeg testsrc 4초) 추가
- `globals.css`: Tailwind import와 폰트 `@theme`만 남기고 다크 모드 데모 변수·body 규칙을 앱 CSS로 교체
- `package.json`: 포트 3100, `typecheck` 스크립트(`next typegen && tsc --noEmit`), `packageManager` 제거
- 템플릿의 `pnpm-workspace.yaml`(sharp·unrs-resolver 빌드 설정)은 레포 루트로 옮김

## route-stack이 들어갈 곳

- `app/layout.tsx`의 `{children}` 한 줄 → `<Stack>{children}</Stack>`. 탭바·토스트는 이미 그 바깥에 있다.
- `instrumentation-client.ts`(아직 없음) → `export { onRouterTransitionStart } from "route-stack/next";`

## 경로와 Next 기능

| 경로                              | 구현                                                                                                                                                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`, `/?category=`, `/?rows=1000` | 서버 컴포넌트가 `lib/data.ts`에서 피드를 읽음(`<Suspense>` 안). 더 보기 `GET /api/feed`, 새 글 30초 polling `GET /api/new-posts` (route handler)                                                                                                              |
| `/about`                          | 정적 페이지 (빌드 ○)                                                                                                                                                                                                                                          |
| `/search`                         | 클라이언트 입력, 입력 중 `router.replace("/search?q=")`, 제출은 `next/form` GET → `/search/results` push                                                                                                                                                      |
| `/search/results?q=`              | 서버 컴포넌트 + `loading.tsx`. `sort`가 없으면 클라이언트 effect가 `&sort=new`로 `router.replace`                                                                                                                                                             |
| `/items/[id]`                     | `items/[id]/layout.tsx`가 글을 읽어(300ms) context로 상세·수정에 공유, 제목은 `generateMetadata`. 댓글·관련 글은 페이지가 읽음(`?fail=1`이면 실패 → `error.tsx`). 조회수 `POST /api/views/[id]`(마운트 때). `/items/999` → `notFound()` → `app/not-found.tsx` |
| `/items/[id]/edit`                | 같은 layout 공유. 저장 = Server Action `redirect(url, RedirectType.replace)` (+ `revalidatePath`). blocker 없음(Next에 해당 기능 없음)                                                                                                                        |
| `/products?id=`                   | 서버 컴포넌트 + `loading.tsx` (300ms)                                                                                                                                                                                                                         |
| `/me`                             | `proxy.ts`가 렌더 전 `/login?next=/me`로 redirect (redirect 1)                                                                                                                                                                                                |
| `/orders?delay=`                  | `loading.tsx` 뒤 서버 컴포넌트가 지연(기본 1200ms) 후 `redirect()` → 클라이언트 RedirectBoundary가 replace (redirect 2)                                                                                                                                       |
| `/settings`                       | 클라이언트 가드: 쿠키를 읽고 effect에서 `router.replace` (redirect 3)                                                                                                                                                                                         |
| `/login?next=`                    | 로그인 = Server Action(쿠키 설정 후 `redirect(next, replace)`). 로그인 상태로 오면 `proxy.ts`가 `next`로 redirect                                                                                                                                             |
| `/lab`                            | sticky 헤더, 화면 안 fixed 하단 바, 왼쪽 끝 캐러셀, 내부 스크롤, 화면이 연 portal 모달                                                                                                                                                                        |
| `/slow`                           | `connection()` 뒤 3초 대기, `loading.tsx`                                                                                                                                                                                                                     |
| `/error`                          | 페이지 렌더 오류 → `app/error/error.tsx`                                                                                                                                                                                                                      |
| `/crash`                          | 오류 경계 없이 → `app/global-error.tsx` (루트 layout까지 교체)                                                                                                                                                                                                |
| 없는 경로                         | `app/not-found.tsx`                                                                                                                                                                                                                                           |

쿠키 이름 `next_session` (localhost 포트끼리 쿠키를 공유하므로 앱마다 다름). 확인 모달은 blocker가 없어 쓰는 곳이 없어 두지 않았다.

## 실행

```sh
pnpm --filter next-app build && pnpm --filter next-app start   # http://localhost:3100
pnpm --filter next-app dev                                 # 개발 서버, 같은 포트
```

## 관찰한 것 (기준선)

- 빌드 표: `/about`·`/lab`·`/login`·`/me`·`/search`·`/settings` ○, `/`·`/items/[id]`·`/items/[id]/edit`·`/orders`·`/products`·`/search/results`·`/slow`·`/error`·`/crash` ◐ (Partial Prerender), `/api/*` ƒ, Proxy ƒ.
- `cacheComponents`가 켜져 있으면 Next가 이전 화면을 React `<Activity>`(hidden)로 최대 3개 보관한다(문서: `node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`). 그래서 route-stack 없이도 `/` → `/items/5` → back에서 좋아요·더 불러온 목록(320개)·스크롤이 유지됐다. route-stack 비교 때 이 기본 동작과의 관계를 따로 봐야 한다.
- `cacheComponents` 때문에 런타임 데이터(`searchParams`, `cookies()`, `params`, `usePathname()`)를 읽는 곳은 모두 `<Suspense>`/`loading.tsx` 안에 있어야 빌드가 된다. 탭바의 현재 탭 표시(`usePathname`)도 Suspense로 감쌌다.
- production에서는 서버 오류 메시지가 가려져 오류 경계는 자기 문구를 보여 준다.
