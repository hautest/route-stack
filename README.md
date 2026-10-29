# route-stack

Native app navigation on the web, built for web apps in a WebView: screens you pass stay alive, push and back slide between live screens, and a finger swipes back from the left edge or anywhere on the screen — on top of React Router, TanStack Router or the Next.js App Router.

```sh
npm install route-stack
```

```tsx
import { Stack } from "route-stack/react-router";

<Stack>
  <Outlet />
</Stack>;
```

**Documentation:** https://hautest.github.io/route-stack/ ([한국어](https://hautest.github.io/route-stack/ko/))

## Repository

| Path                   |                                                                      |
| ---------------------- | -------------------------------------------------------------------- |
| `packages/route-stack` | The library                                                          |
| `apps/*`               | Test apps for each router, and the e2e suite (`apps/e2e`)            |
| `docs`                 | The documentation site (VitePress), with its demo app in `docs/demo` |

```sh
pnpm install
pnpm --filter route-stack build
pnpm test
pnpm --filter route-stack-docs dev
```

## License

[MIT](./LICENSE)
