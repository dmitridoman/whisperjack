import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { modelsDir, formatBytes } from "./util";

const MODEL_BASE_URL = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";

export const DEFAULT_MODEL = "large-v3-turbo-q5_0";

export const KNOWN_MODELS = [
  "tiny",
  "tiny.en",
  "tiny-q5_1",
  "tiny.en-q5_1",
  "base",
  "base.en",
  "base-q5_1",
  "base.en-q5_1",
  "small",
  "small.en",
  "small-q5_1",
  "small.en-q5_1",
  "medium",
  "medium.en",
  "medium-q5_0",
  "medium.en-q5_0",
  "large-v1",
  "large-v2",
  "large-v2-q5_0",
  "large-v3",
  "large-v3-q5_0",
  "large-v3-turbo",
  "large-v3-turbo-q5_0",
  "large-v3-turbo-q8_0",
] as const;

export type KnownModel = (typeof KNOWN_MODELS)[number];

export function isKnownModel(name: string): name is KnownModel {
  return (KNOWN_MODELS as readonly string[]).includes(name);
}

export function modelPath(name: string): string {
  return path.join(modelsDir(), `ggml-${name}.bin`);
}

export async function resolveModel(name: string): Promise<string> {
  if (!isKnownModel(name)) {
    throw new Error(
      `Unknown model "${name}". Known models:\n  ${KNOWN_MODELS.join(", ")}`
    );
  }
  const dest = modelPath(name);
  if (fs.existsSync(dest)) return dest;

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const url = `${MODEL_BASE_URL}/ggml-${name}.bin`;
  const partial = `${dest}.part`;

  process.stderr.write(`Downloading model "${name}" → ${dest}\n`);

  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download model from ${url}: ${res.status} ${res.statusText}`);
  }
  const totalRaw = res.headers.get("content-length");
  const total = totalRaw ? Number.parseInt(totalRaw, 10) : 0;

  let downloaded = 0;
  let lastLogged = 0;
  const sink = fs.createWriteStream(partial);

  const reader = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
  reader.on("data", (chunk: Buffer) => {
    downloaded += chunk.length;
    const now = Date.now();
    if (now - lastLogged > 500) {
      lastLogged = now;
      const pct = total ? ((downloaded / total) * 100).toFixed(1) : "?";
      const of = total ? ` / ${formatBytes(total)}` : "";
      process.stderr.write(`\r  ${formatBytes(downloaded)}${of} (${pct}%)   `);
    }
  });

  try {
    await pipeline(reader, sink);
  } catch (err) {
    fs.rmSync(partial, { force: true });
    throw err;
  }
  process.stderr.write(`\r  ${formatBytes(downloaded)} done.${" ".repeat(20)}\n`);
  fs.renameSync(partial, dest);
  return dest;
}
