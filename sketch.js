let img;
let imgX, imgY;
let imgWidth, imgHeight;

// Dalga ayarları
let AFFECTED_RADIUS = 50;
let WAVE_STRENGTH = 15;
const WAVE_LIFETIME = 40;   // 1 sn
const MAX_WAVES = 30;       // Bellek / FPS koruması
const BRUSH_SPACING = 6;    // Dalgalar arası mesafe (brush efekti)

// Brush için son pozisyon
let lastBrushX = null;
let lastBrushY = null;

let activeWaves = [];
let baseG;
let pg;

// ---- Mod ----
let mode = "menu";  // "menu" veya "paint"

// ---- Görsel katalogu (10 adet) ----
const ANIMALS = [
  { label: "Addaks", file: "addaks.jpg", img: null },
  { label: "Amerika Kaya İguanası", file: "amerika_kaya_iguanasi.jpg", img: null },
  { label: "Amur Leoparı", file: "amur_leopari.jpg", img: null },
  { label: "Bulutlu Leopar", file: "bulutlu_leopar.jpg", img: null },
  { label: "Cava Gergedanı", file: "cava_gergedani.jpg", img: null },
  { label: "Dağ Gorili", file: "dag_gorili.jpg", img: null },
  { label: "Penguen", file: "penguen.jpg", img: null },
  { label: "Sumatra Fili", file: "sumatra_fili.jpg", img: null },
  { label: "Vaquita", file: "vaquita.jpg", img: null },
  { label: "Karayip Manatisi", file: "karayip_manatisi.jpg", img: null },
];

// Grid ayarları
const GRID_COLS = 2;
const GRID_ROWS = 5;

// Geri ok butonu için ayarlar
const BACK_SIZE = 50;
const BACK_MARGIN = 20;

function preload() {
  // Tüm görselleri yükle
  for (let a of ANIMALS) {
    a.img = loadImage(a.file);
  }

  // Varsayılan: ilk görsel
  img = ANIMALS[0].img;
}

function setup() {
  // Tam ekran canvas
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

// EKRAN BOYUTU DEĞİŞİNCE (iPad rotate vs.) HER ŞEYİ YENİDEN AYARLA
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

  pg = createGraphics(imgWidth, imgHeight);
  pg.pixelDensity(1);

  activeWaves = [];
  lastBrushX = null;
  lastBrushY = null;
}

// ---- MENU ÇİZME (2x5 GRID) ----
function drawMenu() {
  background(0);

  textAlign(CENTER, CENTER);
  noStroke();
  fill(255);
  textSize(32);
  text("Bir görsel seç:", width / 2, height * 0.12);

  // Grid alanı
  const top = height * 0.18;
  const bottom = height * 0.92;
  const left = width * 0.10;
  const right = width * 0.90;

  const gridW = right - left;
  const gridH = bottom - top;

  const cellW = gridW / GRID_COLS;
  const cellH = gridH / GRID_ROWS;

  // Hücre iç padding
  const pad = min(cellW, cellH) * 0.10;

  textSize(16);
  for (let i = 0; i < ANIMALS.length; i++) {
    const r = floor(i / GRID_COLS);
    const c = i % GRID_COLS;

    const x = left + c * cellW;
    const y = top + r * cellH;

    // Kart arkaplan
    fill(40);
    rect(x + pad, y + pad, cellW - 2 * pad, cellH - 2 * pad, 12);

    // Preview görsel (kartın üst kısmı)
    const imgBoxX = x + pad * 2;
    const imgBoxY = y + pad * 2;
    const imgBoxW = cellW - 4 * pad;
    const imgBoxH = (cellH - 4 * pad) * 0.68;

    const aimg = ANIMALS[i].img;

    // contain-fit çizim
    const s = min(imgBoxW / aimg.width, imgBoxH / aimg.height);
    const dw = aimg.width * s;
    const dh = aimg.height * s;

    image(aimg, imgBoxX + (imgBoxW - dw) / 2, imgBoxY + (imgBoxH - dh) / 2, dw, dh);

    // Etiket
    fill(255);
    const labelY = imgBoxY + imgBoxH + (cellH - 4 * pad - imgBoxH) / 2;
    text(ANIMALS[i].label, x + cellW / 2, labelY);
  }
}

// Menü tıklama / dokunma kontrolü (2x5)
function handleMenuClick(px, py) {
  const top = height * 0.18;
  const bottom = height * 0.92;
  const left = width * 0.10;
  const right = width * 0.90;

  // grid dışında tıklandıysa çık
  if (px < left || px > right || py < top || py > bottom) return;

  const gridW = right - left;
  const gridH = bottom - top;

  const cellW = gridW / GRID_COLS;
  const cellH = gridH / GRID_ROWS;

  const c = floor((px - left) / cellW);
  const r = floor((py - top) / cellH);

  if (c < 0 || c >= GRID_COLS || r < 0 || r >= GRID_ROWS) return;

  const idx = r * GRID_COLS + c;
  if (idx < 0 || idx >= ANIMALS.length) return;

  // Seç
  img = ANIMALS[idx].img;

  setupImageBuffers();
  mode = "paint";
}

// ---- GERİ OK BUTONU ----
function drawBackButton() {
  push();
  noStroke();
  fill(0, 160);
  rect(BACK_MARGIN, BACK_MARGIN, BACK_SIZE, BACK_SIZE, 14);

  translate(BACK_MARGIN + BACK_SIZE / 2, BACK_MARGIN + BACK_SIZE / 2);
  stroke(255);
  strokeWeight(3);
  noFill();

  line(8, 0, -4, 0);
  line(-4, 0, 2, -6);
  line(-4, 0, 2, 6);

  pop();
}

function isInsideBackButton(px, py) {
  return (
    px >= BACK_MARGIN &&
    px <= BACK_MARGIN + BACK_SIZE &&
    py >= BACK_MARGIN &&
    py <= BACK_MARGIN + BACK_SIZE
  );
}

// ---- ANA DRAW ----
function draw() {
  if (mode === "menu") {
    drawMenu();
    return;
  }

  background(0);

  // Ömrü biten dalgaları temizle
  activeWaves = activeWaves.filter(
    (w) => frameCount - w.startTime < WAVE_LIFETIME
  );

  baseG.loadPixels();
  pg.loadPixels();

  // baseG → pg kopyala
  for (let i = 0; i < baseG.pixels.length; i++) {
    pg.pixels[i] = baseG.pixels[i];
  }

  if (activeWaves.length > 0) {
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

            let strengthSpatial = 1 - d / AFFECTED_RADIUS;
            let strength = strengthSpatial * fadeFactor;

            let speedFactor = wave.speed || 1.0;
            let displacement = wavePos * WAVE_STRENGTH * strength * speedFactor;

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
  }

  pg.updatePixels();
  image(pg, imgX, imgY);

  drawBackButton();
}

function addBrushWave(px, py) {
  if (!(px > imgX && px < imgX + imgWidth &&
        py > imgY && py < imgY + imgHeight)) {
    return;
  }

  if (lastBrushX === null || lastBrushY === null) {
    lastBrushX = px;
    lastBrushY = py;
  }

  let d = dist(px, py, lastBrushX, lastBrushY);
  if (d < BRUSH_SPACING) return;

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

function mouseMoved() {
  if (mode === "paint") {
    addBrushWave(mouseX, mouseY);
  }
  return false;
}

function touchMoved() {
  if (mode === "paint") {
    let t = touches[0];
    if (t) {
      addBrushWave(t.x, t.y);
    }
  }
  return false;
}

function mousePressed() {
  if (mode === "menu") {
    handleMenuClick(mouseX, mouseY);
    return false;
  } else if (mode === "paint") {
    if (isInsideBackButton(mouseX, mouseY)) {
      mode = "menu";
      activeWaves = [];
      lastBrushX = null;
      lastBrushY = null;
      return false;
    }
  }
}

function touchStarted() {
  if (mode === "menu") {
    let t = touches[0];
    if (t) {
      handleMenuClick(t.x, t.y);
    }
  } else if (mode === "paint") {
    let t = touches[0];
    if (t && isInsideBackButton(t.x, t.y)) {
      mode = "menu";
      activeWaves = [];
      lastBrushX = null;
      lastBrushY = null;
      return false;
    }
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
