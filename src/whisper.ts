import fs from "node:fs";
import { runCommand, tmpWhisperOutPrefix } from "./util";

export type WhisperSegment = {
  timestamps: { from: string; to: string };
  offsets: { from: number; to: number };
  text: string;
};

export type WhisperJson = {
  systeminfo?: string;
  model?: { type?: string; multilingual?: boolean };
  params?: { model?: string; language?: string };
  result?: { language?: string };
  transcription: WhisperSegment[];
};

export type WhisperOptions = {
  language?: string;
  threads?: number;
  verbose?: boolean;
};

export async function runWhisper(
  wavPath: string,
  modelPath: string,
  opts: WhisperOptions = {}
): Promise<WhisperJson> {
  const outPrefix = tmpWhisperOutPrefix();
  const args = ["-m", modelPath, "-f", wavPath, "-oj", "-of", outPrefix];
  if (opts.language) args.push("-l", opts.language);
  if (typeof opts.threads === "number" && opts.threads > 0) args.push("-t", String(opts.threads));

  try {
    await runCommand("whisper-cli", args, {
      onStderr: opts.verbose ? (chunk) => process.stderr.write(chunk) : undefined,
    });
    const jsonPath = `${outPrefix}.json`;
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`whisper-cli did not produce expected JSON output at ${jsonPath}`);
    }
    const raw = fs.readFileSync(jsonPath, "utf-8");
    const parsed = JSON.parse(raw) as WhisperJson;
    if (!Array.isArray(parsed.transcription)) {
      throw new Error(`Unexpected whisper-cli JSON shape (missing transcription[])`);
    }
    return parsed;
  } finally {
    fs.rmSync(`${outPrefix}.json`, { force: true });
  }
}
