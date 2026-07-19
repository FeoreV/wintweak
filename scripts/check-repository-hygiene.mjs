import { execFileSync } from "node:child_process";

const forbiddenPaths = [
  ".ag-kit-backups/",
  ".agents/",
  ".codex/",
  ".aider/",
  ".claude/",
  ".continue/",
  ".cursor/",
  ".github-copilot/",
  ".roo/",
  ".windsurf/",
  "node_modules/",
  "dist/",
  "coverage/",
  "test-results/",
  "playwright-report/",
  "blob-report/",
];

const trackedFiles = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);
const violations = trackedFiles.filter(
  (file) =>
    forbiddenPaths.some((path) => file.startsWith(path)) ||
    /^src-tauri\/target(?:-|\/)/.test(file) ||
    /(?:\.tsbuildinfo|\.bak|\.orig|\.rej|\.sw[op]|\.tmp)$/.test(file),
);

if (violations.length > 0) {
  console.error("Repository hygiene check failed. Remove generated or local files from Git:");
  violations.forEach((file) => console.error(`  ${file}`));
  process.exit(1);
}
