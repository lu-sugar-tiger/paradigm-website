import { createHash } from "node:crypto";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRODUCT_IMAGE_HASH_PREFIX_LENGTH,
  PRODUCT_IMAGE_SHORT_EDGES,
  PRODUCT_IMAGE_WEBP_QUALITY
} from "./lib/product-images.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);

function loadSharp() {
  try {
    return require("sharp");
  } catch {
    throw new Error("The product-image generator requires Sharp. Install it locally or expose it through NODE_PATH before running this script.");
  }
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function parseBackground(value) {
  if (!value) return null;
  const match = String(value).match(/^#([0-9a-f]{6})$/i);
  if (!match) throw new Error("Image background must be a six-digit hex color such as #ffffff.");
  const hex = `#${match[1].toLowerCase()}`;
  return {
    hex,
    channels: [
      Number.parseInt(match[1].slice(0, 2), 16),
      Number.parseInt(match[1].slice(2, 4), 16),
      Number.parseInt(match[1].slice(4, 6), 16)
    ]
  };
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${argument}`);
    values.set(argument.slice(2), value);
    index += 1;
  }
  return values;
}

async function outputPathFor({ outputDir, outputHash, width, height }) {
  const shard = outputHash.slice(0, 2);
  const directory = path.join(outputDir, shard);
  await mkdir(directory, { recursive: true });

  for (let length = PRODUCT_IMAGE_HASH_PREFIX_LENGTH; length <= outputHash.length; length += 1) {
    const filename = `${outputHash.slice(0, length)}-${width}x${height}.webp`;
    const candidate = path.join(directory, filename);
    try {
      const existingHash = sha256(await readFile(candidate));
      if (existingHash === outputHash) return { absolutePath: candidate, reused: true };
    } catch (error) {
      if (error.code === "ENOENT") return { absolutePath: candidate, reused: false };
      throw error;
    }
  }
  throw new Error(`Unable to create a unique filename for ${outputHash}.`);
}

export async function generateProductImageDerivatives({
  inputPath,
  outputDir = path.join(ROOT, "assets", "images", "catalog"),
  opacity = 1,
  background = null
}) {
  const sharp = loadSharp();
  const input = await readFile(inputPath);
  const flatBackground = parseBackground(background);
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) throw new Error("Image opacity must be between 0 and 1.");
  if (opacity !== 1 && !flatBackground) throw new Error("Image opacity below 1 requires a flat background.");
  const sourceHash = sha256(input);
  const sourceMetadata = await sharp(input).metadata();
  const orientationSwapsAxes = [5, 6, 7, 8].includes(sourceMetadata.orientation);
  const orientedWidth = orientationSwapsAxes ? sourceMetadata.height : sourceMetadata.width;
  const orientedHeight = orientationSwapsAxes ? sourceMetadata.width : sourceMetadata.height;
  if (!orientedWidth || !orientedHeight) throw new Error(`Cannot determine image dimensions: ${inputPath}`);

  const derivatives = [];
  for (const shortEdge of PRODUCT_IMAGE_SHORT_EDGES) {
    const landscape = orientedWidth > orientedHeight;
    let resized = sharp(input)
      .rotate()
      .resize(landscape ? { height: shortEdge } : { width: shortEdge });

    if (flatBackground) {
      const raw = await resized.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      if (raw.info.channels !== 4) throw new Error(`Expected four RGBA channels after resize: ${inputPath}`);
      const flattened = Buffer.alloc(raw.info.width * raw.info.height * 3);
      for (let sourceIndex = 0, targetIndex = 0; sourceIndex < raw.data.length; sourceIndex += 4, targetIndex += 3) {
        const effectiveAlpha = (raw.data[sourceIndex + 3] / 255) * opacity;
        for (let channel = 0; channel < 3; channel += 1) {
          flattened[targetIndex + channel] = Math.round(
            raw.data[sourceIndex + channel] * effectiveAlpha
              + flatBackground.channels[channel] * (1 - effectiveAlpha)
          );
        }
      }
      resized = sharp(flattened, {
        raw: { width: raw.info.width, height: raw.info.height, channels: 3 }
      });
    }

    const output = await resized.webp({
        quality: PRODUCT_IMAGE_WEBP_QUALITY,
        lossless: false,
        smartSubsample: true,
        effort: 6
      })
      .toBuffer({ resolveWithObject: true });
    const outputHash = sha256(output.data);
    const destination = await outputPathFor({
      outputDir,
      outputHash,
      width: output.info.width,
      height: output.info.height
    });
    if (!destination.reused) await writeFile(destination.absolutePath, output.data, { flag: "wx" });
    const fileStats = await stat(destination.absolutePath);
    derivatives.push({
      shortEdge,
      width: output.info.width,
      height: output.info.height,
      path: path.relative(ROOT, destination.absolutePath).split(path.sep).join("/"),
      bytes: fileStats.size,
      sha256: outputHash
    });
  }

  return {
    source: {
      width: orientedWidth,
      height: orientedHeight,
      bytes: input.length,
      sha256: sourceHash
    },
    transform: {
      format: "webp",
      quality: PRODUCT_IMAGE_WEBP_QUALITY,
      resize: "short-edge",
      shortEdges: [...PRODUCT_IMAGE_SHORT_EDGES],
      ...(flatBackground ? { opacity, background: flatBackground.hex, flatten: true } : {})
    },
    derivatives
  };
}

async function updateCatalog(catalogPath, outputDir) {
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  let processed = 0;
  for (const product of catalog.products || []) {
    for (const image of product.images || []) {
      if (!image.localPath) continue;
      const inputPath = path.resolve(ROOT, image.localPath);
      await access(inputPath);
      const generated = await generateProductImageDerivatives({ inputPath, outputDir });
      image.sourceWidth = generated.source.width;
      image.sourceHeight = generated.source.height;
      image.sourceBytes = generated.source.bytes;
      image.sourceSha256 = generated.source.sha256;
      image.transform = generated.transform;
      image.derivatives = generated.derivatives;
      processed += 1;
    }
  }
  catalog.schemaVersion = Math.max(Number(catalog.schemaVersion) || 1, 2);
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  return { processed, catalogPath: path.relative(ROOT, catalogPath).split(path.sep).join("/") };
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const outputDir = path.resolve(ROOT, args.get("output-dir") || "assets/images/catalog");
  if (args.has("catalog")) {
    const result = await updateCatalog(path.resolve(ROOT, args.get("catalog")), outputDir);
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (!args.has("input")) throw new Error("Usage: node scripts/generate-product-images.mjs --input <file> [--output-dir <directory>] OR --catalog <json>");
  const opacity = args.has("opacity") ? Number(args.get("opacity")) : 1;
  const background = args.get("background") || null;
  const result = await generateProductImageDerivatives({ inputPath: path.resolve(args.get("input")), outputDir, opacity, background });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
