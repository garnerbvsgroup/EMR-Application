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

const steps = [
  ["--workspace", "@redwood/shared", "run", "build"],
  ["--workspace", "@redwood/server", "run", "build"],
  ["--workspace", "@redwood/client", "run", "build"],
  ["run", "build:desktop-assets"],
];

for (const args of steps) {
  await new Promise((resolve, reject) => {
    const child = spawnNpm(args);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }
      reject(new Error(`npm ${args.join(" ")} failed with code ${code}`));
    });
  });
}
