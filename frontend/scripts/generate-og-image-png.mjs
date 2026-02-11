import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svgPath = path.join(__dirname, '..', 'public', 'og-image.svg');
const pngPath = path.join(__dirname, '..', 'public', 'og-image.png');

try {
  const svgBuffer = fs.readFileSync(svgPath);
  
  await sharp(svgBuffer)
    .resize(1200, 630)
    .png()
    .toFile(pngPath);
  
  console.log('✅ OGP画像（PNG）を生成しました:', pngPath);
} catch (error) {
  console.error('❌ エラー:', error.message);
  process.exit(1);
}

