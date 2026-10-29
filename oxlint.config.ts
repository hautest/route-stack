import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["typescript", "react", "import"],
  categories: {
    correctness: "error",
    suspicious: "warn",
  },
  rules: {
    // history.state fields of routers and of this library are named by
    // convention (__NA, __routeStack).
    "no-underscore-dangle": "off",
    // Apps use the automatic JSX runtime and import their stylesheets for side effects.
    "react/react-in-jsx-scope": "off",
    "import/no-unassigned-import": ["warn", { allow: ["**/*.css"] }],
  },
  ignorePatterns: [
    "**/dist/**",
    "apps/mobile/**",
    "**/.next/**",
    "**/build/**",
    "**/.output/**",
    "**/.tanstack/**",
    "**/.nitro/**",
    "**/.react-router/**",
    "**/routeTree.gen.ts",
    "**/next-env.d.ts",
    "docs/.vitepress/cache/**",
    "docs/public/demo/**",
    "docs/.snippets/**",
  ],
});
