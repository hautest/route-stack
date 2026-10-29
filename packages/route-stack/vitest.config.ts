import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/**/*.browser.test.{ts,tsx}"],
        },
      },
      {
        // As Next inlines it (no basePath).
        define: {
          "process.env.__NEXT_ROUTER_BASEPATH": '""',
          "process.env.__NEXT_TRAILING_SLASH": "false",
        },
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.{ts,tsx}"],
          exclude: ["src/**/*.basepath.browser.test.{ts,tsx}"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            // WebKit is the engine of iOS WebViews.
            instances: [{ browser: "chromium" }, { browser: "webkit" }],
          },
        },
      },
      {
        define: {
          "process.env.__NEXT_ROUTER_BASEPATH": '"/app"',
          "process.env.__NEXT_TRAILING_SLASH": "true",
        },
        test: {
          name: "browser-basepath",
          include: ["src/**/*.basepath.browser.test.{ts,tsx}"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
