let img;
let imgX, imgY;
let imgWidth, imgHeight;

// Belleğe yazdığımız ayarlar
const AFFECTED_RADIUS = 20;   // dalga yarıçapı
const WAVE_STRENGTH = 15;     // dalga gücü
const WAVE_LIFETIME = 60;     // 1 sn (60 fps varsayımı)
const MAX_WAVES = 300;        // aynı anda en fazla kaç dalga olsun
const BRUSH_SPACING = 5;      // fırça dalgaları arası mesafe (pixel)

// Dalga ve buffer'lar
let activeWaves = [];
let baseG;
let pg;

// Fırça için son nokta
let lastBrushX = null;
let lastBrushY = null;

function preload() {
  // Repo kökünde: kucukMaymun.jpg
  img = loadImage('kucukMaymun.jpg');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  setupImageBuffers();
}

function setupImageBuffers() {
  // Görseli ekrana oranlı sığdır
  let scaleFactor = Math.min(width / img.width, height / img.height) * 0.9;

  imgWidth  = int(img.width  * scaleFactor);
  imgHeight = int(img.height * scaleFactor);

  imgX = int((width  - imgWidth)  / 2);
  imgY = int((height - imgHeight) / 2);

  // Kaynak buffer (bozulmamış görüntü)
  baseG = createGraphics(imgWidth, imgHeight);
  baseG.pixelDensity(1);
  baseG.image(img, 0, 0, imgWidth, imgHeight);
  baseG.loadPixels();

  // Çıktı buffer
  pg = createGraphics(imgWidth, imgHeight);
  pg.pixelDensity(1);

  // Fırça state reset
  activeWaves = [];
  lastBrushX = null;
  lastBrushY = null;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  setupImageBuffers();
}

function draw() {
  background(0);

  // Süresi dolan dalgaları sil
  activeWaves = activeWaves.filter(w => (frameCount - w.startTime) < WAVE_LIFETIME);

  // Dalga kalmadıysa direkt görseli bas
  if (activeWaves.length === 0) {
    image(baseG, imgX, imgY);
    return;
  }

  baseG.loadPixels();
  pg.loadPixels();

  // baseG → pg kopyala
  for (let i = 0; i < baseG.pixels.length; i++) {
    pg.pixels[i] = baseG.pixels[i];
  }

  // Her dalgayı uygula
  for (let wave of activeWaves) {
    let age = frameCount - wave.startTime;
    let fadeFactor = 1 - (age / WAVE_LIFETIME); // zamanla sönme
    fadeFactor = constrain(fadeFactor, 0, 1);

    let waveCenterX = wave.x - imgX;
    let waveCenterY = wave.y - imgY;

    let minX = max(0, int(waveCenterX - AFFECTED_RADIUS));
    let maxX = min(imgWidth - 1, int(waveCenterX + AFFECTED_RADIUS));
    let minY = max(0, int(waveCenterY - AFFECTED_RADIUS));
    let maxY = min(imgHeight - 1, int(waveCenterY + AFFECTED_RADIUS));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {

        let dx = x - waveCenterX;
        let dy = y - waveCenterY;
        let d = Math.sqrt(dx * dx + dy * dy);

        if (d < AFFECTED_RADIUS) {
          let wavePos = Math.sin(d * 0.2 + age * 0.5);

          let strengthFactor = 1 - (d / AFFECTED_RADIUS);

          // fırça dalgası: hem yarıçapa göre, hem zamana göre sönüyor
          let displacement = wavePos * WAVE_STRENGTH * strengthFactor * fadeFactor;

          let angle = Math.atan2(dy, dx);

          let sourceX = int(x - Math.cos(angle) * displacement);
          let sourceY = int(y - Math.sin(angle) * displacement);

          if (
            sourceX >= 0 && sourceX < imgWidth &&
            sourceY >= 0 && sourceY < imgHeight
          ) {
            let srcIndex = (sourceY * imgWidth + sourceX) * 4;
            let dstIndex = (y * imgWidth + x) * 4;

            pg.pixels[dstIndex]     = baseG.pixels[srcIndex];
            pg.pixels[dstIndex + 1] = baseG.pixels[srcIndex + 1];
            pg.pixels[dstIndex + 2] = baseG.pixels[srcIndex + 2];
            pg.pixels[dstIndex + 3] = baseG.pixels[srcIndex + 3];
          }
        }
      }
    }
  }

  pg.updatePixels();
  image(pg, imgX, imgY);
}

/* ---------- Fırça / giriş kısmı ---------- */

function addBrushWave(x, y) {
  // Görselin dışındaysa uğraşma
  if (x < imgX || x > imgX + imgWidth || y < imgY || y > imgY + imgHeight) {
    return;
  }

  // Fırça mesafesi kontrolü (dalgalar arası mesafeyi azaltmak / çoğaltmak için BRUSH_SPACING)
  if (lastBrushX !== null && lastBrushY !== null) {
    let d = dist(x, y, lastBrushX, lastBrushY);
    if (d < BRUSH_SPACING) {
      return;
    }
  }

  lastBrushX = x;
  lastBrushY = y;

  activeWaves.push({
    x: x,
    y: y,
    startTime: frameCount
  });

  // Çok fazla wave birikmesin
  if (activeWaves.length > MAX_WAVES) {
    activeWaves.shift();
  }
}

// Mouse ile
function mouseDragged() {
  addBrushWave(mouseX, mouseY);
  return false; // sayfanın seçilmesini engelle
}

function mousePressed() {
  addBrushWave(mouseX, mouseY);
  return false;
}

// Dokunmatik ile (iPad, telefon)
function touchMoved() {
  if (touches.length > 0) {
    let t = touches[0];
    addBrushWave(t.x, t.y);
  }
  return false; // sayfa scroll olmasın
}

function touchStarted() {
  if (touches.length > 0) {
    let t = touches[0];
    addBrushWave(t.x, t.y);
  }
  return false;
}
