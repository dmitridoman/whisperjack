# transcribe

One command. Takes any video or audio file (mp4, mov, mkv, mp3, m4a, wav, flac, …), runs it through [whisper.cpp](https://github.com/ggerganov/whisper.cpp), and writes a JSON transcript with per-segment timestamps. Metal-accelerated on Apple Silicon.

## Prerequisites

```bash
brew install ffmpeg whisper-cpp
```

That's it — no Python, no PyTorch, no GPU drivers. The Whisper model itself is downloaded automatically on first use.

## Usage

No install — run straight from npm:

```bash
# default: large-v3-turbo-q5_0 (multilingual, near-SOTA, fast)
npx transcribe meeting.mp4

# pick a smaller / English-only model
npx transcribe lecture.m4a --model base.en

# control language hint + output path
npx transcribe podcast.mp3 --language en --output transcript.json

# keep the intermediate 16kHz WAV and stream raw whisper-cli output
npx transcribe video.mov --keep-audio --verbose
```

Or install globally:

```bash
npm i -g transcribe
transcribe meeting.mp4
```

## Output

A JSON file written next to the input (or to `--output`):

```json
{
  "input": "/abs/path/to/meeting.mp4",
  "model": "large-v3-turbo-q5_0",
  "language": "en",
  "duration_seconds": 312.48,
  "text": "Okay so today we're going to walk through the new pricing model. …",
  "segments": [
    { "start": 0.0,  "end": 3.24, "text": "Okay so today we're going to walk through the new pricing model." },
    { "start": 3.24, "end": 7.10, "text": "I want to start with the assumptions before we touch any numbers." }
  ]
}
```

`segments[].start` / `end` are seconds. `text` is the joined transcript with whitespace normalized.

## Flags

| Flag | Default | Notes |
| --- | --- | --- |
| `-o, --output <path>` | `<input>.json` next to input | where to write the JSON |
| `-m, --model <name>` | `large-v3-turbo-q5_0` | see model table below |
| `-l, --language <code>` | auto-detect | `en`, `es`, `fr`, etc. — speeds things up if you know it |
| `--threads <n>` | physical core count | passed to `whisper-cli -t` |
| `--keep-audio` | off | leaves the intermediate 16kHz mono WAV next to the input |
| `--verbose` | off | streams ffmpeg + whisper-cli output live to stderr |
| `-h, --help` | | usage |
| `-v, --version` | | print version |

## Models

Downloaded on first use to `~/Library/Caches/transcribe/models/` (macOS) or `~/.cache/transcribe/models/` (Linux). Cached forever after.

| Model | Size | Notes |
| --- | --- | --- |
| `tiny.en` / `tiny` | ~75 MB | fastest, lowest accuracy |
| `base.en` / `base` | ~150 MB | good for quick English transcripts |
| `small.en` / `small` | ~500 MB | balanced |
| `medium.en` / `medium` | ~1.5 GB | high accuracy, slower |
| `large-v3-turbo-q5_0` ⭐ | ~870 MB | **default** — near-SOTA, multilingual, fast on Apple Silicon |
| `large-v3` | ~3 GB | highest accuracy, slowest, multilingual |

Run `transcribe --help` for the full list of known models. Anything else is rejected to keep downloads scoped to known whisper.cpp artifacts.

## How it works

1. `ffmpeg` extracts a 16 kHz mono PCM WAV from the input.
2. `whisper-cli` runs the chosen model against the WAV with `-oj` (JSON output).
3. The raw whisper.cpp JSON is normalized into the simple shape above.
4. The intermediate WAV is deleted (unless `--keep-audio`).

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | success |
| `1` | user error — missing file, bad flag, missing `ffmpeg` / `whisper-cli` |
| `2` | runtime error — ffmpeg or whisper-cli failed |

## License

MIT
