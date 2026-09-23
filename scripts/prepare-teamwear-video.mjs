import { spawn, execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const config = JSON.parse(await readFile(path.join(root, "data/teamwear-video.json"), "utf8"));
const option = (key, fallback) => process.argv.includes(key) ? process.argv[process.argv.indexOf(key) + 1] : fallback;
const ffmpeg = option("--ffmpeg", process.env.FFMPEG_PATH || "ffmpeg");
const ffprobe = option("--ffprobe", path.join(path.dirname(ffmpeg), process.platform === "win32" ? "ffprobe.exe" : "ffprobe"));
const absolute = (file) => path.join(root, file);
const probe = (file) => JSON.parse(execFileSync(ffprobe, ["-v", "error", "-show_streams", "-show_format", "-of", "json", absolute(file)], { encoding: "utf8" }));
const hash = async (file) => {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(absolute(file))) digest.update(chunk);
  return digest.digest("hex");
};
async function run(args) {
  await new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, ["-hide_banner", "-loglevel", "warning", "-stats", "-y", "-filter_complex_threads", "2", ...args], { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg failed: ${code}`)));
  });
}

const input = probe(config.source);
const video = input.streams.find((stream) => stream.codec_type === "video");
if (video.width !== 1080 || video.height !== 1920) throw new Error("Recheck crops for a source other than 1080×1920.");
const [num, den] = video.r_frame_rate.split("/").map(Number);
const fps = num / den;
const totalFrames = Number(video.nb_frames) || Math.round(Number(video.duration || input.format.duration) * fps);
const tokens = await readFile(absolute("assets/css/tokens.css"), "utf8");
const durationMs = Number(tokens.match(new RegExp(`${config.transition.durationToken}:\\s*(\\d+)ms`))?.[1]);
if (!durationMs) throw new Error("Missing shared image duration token");
const overlapFrames = Math.round(durationMs / 1000 * fps);
const duration = overlapFrames / fps;
if (totalFrames <= overlapFrames * 2) throw new Error("Video is too short for the selected transition");
const master = absolute(config.master.path);
await mkdir(path.dirname(master), { recursive: true });
await mkdir(absolute("assets/videos/teamwear"), { recursive: true });
const metadata = ["-color_primaries", video.color_primaries || "bt709", "-color_trc", video.color_transfer || "bt709", "-colorspace", video.color_space || "bt709", "-color_range", video.color_range || "tv"];

if (!process.argv.includes("--reuse-master")) {
  // Tail/head overlap is inside the asset; its file seam is consecutive source frames.
  // A smooth sine envelope and broad edge glow avoid a full-frame white flash.
  const envelope = `pow(sin(PI*N/${overlapFrames - 1}),2)`;
  const glow = `(${config.transition.peakOpacity}*${envelope}*(0.25+0.75*exp(-4*pow(X/W-0.2,2))))`;
  const colors = config.transition.warmRGB;
  const channels = ["r", "g", "b"].map((channel, index) => `${channel}='${channel}(X,Y)*(1-${glow})+${colors[index]}*${glow}'`).join(":");
  const graph = [
    `[0:v]fps=${num}/${den},settb=AVTB,zscale=w=2160:h=3840:filter=spline36:matrixin=${video.color_space || "709"}:transferin=${video.color_transfer || "709"}:primariesin=${video.color_primaries || "709"}:rangein=${video.color_range || "limited"}:matrix=gbr:transfer=709:primaries=709:range=full,setsar=1,format=gbrp,split=3[bodyin][tailin][headin]`,
    `[bodyin]trim=start_frame=${overlapFrames}:end_frame=${totalFrames - overlapFrames},setpts=PTS-STARTPTS[body]`,
    `[tailin]trim=start_frame=${totalFrames - overlapFrames}:end_frame=${totalFrames},setpts=PTS-STARTPTS[tail]`,
    `[headin]trim=end_frame=${overlapFrames},setpts=PTS-STARTPTS[head]`,
    `[tail][head]blend=all_expr='A*(1-min(1,(N-1)/${overlapFrames - 1}))+B*min(1,(N-1)/${overlapFrames - 1})':shortest=1,geq=${channels}[join]`,
    `[body][join]concat=n=2:v=1:a=0,zscale=matrixin=gbr:transferin=709:primariesin=709:rangein=full:matrix=709:transfer=709:primaries=709:range=limited,format=yuv444p[out]`
  ].join(";");
  console.log(`Master: Spline36 2160×3840; ${overlapFrames} transition frames (${duration}s).`);
  await run(["-i", absolute(config.source), "-filter_complex", graph, "-map", "[out]", "-an", "-c:v", "ffv1", "-level", "3", "-threads", "4", ...metadata, master]);
}
const masterProbe = probe(config.master.path).streams.find((stream) => stream.codec_type === "video");
if (masterProbe.width !== 2160 || masterProbe.height !== 3840 || masterProbe.codec_name !== "ffv1") throw new Error("Invalid shared lossless master");
const outputs = [];
for (const variant of config.variants) {
  const cropY = Math.round((variant.scaledHeight - variant.height) * config.transition.cropFocusY / 2) * 2;
  const filter = `zscale=w=${variant.width}:h=${variant.scaledHeight}:filter=lanczos:param_a=3,crop=${variant.width}:${variant.height}:0:${cropY},setsar=1,format=yuv420p`;
  console.log(`Export ${variant.id}: ${variant.width}×${variant.scaledHeight} → ${variant.width}×${variant.height}, crop Y=${cropY}`);
  await run(["-i", master, "-vf", filter, "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "22", "-threads", "4", "-g", String(Math.round(fps * 2)), "-movflags", "+faststart", ...metadata, absolute(variant.src)]);
  await run(["-i", absolute(variant.src), "-frames:v", "1", "-c:v", "libwebp", "-quality", "88", absolute(variant.poster)]);
  outputs.push({ ...variant, cropY, bytes: (await stat(absolute(variant.src))).size, sha256: await hash(variant.src), streams: probe(variant.src).streams.map(({ codec_name, codec_type, width, height, duration, nb_frames }) => ({ codec_name, codec_type, width, height, duration, nb_frames })) });
}
await writeFile(absolute("assets/videos/teamwear/manifest.json"), JSON.stringify({ source: config.source, sourceSha256: await hash(config.source), master: config.master, masterSha256: await hash(config.master.path), fps: video.r_frame_rate, sourceFrames: totalFrames, overlapFrames, durationToken: config.transition.durationToken, durationMs, outputs }, null, 2) + "\n");
console.log("Hero video exports and manifest complete.");
