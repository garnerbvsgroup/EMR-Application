import { spawn } from "node:child_process";

function quoteArgument(argument) {
  return argument.includes(" ") ? `"${argument}"` : argument;
}

function spawnNpm(args) {
  if (process.platform === "win32") {
    const commandLine = ["npm.cmd", ...args].map(quoteArgument).join(" ");
    return spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", commandLine], { stdio: "inherit" });
  }

  return spawn("npm", args, { stdio: "inherit" });
}

const server = spawnNpm(["--workspace", "@redwood/server", "run", "dev"]);

const client = spawnNpm(["--workspace", "@redwood/client", "run", "dev"]);

const children = [server, client];

function shutdown() {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await new Promise((_resolve, reject) => {
  for (const child of children) {
    child.on("exit", (code) => {
      if (code && code !== 0) {
        reject(new Error(`Child process exited with code ${code}`));
      }
    });
  }
});
