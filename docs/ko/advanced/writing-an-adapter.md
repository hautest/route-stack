# 어댑터 만들기 {#writing-an-adapter}

스택이 모르는 라우터는 어댑터로 연결합니다. 어댑터는 코어 `Stack`을 감싸는 작은 컴포넌트입니다.

```tsx
import { Stack as Core, type StackProps, type View } from "route-stack";

export function Stack(props: Omit<StackProps, "path">) {
  const path = useRenderedPath(); // 이번 렌더가 그리는 경로 + 쿼리
  return <Core {...props} path={path} view={() => viewOf(path)} />;
}
```

## `path` {#path}

라우터가 지금 렌더하고 있는 페이지의 경로 **+ 쿼리**입니다. URL이 아닙니다. 라우터가 다음 페이지를 불러오는 동안 이전 페이지를 계속 렌더하면 둘이 어긋납니다. 이때는 지금 그리고 있는 쪽을 넘겨야 합니다. 어떤 screen도 다른 페이지의 내용을 받으면 안 됩니다.

## `view()` {#view}

이번 렌더가 현재 history 항목과 어떤 관계인지 알려 줍니다. 이 정보는 라우터만 알 수 있습니다. 스택은 렌더할 때마다 호출하지 않고 필요할 때 호출합니다.

- 렌더 중에는 `ahead`인지 봅니다. 현재 항목의 screen이 다른 경로로 숨어 있으면 `current`인지도 봅니다. `stale` 렌더라면 그 숨은 screen을 다시 쓰지 않습니다.
- 커밋 때는 `current`인지 `stale`인지 봅니다.
- 스와이프 back 도중 traverse가 일어나면 다음 프레임에 `held`인지 봅니다.

서버에서는 호출하지 않습니다.

```ts
type View =
  | "current"
  | "stale"
  | "held"
  | { ahead: "push" | "replace"; url: string };
```

| 값          | 반환할 때                                                                             | 스택의 동작                                                                   |
| ----------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `"current"` | 렌더한 내용이 현재 항목의 것                                                          | 커밋합니다. 방향을 정하고 슬라이드합니다                                      |
| `"stale"`   | history는 이동했지만 라우터는 아직 떠나온 screen을 렌더하는 중(loader, 데이터)        | 이번 커밋은 무시하고 다음 커밋을 기다립니다                                   |
| `"held"`    | history가 이동한 항목을 라우터가 거부함(blocker가 확인 중)                            | 스와이프 back을 원래 위치로 되돌립니다                                        |
| `{ ahead }` | 라우터가 history에 쓰기 전에 push나 replace를 렌더함. `url`은 history에 기록될 형태의 이동 URL(절대 URL, 또는 base path를 포함한 경로) | 이동 종류와 함께 `sameScreen`을 호출해 새 screen인지 같은 screen인지 정합니다 |

`view`가 없으면 모든 렌더를 `"current"`로 봅니다. history를 먼저 쓰고 곧바로 새 페이지를 렌더하는 라우터라면 이것으로 충분합니다.

## 규칙 {#rules}

- **history가 바뀔 때마다 다시 렌더해야 합니다.** 경로가 같아도 마찬가지입니다. 가드가 back을 이미 보이는 screen으로 redirect하면 항목만 바뀝니다. 스택은 커밋 시점에 그 항목이 현재 항목임을 알게 됩니다.
- **호출된 시점의 상태를 읽어야 합니다.** `view()`는 컴포넌트가 렌더된 시점이 아니라 호출된 시점을 기준으로 답해야 합니다.
- **traverse에는 `ahead`가 없습니다.** 뒤로/앞으로 가기에서는 어느 라우터든 렌더하기 전에 history가 먼저 이동합니다.

## 세 가지 어댑터 {#the-three-adapters}

| 어댑터          | `path`                                                | `view()`                                                                                                                                          |
| --------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| React Router    | `useLocation()`의 pathname + search                   | 렌더한 `location.key`가 `history.state.key`와 같으면 `current`, 다르면 `stale`                                                                    |
| TanStack Router | outlet이 렌더하는 마지막 match                        | 라우터 자체의 key가 `history.state`와 다르면 `held`. 이동할 location이 현재 항목이고 매칭한 경로가 렌더한 경로와 같으면 `current`, 아니면 `stale` |
| Next.js         | `usePathname()` + `useSearchParams()`, 브라우저에서만 | 이 pathname에 대한 `onRouterTransitionStart` 힌트가 있으면 `{ ahead, url }`. 없으면 경로가 현재 URL과 같을 때 `current`, 다를 때 `stale`          |

동작하는 예시는 `packages/route-stack/src/adapters/`에 있습니다.
