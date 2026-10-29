import { defineConfig } from "@playwright/test";

const APPS = {
  next: 3100,
  "react-router-spa": 3101,
  "react-router-ssr": 3102,
  "tanstack-router": 3103,
  "tanstack-start": 3104,
} as const;

// An iPhone-sized touch screen. No Android user agent: the edge swipe is off by
// default there.
const phone = {
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
};

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  fullyParallel: true,
  workers: 3,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: { trace: "retain-on-failure" },
  projects: [
    ...Object.entries(APPS).map(([app, port]) => ({
      name: app,
      metadata: { app },
      use: {
        ...phone,
        browserName: "chromium" as const,
        baseURL: `http://localhost:${port}`,
      },
    })),
    {
      name: "react-router-spa-webkit",
      metadata: { app: "react-router-spa" },
      use: {
        ...phone,
        browserName: "webkit" as const,
        baseURL: "http://localhost:3101",
      },
    },
  ],
  webServer: Object.entries(APPS).map(([app, port]) => ({
    command: `pnpm -C apps/${app} build && pnpm -C apps/${app} start`,
    cwd: "../..",
    url: `http://localhost:${port}`,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore" as const,
    stderr: "pipe" as const,
  })),
});
