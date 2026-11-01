// Publishes route-stack with the npm CLI, then tags it and makes its GitHub
// release. Not `changeset publish`: in a pnpm workspace it publishes through
// pnpm, which does not do npm's trusted-publishing (OIDC) exchange (E404).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const dir = "packages/route-stack";
const { name, version } = JSON.parse(
  readFileSync(`${dir}/package.json`, "utf8"),
);
const tag = `${name}@${version}`;
const run = (command, args, options = {}) =>
  execFileSync(command, args, { stdio: "inherit", ...options });

const published = () => {
  try {
    return (
      execFileSync("npm", ["view", tag, "version"], {
        encoding: "utf8",
      }).trim() === version
    );
  } catch {
    return false; // E404: not on npm
  }
};

if (published()) {
  console.log(`${tag} is on npm already.`);
  process.exit(0);
}

run("npm", ["publish", "--provenance", "--access", "public"], { cwd: dir });

// This version's section of the changelog, as the release notes.
const notes =
  readFileSync(`${dir}/CHANGELOG.md`, "utf8")
    .split(/^## /m)
    .find((section) => section.startsWith(`${version}\n`))
    ?.slice(version.length)
    .trim() ?? "";
run("git", ["tag", tag]);
run("git", ["push", "origin", tag]);
run("gh", ["release", "create", tag, "--title", tag, "--notes", notes]);
