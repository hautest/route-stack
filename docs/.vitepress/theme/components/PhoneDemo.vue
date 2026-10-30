<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useData, withBase } from "vitepress";
import { renderSVG } from "uqr";

// The demo app, built into public/demo/, in a phone frame; a QR code opens it
// on a phone, where the edge swipe is a real touch.
// preset, swipe: the demo's starting props (its selects change them).
const props = defineProps<{ path?: string; preset?: string; swipe?: string }>();
const { lang } = useData();

const src = computed(() => {
  const query = new URLSearchParams();
  for (const key of ["preset", "swipe"] as const)
    if (props[key]) query.set(key, props[key]);
  const search = query.toString();
  return withBase(`/demo${props.path ?? "/"}${search ? `?${search}` : ""}`);
});

const qr = ref("");
// On a phone the frame does not fit, and taps in it add entries to the page's
// history (an iframe shares it), so the back button stays on the page. A link
// opens the demo full screen instead, where the swipe is a real touch.
const framed = ref(false);
onMounted(() => {
  qr.value = renderSVG(new URL(src.value, location.href).href, { border: 1 });
  framed.value = !matchMedia("(max-width: 640px)").matches;
});

const reload = ref(0);
const openDemo = () => location.assign(src.value);
</script>

<template>
  <div class="phone-demo">
    <!-- A full page load: the docs' router would take /demo/ for one of its pages. -->
    <a class="open" :href="src" @click.prevent="openDemo">
      {{ lang === "ko" ? "데모 열기" : "Open the demo" }}
    </a>
    <div class="phone">
      <iframe
        v-if="framed"
        :key="reload"
        :src="src"
        title="route-stack demo"
        loading="lazy"
      />
    </div>
    <div class="side">
      <div class="qr" v-html="qr" />
      <small>{{ lang === "ko" ? "휴대폰으로 열기" : "Open on a phone" }}</small>
      <button @click="reload++">
        {{ lang === "ko" ? "처음부터" : "Restart" }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.phone-demo {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  justify-content: center;
  margin: 16px 0;
}
.phone {
  width: 300px;
  height: 600px;
  padding: 10px;
  border-radius: 44px;
  background: #1c1c1e;
  box-shadow: 0 20px 50px rgb(0 0 0 / 0.25);
  flex: none;
}
iframe {
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: 34px;
  background: #f5f5f7;
}
.side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--vp-c-text-2);
}
.qr {
  width: 96px;
  height: 96px;
  padding: 4px;
  border-radius: 8px;
  background: #fff;
}
.qr :deep(svg) {
  width: 100%;
  height: 100%;
}
button {
  padding: 4px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
}
.open {
  display: none;
}
@media (max-width: 640px) {
  .side,
  .phone {
    display: none;
  }
  .open {
    display: inline-block;
    padding: 10px 20px;
    border-radius: 20px;
    background: var(--vp-c-brand-1);
    color: #fff;
    font-weight: 600;
    text-decoration: none;
  }
}
</style>
