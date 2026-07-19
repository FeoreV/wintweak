import { execFileSync } from "node:child_process";

const output = execFileSync("rustc", ["-vV"], { encoding: "utf8" });
const host = output.match(/^host:\s+(.+)$/m)?.[1];

if (process.platform === "win32" && host !== "x86_64-pc-windows-msvc") {
  console.error(
    [
      `WinTweak AI requires the Rust MSVC host on Windows; current host is ${host ?? "unknown"}.`,
      "Put %USERPROFILE%\\.cargo\\bin before Chocolatey in PATH and use a Visual Studio Developer PowerShell.",
    ].join("\n"),
  );
  process.exit(1);
}
