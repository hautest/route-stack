import { defineConfig } from "@rslib/core";

export default defineConfig({
  lib: [{ format: "esm", bundle: false, dts: true }],
  source: {
    entry: { index: ["./src/**", "!./src/**/*.test.{ts,tsx}"] },
    tsconfigPath: "./tsconfig.build.json",
  },
  output: { target: "web" },
  // The automatic JSX runtime (react/jsx-runtime), as tsconfig: the classic one
  // needs React in scope.
  tools: { swc: { jsc: { transform: { react: { runtime: "automatic" } } } } },
});
