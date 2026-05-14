import { spawn } from "child_process";
import { ffmpegPath } from "./ffmpegConfig.js";

/**
 * Converts WebM/Opus (from browser) → WAV (16kHz PCM) using ffmpeg.
 * @param {string} base64Webm - data URI string "data:audio/webm;codecs=opus;base64,..."
 * @returns {Promise<Buffer>} - WAV audio buffer
 */
export async function convertWebmToWav(base64Webm) {
    const base64Marker = "base64,";
    const idx = base64Webm.indexOf(base64Marker);
    if (idx === -1) throw new Error("Invalid audio base64 payload");

    const b64 = base64Webm.slice(idx + base64Marker.length);
    const webmBuffer = Buffer.from(b64, "base64");

    return new Promise((resolve, reject) => {
        const ffmpeg = spawn(ffmpegPath, [
            "-hide_banner",
            "-loglevel", "error",
            "-i", "pipe:0",
            "-ar", "16000",     // resample 16 kHz
            "-ac", "1",         // mono
            "-f", "wav",
            "pipe:1"
        ]);

        let wavBuffer = Buffer.alloc(0);
        ffmpeg.stdout.on("data", (d) => (wavBuffer = Buffer.concat([wavBuffer, d])));
        ffmpeg.stderr.on("data", (d) => console.error("[FFMPEG]", d.toString()));
        ffmpeg.on("close", (code) => {
            if (code === 0 && wavBuffer.length > 0) resolve(wavBuffer);
            else reject(new Error(`ffmpeg exited with code ${code}`));
        });

        ffmpeg.stdin.write(webmBuffer);
        ffmpeg.stdin.end();
    });
}
