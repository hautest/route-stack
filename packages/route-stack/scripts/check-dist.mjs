// Bundleless output keeps import paths as written: an import of a folder
// ("./polyfill") would point at a file that doesn't exist. Fails the build if a
// relative import in dist doesn't resolve.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const files = readdirSync("dist", { recursive: true })
  .map((f) => join("dist", f))
  .filter((f) => f.endsWith(".js") || f.endsWith(".d.ts"));
const missing = files.flatMap((file) =>
  [...readFileSync(file, "utf8").matchAll(/from "(\.{1,2}\/[^"]+)"/g)]
    .map((m) => m[1])
    .filter((spec) => !existsSync(join(dirname(file), spec)))
    .map((spec) => `${file}: ${spec}`),
);
if (missing.length) {
  console.error(`Unresolved imports in dist:\n${missing.join("\n")}`);
  process.exit(1);
}

// React client modules must start with the directive, or Next treats them as
// server code, and use the automatic JSX runtime: the classic one needs React
// in scope.
const client = [
  "stack/Stack.js",
  "adapters/next.js",
  "adapters/react-router.js",
  "adapters/tanstack-router.js",
].filter((f) => {
  const code = readFileSync(join("dist", f), "utf8");
  return (
    !code.startsWith('"use client"') || code.includes("React.createElement")
  );
});
if (client.length) {
  console.error(
    `Not a client module with the automatic JSX runtime: ${client.join(", ")}`,
  );
  process.exit(1);
}
