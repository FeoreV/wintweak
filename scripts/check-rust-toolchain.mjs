import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

if (process.platform === "win32" && process.env.USERPROFILE) {
  const cargoBin = path.join(process.env.USERPROFILE, ".cargo", "bin");
  process.env.PATH = `${cargoBin};${process.env.PATH}`;
}

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

const args = process.argv.slice(2);
if (args.length > 0) {
  const command = args[0];
  const commandArgs = args.slice(1);
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  process.exit(result.status ?? 0);
}
