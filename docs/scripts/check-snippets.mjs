// Type-checks the code blocks marked `check` in the English pages (the Korean
// ones carry the same code), against the built library and the routers.
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";

const docs = new URL("..", import.meta.url).pathname;
const out = join(docs, ".snippets");
rmSync(out, { recursive: true, force: true });
mkdirSync(out);

const pages = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory())
      return [
        "ko",
        "demo",
        "node_modules",
        ".vitepress",
        ".snippets",
        "public",
      ].includes(entry.name)
        ? []
        : pages(path);
    return entry.name.endsWith(".md") ? [path] : [];
  });

let count = 0;
for (const page of pages(docs)) {
  const text = readFileSync(page, "utf8");
  for (const [, lang, code] of text.matchAll(
    /^```(tsx?)\b[^\n]*\bcheck\b[^\n]*\n([\s\S]*?)^```/gm,
  )) {
    const name = `${relative(docs, page).replace(/[/.]/g, "_")}_${count++}.${lang}`;
    // Each snippet is its own module.
    writeFileSync(join(out, name), `${code}\nexport {};\n`);
  }
}

writeFileSync(
  join(out, "tsconfig.json"),
  JSON.stringify({
    compilerOptions: {
      target: "es2023",
      lib: ["ES2023", "DOM"],
      module: "esnext",
      moduleResolution: "bundler",
      jsx: "react-jsx",
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      types: [],
    },
    include: ["*.ts", "*.tsx"],
  }),
);

execFileSync("tsc", ["-p", join(out, "tsconfig.json")], {
  stdio: "inherit",
  cwd: docs,
});
console.log(`${count} snippets type-check.`);
