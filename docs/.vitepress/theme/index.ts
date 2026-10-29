import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import { h } from "vue";
import "virtual:group-icons.css";
import PhoneDemo from "./components/PhoneDemo.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      "home-hero-image": () => h(PhoneDemo),
    }),
  enhanceApp({ app }) {
    app.component("PhoneDemo", PhoneDemo);
  },
} satisfies Theme;
