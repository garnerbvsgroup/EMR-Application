import { mkdirSync, rmSync, cpSync } from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const workspaceRoot = process.cwd();
const desktopRuntimePath = path.join(workspaceRoot, "apps", "desktop", "runtime");
const desktopServerPath = path.join(desktopRuntimePath, "server");
const desktopClientPath = path.join(desktopRuntimePath, "client");
const clientDistPath = path.join(workspaceRoot, "apps", "client", "dist");
const serverEntryPath = path.join(workspaceRoot, "apps", "server", "src", "index.ts");
const serverOutfilePath = path.join(desktopServerPath, "index.cjs");

rmSync(desktopRuntimePath, { recursive: true, force: true });
mkdirSync(desktopServerPath, { recursive: true });
mkdirSync(desktopClientPath, { recursive: true });

cpSync(clientDistPath, desktopClientPath, { recursive: true });

await build({
  entryPoints: [serverEntryPath],
  outfile: serverOutfilePath,
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node20",
  sourcemap: false,
  logLevel: "info",
  logOverride: {
    "empty-import-meta": "silent",
  },
});