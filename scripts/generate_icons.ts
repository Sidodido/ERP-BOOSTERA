import fs from "fs";
import path from "path";
import sharp from "sharp";

async function generateIcons() {
  const logoPath = path.resolve("public/logo.png");
  const logoBuffer = fs.readFileSync(logoPath);

  // 1. Generate PNG variants
  const sizes = [16, 32, 48, 64, 128, 180, 192, 256, 512];
  const pngBuffers: Record<number, Buffer> = {};

  for (const size of sizes) {
    pngBuffers[size] = await sharp(logoBuffer)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
  }

  // Save standard sizes
  fs.writeFileSync("public/icon-192.png", pngBuffers[192]);
  fs.writeFileSync("public/icon-512.png", pngBuffers[512]);
  fs.writeFileSync("public/apple-icon.png", pngBuffers[180]);
  fs.writeFileSync("src/app/apple-icon.png", pngBuffers[180]);
  fs.writeFileSync("public/icon.png", pngBuffers[512]);
  fs.writeFileSync("src/app/icon.png", pngBuffers[512]);

  // 2. Build multi-resolution ICO file (16, 32, 48, 64, 128, 256)
  const icoSizes = [16, 32, 48, 64, 128, 256];
  const count = icoSizes.length;

  const headerLength = 6;
  const entryLength = 16;
  const entriesTotalLength = count * entryLength;
  let currentOffset = headerLength + entriesTotalLength;

  const header = Buffer.alloc(headerLength);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = ICO
  header.writeUInt16LE(count, 4); // count

  const entryBuffers: Buffer[] = [];
  const imageBuffers: Buffer[] = [];

  for (const size of icoSizes) {
    const imgBuf = pngBuffers[size];
    imageBuffers.push(imgBuf);

    const entry = Buffer.alloc(entryLength);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // color count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // planes
    entry.writeUInt16LE(32, 6); // bit count
    entry.writeUInt32LE(imgBuf.length, 8); // bytes in resource
    entry.writeUInt32LE(currentOffset, 12); // image offset

    entryBuffers.push(entry);
    currentOffset += imgBuf.length;
  }

  const finalIcoBuffer = Buffer.concat([header, ...entryBuffers, ...imageBuffers]);

  fs.writeFileSync("public/favicon.ico", finalIcoBuffer);
  fs.writeFileSync("src/app/favicon.ico", finalIcoBuffer);

  console.log("Successfully generated all icons and favicon.ico from BOOSTERA logo!");
}

generateIcons().catch(console.error);
