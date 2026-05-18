import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { checkBinary, formatSeconds } from "./util";
import { transcribe } from "./transcribe";
import { DEFAULT_MODEL, KNOWN_MODELS } from "./model";

const VERSION = "0.1.0";

const HELP = `
transcribe — turn any video or audio file into a Whisper transcript JSON

Usage:
  transcribe <input> [flags]

Examples:
  transcribe meeting.mp4
  transcribe lecture.m4a --model base.en
  transcribe podcast.mp3 --language en --output transcript.json
  transcribe video.mov --keep-audio --verbose

Flags:
  -o, --output <path>      where to write the JSON (default: <input>.json next to input)
  -m, --model <name>       whisper.cpp model name (default: ${DEFAULT_MODEL})
  -l, --language <code>    language hint, e.g. en, es (default: auto-detect)
  --threads <n>            whisper-cli thread count (default: physical cores)
  --keep-audio             keep the intermediate 16kHz WAV next to the input
  --verbose                stream ffmpeg + whisper-cli output live
  -h, --help               show this help
  -v, --version            print version

Models (downloaded on first use to ~/Library/Caches/transcribe/models/):
  ${KNOWN_MODELS.join(", ")}

Prerequisites:
  brew install ffmpeg whisper-cpp
`;

type CliOptions = {
  input: string;
  output: string;
  model: string;
  language?: string;
  threads?: number;
  keepAudio: boolean;
  verbose: boolean;
};

function parseCli(argv: string[]): CliOptions | { help: true } | { version: true } {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      output: { type: "string", short: "o" },
      model: { type: "string", short: "m" },
      language: { type: "string", short: "l" },
      threads: { type: "string" },
      "keep-audio": { type: "boolean" },
      verbose: { type: "boolean" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });

  if (values.help) return { help: true };
  if (values.version) return { version: true };

  const input = positionals[0];
  if (!input) {
    throw new Error("Missing input file. Run `transcribe --help` for usage.");
  }
  if (positionals.length > 1) {
    throw new Error(`Unexpected extra arguments: ${positionals.slice(1).join(" ")}`);
  }

  const model = values.model || DEFAULT_MODEL;

  let threads: number | undefined;
  if (values.threads !== undefined) {
    const n = Number.parseInt(values.threads, 10);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error(`--threads must be a positive integer, got "${values.threads}"`);
    }
    threads = n;
  }

  const inputAbs = path.resolve(input);
  const output =
    values.output ||
    path.join(
      path.dirname(inputAbs),
      `${path.basename(inputAbs, path.extname(inputAbs))}.json`
    );

  return {
    input: inputAbs,
    output: path.resolve(output),
    model,
    language: values.language,
    threads,
    keepAudio: Boolean(values["keep-audio"]),
    verbose: Boolean(values.verbose),
  };
}

async function preflight(): Promise<void> {
  const missing: string[] = [];
  const [hasFfmpeg, hasWhisper] = await Promise.all([
    checkBinary("ffmpeg"),
    checkBinary("whisper-cli"),
  ]);
  if (!hasFfmpeg) missing.push("ffmpeg");
  if (!hasWhisper) missing.push("whisper-cli");
  if (missing.length === 0) return;

  const map: Record<string, string> = {
    ffmpeg: "brew install ffmpeg",
    "whisper-cli": "brew install whisper-cpp",
  };
  const lines = missing.map((bin) => `  ${bin}: ${map[bin]}`).join("\n");
  throw new Error(`Missing required binaries on PATH:\n${lines}`);
}

async function main(): Promise<void> {
  let cli: CliOptions | { help: true } | { version: true };
  try {
    cli = parseCli(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    process.exit(1);
  }
  if ("help" in cli) {
    process.stdout.write(`${HELP.trim()}\n`);
    return;
  }
  if ("version" in cli) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }

  if (!fs.existsSync(cli.input)) {
    process.stderr.write(`Input file not found: ${cli.input}\n`);
    process.exit(1);
  }

  try {
    await preflight();
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    process.exit(1);
  }

  const threads = cli.threads ?? Math.max(1, os.cpus().length);

  try {
    const result = await transcribe(cli.input, {
      model: cli.model,
      language: cli.language,
      threads,
      keepAudio: cli.keepAudio,
      verbose: cli.verbose,
    });

    fs.mkdirSync(path.dirname(cli.output), { recursive: true });
    fs.writeFileSync(cli.output, `${JSON.stringify(result, null, 2)}\n`, "utf-8");

    process.stdout.write(
      `✓ wrote ${result.segments.length} segments (${formatSeconds(result.duration_seconds)}, ${result.language}) → ${cli.output}\n`
    );
  } catch (err) {
    process.stderr.write(`${(err as Error).message}\n`);
    process.exit(2);
  }
}

main();
