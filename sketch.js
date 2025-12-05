let img;
let imgX, imgY;
let imgWidth, imgHeight;

// Dalga ayarları
let AFFECTED_RADIUS = 20;
let WAVE_STRENGTH = 15;
const WAVE_LIFETIME = 60;   // 1 sn
const MAX_WAVES = 300;      // Bellek / FPS koruması
const BRUSH_SPACING = 6;    // Dalgalar arası mesafe (brush efekti)

// Brush için son pozisyon
let lastBrushX = null;
let lastBrushY = null;

let activeWaves = [];
let baseG;
let pg;

const CANVAS_W = 800;
const CANVAS_H = 600;

function preload() {
  // Proje klasörü silindi, dosyalar kökte
  img = loadImage('kucukMaymun.jpg');
}

function setup() {
  createCanvas(CANVAS_W, CANVAS_H);
  pixelDensity(1);
  setupImageBuffers();

  // iPad’de dokunurken scroll olmasın
  // (index.html tarafında da body overflow:hidden yaptık varsayıyorum)
  document.addEventListener(
    'touchmove',
    (e) => e.preventDefault(),
    { passive: false }
  );
}

function setupImageBuffers() {
  let scaleFactor = Math.min(width / img.width, height / img.height) * 0.9;

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

  // Ömrü biten dalgaları temizle
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
    let lifeRatio = waveAge / WAVE_LIFETIME;
    let fadeFactor = 1 - lifeRatio;

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

          // Merkeze yakın daha güçlü + zamanla fade
          let strengthSpatial = 1 - d / AFFECTED_RADIUS;
          let strength = strengthSpatial * fadeFactor;

          // Hız bazlı güç (mouse / touch hızına göre)
          let speedFactor = wave.speed || 1.0;

          let
