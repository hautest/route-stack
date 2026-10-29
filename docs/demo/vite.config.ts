import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Built into the docs' public folder, served at <docs base>demo/.
export default defineConfig({
  base: `${process.env.DOCS_BASE ?? "/"}demo/`,
  plugins: [react()],
  build: { outDir: "../public/demo", emptyOutDir: true },
});
