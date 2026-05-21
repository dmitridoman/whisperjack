import fs from "node:fs";
import path from "node:path";
import { extractAudio, probeDurationSeconds } from "./ffmpeg";
import { resolveModel } from "./model";
import { runWhisper } from "./whisper";
import { tmpWavPath } from "./util";

export type TranscribeOptions = {
  model: string;
  language?: string;
  threads?: number;
  keepAudio?: boolean;
  verbose?: boolean;
};

export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
};

export type TranscriptResult = {
  input: string;
  model: string;
  language: string;
  duration_seconds: number;
  text: string;
  segments: TranscriptSegment[];
};

export async function transcribe(input: string, opts: TranscribeOptions): Promise<TranscriptResult> {
  const absInput = path.resolve(input);
  if (!fs.existsSync(absInput)) {
    throw new Error(`Input file not found: ${absInput}`);
  }

  const modelPath = await resolveModel(opts.model);

  const wavPath = opts.keepAudio
    ? path.join(path.dirname(absInput), `${path.basename(absInput, path.extname(absInput))}.whisperjack.wav`)
    : tmpWavPath();

  try {
    await extractAudio(absInput, wavPath, opts.verbose);
    const json = await runWhisper(wavPath, modelPath, {
      language: opts.language,
      threads: opts.threads,
      verbose: opts.verbose,
    });

    const segments: TranscriptSegment[] = json.transcription.map((s) => ({
      start: s.offsets.from / 1000,
      end: s.offsets.to / 1000,
      text: s.text.trim(),
    }));

    const text = segments.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim();
    const probed = await probeDurationSeconds(absInput);
    const lastEnd = segments.length > 0 ? segments[segments.length - 1]!.end : 0;
    const duration = probed ?? lastEnd;
    const language = opts.language || json.result?.language || json.params?.language || "unknown";

    return {
      input: absInput,
      model: opts.model,
      language,
      duration_seconds: Number(duration.toFixed(3)),
      text,
      segments,
    };
  } finally {
    if (!opts.keepAudio) {
      fs.rmSync(wavPath, { force: true });
    }
  }
}
