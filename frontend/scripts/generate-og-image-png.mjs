import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svgPath = path.join(__dirname, '..', 'public', 'og-image.svg');
const pngPath = path.join(__dirname, '..', 'public', 'og-image.png');
const pngV2Path = path.join(__dirname, '..', 'public', 'og-image-v2.png');

try {
  // 既存のPNGファイルがある場合はコピーして終了
  if (fs.existsSync(pngPath)) {
    if (!fs.existsSync(pngV2Path)) {
      fs.copyFileSync(pngPath, pngV2Path);
      console.log('✅ og-image-v2.pngを生成しました（既存PNGからコピー）');
    }
    console.log('✅ OGP画像（PNG）は既に存在します');
    process.exit(0);
  }

  // SVGからPNGを生成
  if (fs.existsSync(svgPath)) {
    const svgBuffer = fs.readFileSync(svgPath);
    
    await sharp(svgBuffer)
      .resize(1200, 630)
      .png()
      .toFile(pngPath);
    
    // v2も生成
    fs.copyFileSync(pngPath, pngV2Path);
    
    console.log('✅ OGP画像（PNG）を生成しました:', pngPath);
  } else {
    console.warn('⚠️ SVGファイルが見つかりません。既存のPNGを使用します。');
    process.exit(0);
  }
} catch (error) {
  console.error('❌ エラー:', error.message);
  // ビルドを続行するため、エラーでも終了しない
  console.warn('⚠️ OGP画像生成に失敗しましたが、ビルドを続行します。');
  process.exit(0);
}

