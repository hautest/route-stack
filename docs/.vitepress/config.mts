import { defineConfig, type DefaultTheme, type HeadConfig } from "vitepress";
import {
  groupIconMdPlugin,
  groupIconVitePlugin,
} from "vitepress-plugin-group-icons";

// GitHub Pages serves the project at /route-stack/; a custom domain sets "/".
const base = process.env.DOCS_BASE ?? "/";

const sidebar = (
  prefix: string,
  t: Record<string, string>,
): DefaultTheme.SidebarItem[] => [
  {
    text: t.guide,
    items: [
      { text: t.introduction, link: `${prefix}/guide/introduction` },
      { text: t.gettingStarted, link: `${prefix}/guide/getting-started` },
      { text: t.routers, link: `${prefix}/guide/routers` },
      { text: t.transitions, link: `${prefix}/guide/transitions` },
      { text: t.swipeBack, link: `${prefix}/guide/swipe-back` },
      { text: t.scroll, link: `${prefix}/guide/scroll-and-layers` },
      { text: t.progress, link: `${prefix}/guide/progress` },
      { text: t.webview, link: `${prefix}/guide/webview` },
    ],
  },
  {
    text: t.howItWorks,
    items: [
      { text: t.overview, link: `${prefix}/how-it-works/overview` },
      { text: t.screens, link: `${prefix}/how-it-works/screens-and-history` },
      { text: t.designNotes, link: `${prefix}/how-it-works/design-notes` },
    ],
  },
  {
    text: t.advanced,
    items: [{ text: t.adapter, link: `${prefix}/advanced/writing-an-adapter` }],
  },
  {
    text: t.reference,
    items: [
      { text: t.api, link: `${prefix}/reference/api` },
      { text: t.limitations, link: `${prefix}/reference/limitations` },
      { text: t.troubleshooting, link: `${prefix}/reference/troubleshooting` },
    ],
  },
];

const en = {
  guide: "Guide",
  introduction: "Introduction",
  gettingStarted: "Getting Started",
  routers: "Routers",
  transitions: "Transitions",
  swipeBack: "Swipe Back",
  scroll: "Scroll & Layers",
  progress: "Progress CSS Variable",
  webview: "In a WebView",
  howItWorks: "How It Works",
  overview: "Overview",
  screens: "Screens & History",
  designNotes: "Design Notes",
  advanced: "Advanced",
  adapter: "Writing an Adapter",
  reference: "Reference",
  api: "API",
  limitations: "Limitations",
  troubleshooting: "Troubleshooting",
};

const ko = {
  guide: "가이드",
  introduction: "소개",
  gettingStarted: "시작하기",
  routers: "라우터",
  transitions: "전환 애니메이션",
  swipeBack: "스와이프 백",
  scroll: "스크롤과 레이어",
  progress: "진행도 CSS 변수",
  webview: "웹뷰에서 쓰기",
  howItWorks: "동작 원리",
  overview: "개요",
  screens: "Screen과 history",
  designNotes: "설계 노트",
  advanced: "심화",
  adapter: "어댑터 만들기",
  reference: "레퍼런스",
  api: "API",
  limitations: "제약",
  troubleshooting: "트러블슈팅",
};

// Google Analytics 4, only in a build given a measurement ID (GA_MEASUREMENT_ID
// = G-XXXXXXX): no tracking in development or forks. Page views between pages
// come from GA4's enhanced measurement, which counts history changes: the
// site navigates client-side, no route hook needed (it would count twice).
const gaId = process.env.GA_MEASUREMENT_ID;
const analytics: HeadConfig[] = gaId
  ? [
      [
        "script",
        {
          async: "",
          src: `https://www.googletagmanager.com/gtag/js?id=${gaId}`,
        },
      ],
      [
        "script",
        {},
        `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config",${JSON.stringify(gaId)});`,
      ],
    ]
  : [];

export default defineConfig({
  base,
  title: "route-stack",
  cleanUrls: true,
  lastUpdated: true,
  head: [["meta", { name: "theme-color", content: "#3182f6" }], ...analytics],
  markdown: {
    config(md) {
      md.use(groupIconMdPlugin);
    },
  },
  vite: {
    plugins: [groupIconVitePlugin()],
  },
  themeConfig: {
    socialLinks: [
      { icon: "github", link: "https://github.com/hautest/route-stack" },
    ],
    search: {
      provider: "local",
      options: {
        locales: {
          ko: {
            translations: {
              button: { buttonText: "검색", buttonAriaLabel: "검색" },
              modal: {
                noResultsText: "결과 없음",
                resetButtonTitle: "지우기",
                footer: {
                  selectText: "선택",
                  navigateText: "이동",
                  closeText: "닫기",
                },
              },
            },
          },
        },
      },
    },
  },
  locales: {
    root: {
      label: "English",
      lang: "en",
      description: "Native app navigation on the web.",
      themeConfig: {
        nav: [
          { text: "Guide", link: "/guide/introduction" },
          { text: "API", link: "/reference/api" },
          { text: "Demo", link: `${base}demo/`, target: "_blank" },
        ],
        sidebar: sidebar("", en),
        editLink: {
          pattern:
            "https://github.com/hautest/route-stack/edit/main/docs/:path",
        },
      },
    },
    ko: {
      label: "한국어",
      lang: "ko",
      link: "/ko/",
      description: "웹에서도 네이티브 앱 같은 네비게이션",
      themeConfig: {
        nav: [
          { text: "가이드", link: "/ko/guide/introduction" },
          { text: "API", link: "/ko/reference/api" },
          { text: "데모", link: `${base}demo/`, target: "_blank" },
        ],
        sidebar: sidebar("/ko", ko),
        outline: { label: "이 페이지에서" },
        docFooter: { prev: "이전", next: "다음" },
        lastUpdated: { text: "마지막 수정" },
        returnToTopLabel: "맨 위로",
        sidebarMenuLabel: "메뉴",
        darkModeSwitchLabel: "다크 모드",
        langMenuLabel: "언어",
        editLink: {
          pattern:
            "https://github.com/hautest/route-stack/edit/main/docs/:path",
          text: "GitHub에서 이 페이지 수정",
        },
      },
    },
  },
});
