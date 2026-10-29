import { defineConfig } from "oxfmt";

export default defineConfig({
  // Prettier's and Biome's default, kept by React, Next, TanStack and
  // stackflow.
  printWidth: 80,
  ignorePatterns: [
    "**/dist/**",
    "pnpm-lock.yaml",
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
    "apps/e2e/results/**",
  ],
});
