import { runCommand } from "./util";

export async function extractAudio(input: string, outputWav: string, verbose = false): Promise<void> {
  const args = [
    "-y",
    "-hide_banner",
    "-loglevel",
    verbose ? "info" : "error",
    "-i",
    input,
    "-vn",
    "-ar",
    "16000",
    "-ac",
    "1",
    "-c:a",
    "pcm_s16le",
    outputWav,
  ];
  await runCommand("ffmpeg", args, {
    onStderr: verbose ? (chunk) => process.stderr.write(chunk) : undefined,
  });
}

export async function probeDurationSeconds(input: string): Promise<number | null> {
  return new Promise((resolve) => {
    let stdout = "";
    const args = [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      input,
    ];
    runCommand("ffprobe", args, { onStdout: (chunk) => (stdout += chunk) })
      .then(() => {
        const n = Number.parseFloat(stdout.trim());
        resolve(Number.isFinite(n) ? n : null);
      })
      .catch(() => resolve(null));
  });
}
