let img;
let imgX, imgY;
let imgWidth, imgHeight;

// Ayarlarımız
const AFFECTED_RADIUS = 20;    // Dalga yarıçapı
const WAVE_STRENGTH = 15;
const WAVE_LIFETIME = 60;      // ~1 saniye
const MAX_WAVES = 200;         // Aynı anda max dalga
const BRUSH_SPACING = 6;       // Fırça dalgaları arası mesafe (piksel) -> daha sık, daha fırça gibi

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
  // Görseli ekrana orantılı sığdır
  let scaleFactor = min(width / img.width, height / img.height) * 0.9;

  imgWidth = int(img.width * scaleFactor);
  imgHeight = int(img.height * scaleFactor);

  imgX = int((width - imgWidth) / 2);
  imgY = int((height - imgHeight) / 2);

  baseG = createGraphics(imgWidth, imgHeight);
  baseG.pixelDensity(1);
  baseG.image(img, 0, 0, imgWidth, imgHeight);
  baseG.loadPixels();

  pg = createGraphics(imgWidth, imgHeight);
  pg.pixelDensity(1);

  activeWaves = [];
  lastBrushX = null;
  lastBrushY = null;
}

function draw() {
  background(0);

  // Süresi dolan dalgaları temizle
  activeWaves = activeWaves.filter(w => (frameCount - w.startTime) < WAVE_LIFETIME);

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

  for (let wave of activeWaves) {
    let waveAge = frameCount - wave.startTime;
    let fadeFactor = 1 - (waveAge / WAVE_LIFETIME);   // 1 → 0
    fadeFactor = constrain(fadeFactor, 0, 1);

    let wcx = wave.x - imgX;
    let wcy = wave.y - imgY;

    let minX = max(0, int(wcx - AFFECTED_RADIUS));
    let maxX = min(imgWidth - 1, int(wcx + AFFECTED_RADIUS));
    let minY = max(0, int(wcy - AFFECTED_RADIUS));
    let maxY = min(imgHeight - 1, int(wcy + AFFECTED_RADIUS));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {

        let dx = x - wcx;
        let dy = y - wcy;
        let d = sqrt(dx * dx + dy * dy);

        if (d < AFFECTED_RADIUS) {

          let wavePos = sin(d * 0.2 + waveAge * 0.5);
          let strength = (1 - d / AFFECTED_RADIUS) * fadeFactor;

          let displacement = wavePos * WAVE_STRENGTH * strength;

          let angle = atan2(dy, dx);

          let sx = int(x - cos(angle) * displacement);
          let sy = int(y - sin(angle) * displacement);

          if (sx >= 0 && sx < imgWidth && sy >= 0 && sy < imgHeight) {
            let srcIndex = (sy * imgWidth + sx) * 4;
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

/* ---------- FIRÇA LOGİĞİ (PC + iPad) ---------- */

// Ortak fırça fonksiyonu
function handleBrush(x, y) {
  // Görselin dışına çıktıysan fırçayı sıfırla
  if (x < imgX || x > imgX + imgWidth || y < imgY || y > imgY + imgHeight) {
    lastBrushX = null;
    lastBrushY = null;
    return;
  }

  // İlk nokta
  if (lastBrushX === null) {
    spawnWave(x, y);
    lastBrushX = x;
    lastBrushY = y;
    return;
  }

  let dx = x - lastBrushX;
  let dy = y - lastBrushY;
  let dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < BRUSH_SPACING) {
    return; // Aralık yeterli değil, yeni dalga üretme
  }

  // Çok hızlı hareket edildiyse araya birkaç dalga serpiştirelim
  let steps = Math.floor(dist / BRUSH_SPACING);
  for (let i = 1; i <= steps; i++) {
    let t = i / steps;
    let px = lastBrushX + dx * t;
    let py = lastBrushY + dy * t;
    spawnWave(px, py);
  }

  lastBrushX = x;
  lastBrushY = y;
}

// Yeni dalga ekleme + limit
function spawnWave(x, y) {
  activeWaves.push({
    x,
    y,
    startTime: frameCount
  });

  // Çok fazla dalga olursa en eskilerini sil
  if (activeWaves.length > MAX_WAVES) {
    let extra = activeWaves.length - MAX_WAVES;
    activeWaves.splice(0, extra);
  }
}

// PC: sadece mouse'u gezdirmek
function mouseMoved() {
  handleBrush(mouseX, mouseY);
}

// iPad / dokunmatik: parmak hareketi
function touchMoved() {
  handleBrush(mouseX, mouseY); // p5, touch'ta da mouseX/mouseY güncelliyor
  return false; // sayfanın scroll yapmasını engelle
}

// Pencere boyutu değişince iPad + PC’de tam ekran koru
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  setupImageBuffers();
}
