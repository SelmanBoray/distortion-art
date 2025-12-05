let img;
let imgX, imgY;
let imgWidth, imgHeight;

// Dalga ayarları
let AFFECTED_RADIUS = 30;
let WAVE_STRENGTH = 15;
const WAVE_LIFETIME = 60;   // 1 sn
const MAX_WAVES = 150;      // Bellek / FPS koruması
const BRUSH_SPACING = 6;    // Dalgalar arası mesafe (brush efekti)

// Brush için son pozisyon
let lastBrushX = null;
let lastBrushY = null;

let activeWaves = [];
let baseG;
let pg;
let basePixels = null; // 🔹 Sabit kaynak buffer

function preload() {
  img = loadImage('kucukMaymun.jpg');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  setupImageBuffers();

  // iPad’de dokunurken sayfa kaymasın
  document.addEventListener(
    'touchmove',
    (e) => e.preventDefault(),
    { passive: false }
  );
}

// Ekran boyutu değişince yeniden kur
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  setupImageBuffers();
}

function setupImageBuffers() {
  // Görseli ekrana oranlı sığdır (kenarlardan %10 boşluk)
  let scaleFactor = Math.min(width / img.width, height / img.height) * 0.9;

  imgWidth = int(img.width * scaleFactor);
  imgHeight = int(img.height * scaleFactor);

  imgX = int((width - imgWidth) / 2);
  imgY = int((height - imgHeight) / 2);

  baseG = createGraphics(imgWidth, imgHeight);
  baseG.pixelDensity(1);
  baseG.image(img, 0, 0, imgWidth, imgHeight);
  baseG.loadPixels();

  // 🔹 Sabit kaynak buffer’ı sadece bir kez kaydediyoruz
  basePixels = baseG.pixels.slice();

  pg = createGraphics(imgWidth, imgHeight);
  pg.pixelDensity(1);

  activeWaves = [];
  lastBrushX = null;
  lastBrushY = null;
}

function draw() {
  background(0);

  // Ömrü biten dalgaları temizle
  activeWaves = activeWaves.filter(w => (frameCount - w.startTime) < WAVE_LIFETIME);

  if (activeWaves.length === 0) {
    image(baseG, imgX, imgY);
    return;
  }

  // 🔹 Artık baseG.loadPixels() yok, çünkü basePixels sabit
  pg.loadPixels();

  // 🔹 Tüm resmi tek satırda kopyala (çok hızlı)
  pg.pixels.set(basePixels);

  const radius = AFFECTED_RADIUS;
  const radius2 = radius * radius;
  const invRadius = 1 / radius;

  const destPixels = pg.pixels;
  const srcPixels = basePixels; // baseG değil, buffer’dan okuyacağız
  const w = imgWidth;

  for (let wave of activeWaves) {
    let waveAge = frameCount - wave.startTime;
    let lifeRatio = waveAge / WAVE_LIFETIME;
    let fadeFactor = 1 - lifeRatio;

    let wcx = wave.x - imgX;
    let wcy = wave.y - imgY;

    let minX = max(0, int(wcx - radius));
    let maxX = min(imgWidth - 1, int(wcx + radius));
    let minY = max(0, int(wcy - radius));
    let maxY = min(imgHeight - 1, int(wcy + radius));

    let timeFactor = waveAge * 0.5;
    let speedFactor = wave.speed || 1.0;

    for (let y = minY; y <= maxY; y++) {
      let dy = y - wcy;

      for (let x = minX; x <= maxX; x++) {
        let dx = x - wcx;
        let d2 = dx * dx + dy * dy;

        if (d2 < radius2) {
          let d = Math.sqrt(d2);

          let wavePos = Math.sin(d * 0.2 + timeFactor);

          let strengthSpatial = 1 - d * invRadius;
          let strength = strengthSpatial * fadeFactor;

          let displacement = wavePos * WAVE_STRENGTH * strength * speedFactor;

          let angle = Math.atan2(dy, dx);

          let sx = int(x - Math.cos(angle) * displacement);
          let sy = int(y - Math.sin(angle) * displacement);

          if (sx >= 0 && sx < imgWidth && sy >= 0 && sy < imgHeight) {
            let srcIndex = (sy * w + sx) * 4;
            let dstIndex = (y * w + x) * 4;

            destPixels[dstIndex]     = srcPixels[srcIndex];
            destPixels[dstIndex + 1] = srcPixels[srcIndex + 1];
            destPixels[dstIndex + 2] = srcPixels[srcIndex + 2];
            destPixels[dstIndex + 3] = srcPixels[srcIndex + 3];
          }
        }
      }
    }
  }

  pg.updatePixels();
  image(pg, imgX, imgY);
}

function addBrushWave(px, py) {
  // Görselin dışındaysa wave ekleme
  if (!(px > imgX && px < imgX + imgWidth &&
        py > imgY && py < imgY + imgHeight)) {
    return;
  }

  if (lastBrushX === null || lastBrushY === null) {
    lastBrushX = px;
    lastBrushY = py;
  }

  let d = dist(px, py, lastBrushX, lastBrushY);
  if (d < BRUSH_SPACING) {
    return;
  }

  let speedFactor = map(d, 0, 50, 0.5, 2.0);
  speedFactor = constrain(speedFactor, 0.5, 2.0);

  activeWaves.push({
    x: px,
    y: py,
    startTime: frameCount,
    speed: speedFactor
  });

  if (activeWaves.length > MAX_WAVES) {
    activeWaves.splice(0, activeWaves.length - MAX_WAVES);
  }

  lastBrushX = px;
  lastBrushY = py;
}

// Mouse ile brush
function mouseMoved() {
  addBrushWave(mouseX, mouseY);
  return false;
}

// Dokunarak brush (iPad)
function touchMoved() {
  let t = touches[0];
  if (t) {
    addBrushWave(t.x, t.y);
  }
  return false;
}

function mouseReleased() {
  lastBrushX = null;
  lastBrushY = null;
}
function touchEnded() {
  lastBrushX = null;
  lastBrushY = null;
}
