import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Offline flattening only: the landing page never applies these legacy filters.
// Uses existing tooling via NODE_PATH; no new website dependency.
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const sharp = require("sharp");
const root = fileURLToPath(new URL("../", import.meta.url));
const { models } = JSON.parse(await readFile(path.join(root, "data/teamwear-options.json"), "utf8"));
const { colors } = JSON.parse(await readFile(path.join(root, "data/colors.json"), "utf8"));
const model = models[0];
const output = path.join(root, "assets/images/teamwear/rail");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
  for (const pattern of model.patterns) {
    const source = (await readFile(path.join(root, pattern.preview))).toString("base64");
    for (const option of model.colors) {
      const color = colors.find((entry) => entry.id === option.colorId);
      await page.setContent(`<style>
        html,body{margin:0;width:1080px;height:1080px;background:#fff}
        .product{position:absolute;left:270px;top:0;width:540px;height:1080px;overflow:hidden;isolation:isolate}
        img{display:block;width:1080px;height:1080px;filter:grayscale(1) contrast(${color.id === "black" ? 1.15 : 1.04})}
        .product::after{content:"";position:absolute;inset:0;background:${color.value};mix-blend-mode:color;opacity:.94}
      </style><div class="product"><img src="data:image/webp;base64,${source}"></div>`);
      await page.locator("img").evaluate((image) => image.decode());
      const filename = `${pattern.id.toLowerCase()}-${color.id}.webp`;
      await sharp(await page.screenshot()).webp({ quality: 92 }).toFile(path.join(output, filename));
      console.log(filename);
    }
  }
} finally {
  await browser.close();
}
await sharp(path.join(root, "assets/images/teamwear/campaign/fabric-macro.webp"))
  .resize(1200, 1200, { fit: "cover", position: "centre" })
  .webp({ quality: 92 }).toFile(path.join(output, "fabric-square.webp"));
