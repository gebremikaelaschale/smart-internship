import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

const IMAGES_DIR = path.join(process.cwd(), 'public', 'images');

async function listImages(dir) {
  const files = await fs.readdir(dir);
  return files.filter((f) => /\.(jpe?g|png)$/i.test(f)).map((f) => path.join(dir, f));
}

async function enhanceImage(filePath) {
  const tmp = `${filePath}.tmp`;
  try {
    await sharp(filePath)
      .sharpen() // sharpen to improve clarity
      .modulate({ brightness: 1.12, saturation: 1.04 }) // brighten and slightly increase saturation
      .linear(1.03, 0) // small contrast bump
      .toFile(tmp);
    await fs.rename(tmp, filePath);
    console.log('Enhanced', path.basename(filePath));
  } catch (err) {
    console.error('Failed', path.basename(filePath), err.message);
    try {
      await fs.unlink(tmp);
    } catch (e) {}
  }
}

async function run() {
  try {
    const images = await listImages(IMAGES_DIR);
    if (!images.length) {
      console.log('No images found in', IMAGES_DIR);
      return;
    }
    console.log(`Found ${images.length} images — enhancing in-place.`);
    for (const img of images) {
      await enhanceImage(img);
    }
    console.log('All done.');
  } catch (err) {
    console.error('Optimizer failed', err);
  }
}

run();
