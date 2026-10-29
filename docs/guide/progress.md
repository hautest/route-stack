# Progress CSS Variable

Something outside the stack — a shared header — can follow a slide: the stack writes how far the slide has come into a CSS variable.

```tsx
<Stack enableProgressCssVar>
  <Outlet />
</Stack>
```

```css
.header-title {
  opacity: var(--route-stack-progress, 1);
}
```

## The value

`--route-stack-progress` is set on `<html>` during a slide and removed at rest.

- It is how far the screen the router currently renders has come in, from `0` to `1`.
- On push it rises from 0 to 1.
- During a swipe back it falls from 1 as the finger moves. When the back commits it switches to the screen arriving and rises again — at the same moment the router renders that screen's header content.

## Cost

Off by default. Each write changes an inherited variable on the root element, which restyles the whole document every frame of a slide.

- Turn it on only when something uses it.
- The screens themselves slide on the compositor; elements driven by the variable update on the main thread, at most once per frame. On a 120Hz iPhone they still move at 60Hz.
