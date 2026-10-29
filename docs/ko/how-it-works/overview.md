# 개요 {#overview}

## 구성 요소 {#the-pieces}

```text
 router ──path, view()──▶ adapter ──▶ <Stack>  (React binding)
                                         │ resolve · commit
                                         ▼
 history ──push/replace/traverse──▶   Core   ◀──drag/release── swipe
                                         │
                                         ▼
                              slide: layers · aim · motion
```

| 구성 요소     | 하는 일                                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **history**   | Navigation API를 감쌉니다. Navigation API가 없으면 `history.state`로 대신 구현합니다. history 항목마다 어떤 screen을 보여 주는지, 이동마다 어떤 종류인지 알려 줍니다. |
| **Core**      | 상태 머신입니다. screen 목록과 현재 보이는 screen, 두 screen 사이의 전환을 관리합니다. React와 라우터는 알지 못합니다.                                                    |
| **`<Stack>`** | React 바인딩입니다. 보관 중인 screen을 모두 `<Activity>` 안에 렌더하고, 렌더와 커밋이 일어날 때마다 코어에 넘깁니다.                                                  |
| **adapter**   | 라우터를 읽어서 렌더된 경로와, 그 렌더가 현재 항목에 해당하는지(`view()`)를 알려 줍니다.                                                                            |
| **slide**     | 두 screen을 레이어로 띄우고, 레이어 뒤에서 window를 스크롤하고, keyframe을 재생합니다.                                                                                |
| **swipe**     | 왼쪽 가장자리에서 시작한 터치(`swipe="full"`인 전체 스와이프면 화면 어디서든 시작한 터치)를 진행도로 바꾸고, 손을 떼면 뒤로 갈지 제자리로 돌아올지 정합니다. 페이지가 쓰는 드래그는 건드리지 않습니다.                          |

## DOM 구조 {#the-dom}

```html
<div data-stack-root style="isolation: isolate">
  <div data-stack-screen="3">
    <!-- 현재: 최신이 맨 앞 -->
    <div data-stack-content>…</div>
    <!-- 보임 -->
  </div>
  <div data-stack-screen="1">
    <!-- 보관됨 -->
    <div data-stack-content style="display: none">…</div>
  </div>
</div>
```

- screen마다 host `div`가 content `div`를 감쌉니다. host `div`는 전환이 움직이는 레이어이고, content `div`는 React의 `<Activity>`가 숨기는 부분입니다.
- 숨은 screen도 DOM과 React 상태는 그대로 남습니다. effect는 screen이 숨어 있는 동안 멈췄다가 다시 보이면 다시 실행됩니다.
- 숨은 screen은 다시 렌더되지 않습니다. 스택이 숨은 screen을 suspend 상태로 두므로 앱의 업데이트가 닿지 않습니다.

## 이동 한 번의 흐름 {#one-navigation}

목록에서 상세 페이지로 push하는 경우를 예로 듭니다.

```text
 1  라우터 이동                history: push, 항목 2 → 새 screen
 2  React가 <Stack> 렌더       resolve: 이 경로 → 새 screen (pending)
 3  layout effect (그리기 전)  commit: screen 2 표시, 방향 push
 4  전환 시작                  두 screen을 띄우고, 뒤에서 window를 0으로 스크롤
 5  전환 끝                    settle: 레이어 내림, 목록 숨김, 갈 수 없는 screen 정리
```

2~4단계는 브라우저가 화면을 그리기 전에 일어나므로 첫 프레임부터 두 screen이 제자리에 있습니다.

| 경우                       | 차이                                                                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Back                       | history가 traverse로 알립니다. 도착할 screen이 이미 보관되어 있으므로 2단계에서 재사용합니다. 방향은 back이고, keyframe을 거꾸로 재생합니다.          |
| `animate`가 `false`를 반환 | 4단계를 건너뛰고 바로 settle합니다.                                                                                                                 |
| 스와이프 백                | 4단계가 먼저 시작되고, 손가락 움직임에 따라 진행됩니다. 손을 떼면 스택이 `history.back()`을 호출하고, 1~3단계는 진행 중인 전환 아래에서 이어집니다. |
| 전환 중 다른 이동          | 진행 중이던 전환은 React가 이미 보여 주는 screen에서 끝내고, 새 전환을 시작합니다.                                                                         |
| 전환 중 리다이렉트         | 들어오던 screen이 교체되고, 전환은 새 screen을 향해 이어집니다.                                                                                         |

## 미리 스크롤 {#scrolling-ahead}

레이어는 저장된 스크롤 값만큼 내용을 밀어서 보여 주고, 실제 window 스크롤은 레이어 뒤에 가려져 있습니다. 전환이 끝나기 전에 window를 도착할 screen의 위치로 미리 옮겨 둡니다. 그래서 레이어를 내려도 화면이 바뀌지 않습니다.

레이어를 내리면서 같은 프레임에 스크롤까지 옮기면 iOS WebKit에서 빈 프레임이 그려졌습니다. 미리 스크롤해 두면 이 문제를 피할 수 있습니다.

- push와 버튼 back: 전환이 시작될 때 window를 옮깁니다.
- 스와이프: window가 더 가까운 쪽 screen의 위치를 따라갑니다. 55%를 넘으면 들어오는 screen의 위치로, 45% 미만이면 나가는 screen의 위치로 옮깁니다. 그래서 손을 뗀 뒤 어느 쪽으로 가든 window는 이미 그 위치에 있습니다.

## 프레임 {#frames}

- 재생되는 전환(push, back, 손을 뗀 뒤의 스와이프)은 합성 스레드에서 돌아가는 Web Animation입니다.
- 손가락으로 드래그하는 동안에는 JavaScript가 프레임마다 애니메이션을 seek합니다.

iOS 웹뷰에서 각각 몇 Hz로 도는지는 [웹뷰에서 쓰기](/ko/guide/webview#_120hz)에 정리돼 있습니다.
