import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";

export function cacheDir(): string {
  const home = os.homedir();
  if (process.platform === "darwin") {
    return path.join(home, "Library", "Caches", "whisperjack");
  }
  const xdg = process.env.XDG_CACHE_HOME;
  return path.join(xdg && xdg.startsWith("/") ? xdg : path.join(home, ".cache"), "whisperjack");
}

export function modelsDir(): string {
  return path.join(cacheDir(), "models");
}

export function tmpWavPath(): string {
  const stamp = `${process.pid}-${randomBytes(4).toString("hex")}`;
  return path.join(os.tmpdir(), `whisperjack-${stamp}.wav`);
}

export function tmpWhisperOutPrefix(): string {
  const stamp = `${process.pid}-${randomBytes(4).toString("hex")}`;
  return path.join(os.tmpdir(), `whisperjack-${stamp}`);
}

export async function checkBinary(name: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("which", [name], { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

export type RunOptions = {
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
};

export async function runCommand(cmd: string, args: string[], opts: RunOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderrTail = "";
    child.stdout?.on("data", (data: Buffer) => {
      if (opts.onStdout) opts.onStdout(data.toString());
    });
    child.stderr?.on("data", (data: Buffer) => {
      const s = data.toString();
      stderrTail = (stderrTail + s).slice(-4000);
      if (opts.onStderr) opts.onStderr(s);
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        const tail = stderrTail.trim();
        reject(new Error(`${cmd} exited with code ${code}${tail ? `\n${tail}` : ""}`));
      }
    });
  });
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function formatSeconds(secs: number): string {
  if (!isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
