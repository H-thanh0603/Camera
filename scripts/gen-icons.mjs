/** Sinh PWA icons từ SVG (chạy 1 lần, commit PNG vào public/icons). */
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const svg = (size, pad = 0) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
<rect width="512" height="512" rx="112" fill="#10141a"/>
<rect x="14" y="14" width="484" height="484" rx="100" fill="none" stroke="#f2ca50" stroke-width="10" opacity="0.55"/>
<text x="256" y="342" text-anchor="middle" font-family="Georgia,serif" font-size="280" font-weight="bold" fill="#f2ca50">L</text>
<circle cx="256" cy="408" r="10" fill="#f2ca50"/>
</svg>`;

mkdirSync("public/icons", { recursive: true });
const jobs = [
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["public/icons/apple-touch-icon.png", 180],
];
for (const [out, size] of jobs) {
  await sharp(Buffer.from(svg())).resize(size, size).png().toFile(out);
  console.log("wrote", out);
}
// Maskable: padding 20% nền đủ bleed
await sharp({
  create: { width: 512, height: 512, channels: 4, background: "#10141a" },
})
  .composite([{ input: Buffer.from(svg()), top: 52, left: 52 }])
  .resize(512, 512)
  .png()
  .toFile("public/icons/maskable-512.png")
  .then(() => console.log("wrote public/icons/maskable-512.png"));
