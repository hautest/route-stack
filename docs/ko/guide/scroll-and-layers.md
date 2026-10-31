# 스크롤과 레이어 {#scroll-layers}

## screen별 스크롤 위치 {#scroll-is-per-screen}

window 스크롤은 스택이 관리하며, screen마다 위치를 따로 기억합니다. 목록을 절반쯤 스크롤한 상태로 다른 screen에 갔다가 돌아오면 그 위치 그대로입니다.

- 새 screen은 맨 위에서 시작합니다. `location.hash`가 가리키는 요소가 있으면 그 요소 위치에서 시작합니다(`scroll-margin-top` 반영).
- 뒤로 가서 다시 보이는 screen은 저장해 둔 위치로 돌아갑니다.
- 스택이 마운트되어 있는 동안 `history.scrollRestoration`은 `manual`입니다.
- 라우터의 스크롤 복원(`<ScrollRestoration>`, TanStack `scrollRestoration`)은 켜 두어도 괜찮습니다. 스택이 그다음에 위치를 복원합니다. 다만 TanStack Start처럼 SSR을 쓰면 TanStack이 hydration 직후 window를 맨 위로 올립니다. 설정은 [TanStack Router](/ko/guide/routers#tanstack-router)를 참고하세요.
- 페이지 안의 스크롤 영역(`overflow: auto` 요소)은 위치가 그대로 유지됩니다. DOM이 남아 있으므로 브라우저가 알아서 유지합니다.
- 같은 screen 안에서 이동할 때(`/page`에서 `/page#section`으로 갔다가 뒤로 올 때)는 스크롤을 복원하지 않습니다. screen이 바뀌지 않기 때문입니다.

## 전환 중의 모습 {#how-a-slide-looks}

전환하는 동안 두 screen은 페이지에서 떠올라 viewport 크기의 `position: fixed` 레이어가 됩니다. 각 레이어에는 해당 screen의 스크롤 위치에 맞는 내용이 보입니다. 전환이 끝나면 레이어는 다시 페이지로 내려옵니다. 그사이 레이어 뒤에서는 window가 이미 도착할 screen의 위치로 옮겨져 있으므로, 레이어가 내려와도 화면이 바뀌지 않습니다.

CSS에는 다음과 같은 영향이 있습니다.

- screen 안의 `position: fixed` 요소(떠 있는 버튼, screen 안 탭바)는 자기 레이어 안에서 제자리를 지킵니다.
- 레이어 배경은 스택 루트부터 위로 올라가며 찾습니다. 배경이 지정된 첫 요소(`body`, `html` 등)의 배경을 쓰고, 그런 요소가 없으면 페이지 기본값을 씁니다.
- 전환 중에는 두 screen이 `inert` 상태가 되어 탭, 포커스, 키보드 입력을 받지 않습니다. 스택 밖 요소는 그대로 동작합니다.

## 스택 밖 요소 {#outside-the-stack}

`<Stack>` 밖의 요소는 screen과 함께 움직이지 않습니다. 전환 중에 어떻게 보이는지는 배치 방식에 따라 다릅니다.

| 스택 밖 요소                    | 전환 중                                                                                                                                                                                                                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `position: fixed`               | 제자리에 그대로 있습니다. **이 방식을 권장합니다.**                                                                                                                                                                                                                               |
| 스택 위, 일반 문서 흐름(헤더)   | 레이어에 덮이지는 않지만, 두 screen의 스크롤 위치가 다르면 전환이 시작되거나 끝날 때 갑자기 나타나거나 사라집니다. 자세한 내용은 [트러블슈팅](/ko/reference/troubleshooting#a-header-above-the-stack-jumps)에 있습니다. |
| 스택 아래, 일반 문서 흐름(푸터) | 전환 중에는 화면 크기의 레이어에 가려지고, 전환이 끝나면 다시 보입니다.                                                                                                                                                                                                           |
| `position: sticky`              | 붙기 전에는 일반 흐름처럼, 붙은 뒤에는 fixed처럼 동작합니다.                                                                                                                                                                                                                      |
| `position: relative`            | 일반 흐름과 같습니다. `z-index`가 있으면 보이는 동안 움직이는 screen 위에 그려지고, 없으면 레이어에 가려집니다.                                                                                                                                                                     |
| `position: absolute`            | 자리를 차지하지 않아서 레이어가 맨 위부터 시작합니다. `z-index`가 있으면 움직이는 screen 위에 그려지고, 없으면 전환이 끝날 때까지 레이어에 가려집니다. 어느 쪽이든 window와 함께 스크롤되므로, 두 screen의 스크롤 위치가 다르면 갑자기 나타나거나 사라집니다.                         |

공통 헤더와 탭바는 `position: fixed`로 두거나 스택 안에 넣어 screen과 함께 움직이게 하면 됩니다.

```tsx
<>
  <header style={{ position: "fixed", top: 0, left: 0, right: 0 }}>…</header>
  <Stack>
    <Outlet />
  </Stack>
</>
```

- 스택 루트에는 `isolation: isolate`가 적용됩니다. 그래서 레이어의 `z-index`는 스택 안에서만 효과가 있고, 스택 밖 fixed 요소의 순서는 바뀌지 않습니다.
- `<Stack>`의 조상에는 `transform` 같은 속성을 걸면 안 됩니다. 레이어가 viewport가 아니라 그 요소를 기준으로 놓입니다. 해당 속성 목록은 [트러블슈팅](/ko/reference/troubleshooting#screens-slide-to-the-wrong-place-or-vanish)에 있습니다.
- portal(모달, 토스트)은 스택 밖에 렌더되므로 제자리에 있습니다. screen을 이동할 때 닫는 처리는 앱에서 해야 합니다.

## 가로 스크롤 요소: `--route-stack-overflow` {#horizontal-scrollers-route-stack-overflow}

iOS WebKit에서는 레이어 뒤에서 window가 스크롤될 때마다, 떠오른 레이어 안의 스크롤 요소가 한 프레임 동안 빈 채로 그려집니다. 스택은 전환할 때마다 레이어 뒤에서 window를 스크롤하므로 캐러셀 같은 스크롤 요소가 깜빡일 수 있습니다.

CSS 변수 하나로 해결할 수 있습니다. 스택은 전환하는 동안 떠오른 두 screen에만 `--route-stack-overflow: hidden`을 설정합니다. 스크롤 요소의 overflow 값에 이 변수를 쓰면 됩니다.

```css
.carousel {
  overflow-x: var(--route-stack-overflow, auto);
}
```

- 평소에는 변수가 없으므로 기본값(`auto`)이 적용됩니다.
- 전환하는 동안에는 요소가 스크롤되지 않으므로 레이어와 함께 그려집니다. `hidden`이어도 `scrollLeft`는 그대로라서 아무것도 움직이지 않습니다.
- 추가 비용은 없습니다. 변수는 전환이 시작될 때 한 번 설정되고 끝날 때 제거되며, 두 screen에만 적용됩니다.

## 긴 목록 {#long-lists}

숨겨 둔 screen을 다시 보여 줄 때는 레이아웃을 다시 계산합니다. 그래서 아주 긴 목록이 있는 screen은 back의 첫 프레임이 늦어질 수 있습니다. 화면 밖의 행은 브라우저가 건너뛰도록 설정하는 것을 권합니다.

```css
.feed-item {
  content-visibility: auto;
  contain-intrinsic-size: auto 120px; /* 대략 행 하나의 높이 */
}
```

CPU를 6배 느리게 설정하고 1,000행 목록에서 측정했을 때 back의 첫 프레임이 485ms에서 123ms로 줄었습니다.

## 요소 id {#element-ids}

보관된 screen은 DOM에 남아 있으므로 두 screen에 같은 `id`가 있을 수 있습니다(상품 페이지 두 개에 각각 `id="price"`). 가장 최근 screen이 DOM에서 가장 앞에 렌더되므로 `getElementById`, `<label for>`, `#anchor`는 현재 screen의 요소를 찾습니다.
