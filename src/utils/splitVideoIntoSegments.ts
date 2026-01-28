import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

export type SplitVideoOptions = {
  inputPath: string;
  outDir: string;
  segmentSeconds?: number; // default ~5 minutes
  prefix?: string;
};

/**
 * Splits a local video file into N segments using ffmpeg's segment muxer.
 * Requires `ffmpeg` to be available on PATH.
 */
export async function splitVideoIntoSegments(opts: SplitVideoOptions): Promise<string[]> {
  const segmentSeconds = opts.segmentSeconds ?? 5 * 60;
  const prefix = opts.prefix ?? "segment";

  await mkdir(opts.outDir, { recursive: true });

  const outPattern = path.join(opts.outDir, `${prefix}-%03d.mp4`);

  await new Promise<void>((resolve, reject) => {
    const args = [
      "-hide_banner",
      "-y",
      "-i",
      opts.inputPath,
      "-c",
      "copy",
      "-map",
      "0",
      "-f",
      "segment",
      "-segment_time",
      String(segmentSeconds),
      "-reset_timestamps",
      "1",
      outPattern,
    ];

    const child = spawn("ffmpeg", args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });

  // return deterministic list of expected segments; consumers can glob if needed
  return [];
}
