import { createRequire } from "module";

const require = createRequire(import.meta.url);

// Use fluent-ffmpeg with bundled ffmpeg binary
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");

let ffprobeInstaller = null;
try {
    ffprobeInstaller = require("@ffprobe-installer/ffprobe");
} catch {
    // optional; if not installed we fall back to system ffprobe
}

if (ffmpegInstaller?.path) {
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);
}

if (ffprobeInstaller?.path) {
    ffmpeg.setFfprobePath(ffprobeInstaller.path);
}

export const ffmpegPath = ffmpegInstaller?.path || "ffmpeg";
export const ffprobePath = ffprobeInstaller?.path || "ffprobe";
export { ffmpeg };
