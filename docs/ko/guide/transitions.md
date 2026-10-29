# 전환 애니메이션 {#transitions}

## 프리셋 {#presets}

| 프리셋     | 모양                                                                                                                  | 시간 | easing |
| ---------- | --------------------------------------------------------------------------------------------------------------------- | -------- | ------ |
| `ios`      | UIKit 내비게이션 push. 새 screen이 이전 screen 위로 밀려 들어오고, 이전 screen은 왼쪽으로 30% 움직이며 어두워집니다            | 350ms | `ease` |
| `android`  | Android 14+ 액티비티 전환. 새 screen이 오른쪽 10% 위치에서 밀려 들어오며 초반에 페이드 인하고, 이전 screen은 왼쪽으로 10% 움직입니다 | 450ms | `cubic-bezier(0.2, 0, 0, 1)` |
| `material` | Material shared axis X. 두 screen이 30px 움직이면서 한쪽은 사라지고 다른 쪽은 나타납니다                                   | 300ms | `cubic-bezier(0.4, 0, 0.2, 1)` |

기본값은 플랫폼에 따라 정해집니다. Android에서는 `android`, 그 밖의 플랫폼에서는 `ios`입니다.

<PhoneDemo preset="material" />

## `animate`로 고르기 {#choosing-with-animate}

`animate`는 screen이 바뀔 때마다 호출되어 재생할 전환을 반환합니다. 전환하지 않으려면 `false`를 반환합니다. 스택은 스와이프 백을 시작해도 되는지 확인할 때도 이 함수를 호출합니다. 그러니 부수 효과 없이 가볍게 만들어야 합니다.

```tsx
import { ios, material } from "route-stack";

<Stack
  animate={(from, to, direction) => {
    if (to.startsWith("/tabs/")) return false; // 탭 전환: 슬라이드 없음
    if (to.startsWith("/settings")) return material;
    return ios;
  }}
>
```

| 인자        | 값                              |
| ----------- | ------------------------------- |
| `from`      | 떠나는 screen의 경로(쿼리 포함)   |
| `to`        | 도착하는 screen의 경로(쿼리 포함) |
| `direction` | `"push"`, `"back"`, `"replace"` |

- 브라우저의 앞으로 가기 버튼은 `"push"`입니다. 이동할 screen을 위에 밀어 넣기 때문입니다.
- `history.go(-3)`은 `"back"` 한 번으로 처리됩니다.
- 스와이프 백도 `animate(from, to, "back")`을 호출합니다. 여기서 `false`를 반환하면 해당 screen 쌍에서는 스와이프도 비활성화됩니다.
- `false`를 반환해도 screen은 바뀌며, 떠난 screen은 그대로 보관됩니다.

## 전환 직접 만들기 {#your-own-transition}

전환은 데이터일 뿐입니다. 각 screen의 keyframe을 지정하면 push에서는 정방향으로 재생됩니다. back에서는 `back` 필드가 없으면 역방향으로 재생됩니다.

```ts
import type { Transition } from "route-stack";

export const fade: Transition = {
  duration: 250,
  easing: "ease-out",
  enter: [{ opacity: 0 }, { opacity: 1 }],
  leave: [{ opacity: 1 }, { opacity: 0 }],
  enterOnTop: true,
};
```

| 필드         | 설명                                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| `duration`   | 애니메이션 길이(밀리초). 스와이프 중 손을 떼면 남은 거리와 관계없이 나머지를 이 길이만큼 재생합니다                  |
| `easing`     | 재생되는 슬라이드(push, back, 스와이프 중 손을 뗀 뒤 남은 구간)에 적용할 CSS easing. 손가락을 따라갈 때는 선형으로 움직입니다 |
| `enter`      | push에서 들어오는 screen의 keyframe                                                                               |
| `leave`      | push에서 나가는 screen의 keyframe                                                                                 |
| `shade`      | 선택. 아래 screen을 덮어 어둡게 만드는 검은 레이어의 keyframe(`opacity`만 사용)                                   |
| `shadow`     | 선택. 슬라이드하는 동안 위쪽 screen에 적용하는 고정 `box-shadow`                                                  |
| `enterOnTop` | 들어오는 screen을 나가는 screen 위에 그릴지 여부                                                                    |
| `back`       | 선택. back에서만 쓰는 `enter` / `leave` / `shade`. 정방향으로 재생됩니다. 지정하지 않으면 back은 push를 거꾸로 재생합니다. `back`에 `shade`가 없으면 back에는 shade가 없습니다(push의 `shade`를 쓰지 않습니다) |

keyframe은 [Web Animations](https://developer.mozilla.org/docs/Web/API/Web_Animations_API) keyframe이므로 애니메이션할 수 있는 CSS 속성이라면 무엇이든 쓸 수 있습니다. 다만 속성마다 성능이 다릅니다.

| 속성                                                                        | 실행 위치   | 비용                                                                               |
| --------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| `transform`(`translate`, `scale`, `rotate`), `opacity`                      | 합성 스레드 | JS가 바쁜 중에도 끊기지 않습니다. ProMotion 아이폰에서는 120Hz로 움직입니다                             |
| `filter`, `clip-path`, `border-radius`, `background-color`, `box-shadow` 등 | 메인 스레드 | 프레임마다 화면 크기의 레이어를 다시 그립니다. 저사양 폰에서는 프레임이 빠질 수 있습니다 |
| `width`, `height`, `top`, `left`, `margin` 등                               | 메인 스레드 | 프레임마다 레이아웃을 다시 계산합니다. 쓰지 않는 게 좋습니다                                      |

- 프리셋은 `transform`과 `opacity`만 씁니다.
- `shadow`는 위쪽 레이어에 적용하는 고정 스타일이며 애니메이션되지 않습니다.
- `back`이 없으면 back에서는 keyframe이 거꾸로 재생됩니다. 돌아오는 screen에 `leave`가, 떠나는 screen에 `enter`가 적용됩니다.
- back에서도 레이어는 push 때와 같은 순서로 쌓입니다. `enterOnTop`이 `true`면 push 때 들어온 screen이 back에서도 위에 있습니다.
