let img;
let imgX, imgY;
let imgWidth, imgHeight;

// Dalga ayarları
let AFFECTED_RADIUS = 30;
let WAVE_STRENGTH = 20;
const WAVE_LIFETIME = 60;   // 1 sn
const MAX_WAVES = 50;      // Bellek / FPS koruması
const BRUSH_SPACING = 6;    // Dalgalar arası mesafe (brush efekti)

// Brush için son pozisyon
let lastBrushX = null;
let lastBrushY = null;

let activeWaves = [];
let baseG;
let pg;

// ---- Mod ve resimler ----
let mode = "menu";  // "menu" veya "paint"
let imgGoril, imgLeopar, imgAntilop;

function preload() {
  // 3 resmi de önceden yükle
  // Eğer dosya isimlerini değiştirdiysen, burayı ona göre düzenle:
  imgGoril    = loadImage('kucukMaymun.jpg');  // veya 'Goril.jpg'
  imgLeopar   = loadImage('kucukLeopar.jpg');  // veya 'Leopar.jpg'
  imgAntilop  = loadImage('kucukGeyik.jpg');   // veya 'Antilop.jpg'

  // Varsayılan olarak Goril seçili olsun
  img = imgGoril;
}

function setup() {
  // Tam ekran canvas
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);

  // MENÜDEYKEN buffer kurmuyoruz, kullanıcı bir görsel seçince kuracağız.
  // setupImageBuffers();  <-- BİLEREK YOK

  // iPad’de dokunurken sayfa kaymasın
  document.addEventListener(
    'touchmove',
    (e) => e.preventDefault(),
    { passive: false }
  );
}

// EKRAN BOYUTU DEĞİŞİNCE (iPad rotate vs.) – sadece paint modunda yeniden hesapla
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (mode === "paint" && img) {
    setupImageBuffers();
  }
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

// ---- MENU ÇİZME ----
function drawMenu() {
  background(0);

  textAlign(CENTER, CENTER);
  noStroke();
  fill(255);
  textSize(32);
  text("Bir görsel seç:", width / 2, height * 0.2);

  let buttonWidth = min(width * 0.6, 400);
  let buttonHeight = 60;
  let gap = 20;
  let totalHeight = 3 * buttonHeight + 2 * gap;
  let startY = height / 2 - totalHeight / 2;

  // Ortak stil
  textSize(24);

  let bx = width / 2 - buttonWidth / 2;
  let by = startY;

  // 1) Goril
  fill(40);
  rect(bx, by, buttonWidth, buttonHeight, 10);
  fill(255);
  text("Goril", width / 2, by + buttonHeight / 2);

  // 2) Leopar
  by += buttonHeight + gap;
  fill(40);
  rect(bx, by, buttonWidth, buttonHeight, 10);
  fill(255);
  text("Leopar", width / 2, by + buttonHeight / 2);

  // 3) Antilop
  by += buttonHeight + gap;
  fill(40);
  rect(bx, by, buttonWidth, buttonHeight, 10);
  fill(255);
  text("Antilop", width / 2, by + buttonHeight / 2);
}

// Menü tıklama / dokunma kontrolü
function handleMenuClick(px, py) {
  let buttonWidth = min(width * 0.6, 400);
  let buttonHeight = 60;
  let gap = 20;
  let totalHeight = 3 * buttonHeight + 2 * gap;
  let startY = height / 2 - totalHeight / 2;
  let bx = width / 2 - buttonWidth / 2;

  // 1) Goril
  let by1 = startY;
  // 2) Leopar
  let by2 = by1 + buttonHeight + gap;
  // 3) Antilop
  let by3 = by2 + buttonHeight + gap;

  function inside(bx, by) {
    return px >= bx && px <= bx + buttonWidth &&
           py >= by && py <= by + buttonHeight;
  }

  if (inside(bx, by1)) {
    img = imgGoril;
  } else if (inside(bx, by2)) {
    img = imgLeopar;
  } else if (inside(bx, by3)) {
    img = imgAntilop;
  } else {
    return; // Hiçbirine tıklanmadıysa çık
  }

  // Birini seçtiysek:
  setupImageBuffers(); // Seçilen görsele göre buffer'ları yeniden hazırla
  mode = "paint";      // Artık fırça/dalga moduna geç
}

function draw() {
  if (mode === "menu") {
    drawMenu();
    return;
  }

  // ---- BURADAN SONRASI PAINT MODU ----
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

  pg.updatePixels();
  image(pg, imgX, imgY);
}

function addBrushWave(px, py) {
  // Görselin dışındaysa wave ekleme
  if (!(px > imgX && px < imgX + imgWidth &&
        py > imgY && py < imgY + imgHeight)) {
    return;
  }

  // İlk brush noktasıysa direkt ekle
  if (lastBrushX === null || lastBrushY === null) {
    lastBrushX = px;
    lastBrushY = py;
  }

  // Aralık kontrolü – brush gibi görünmesini sağlayan kısım
  let d = dist(px, py, lastBrushX, lastBrushY);
  if (d < BRUSH_SPACING) {
    return; // çok yakın, yeni wave ekleme
  }

  // Hız hesapla (d ne kadar büyükse, o kadar sert)
  let speedFactor = map(d, 0, 50, 0.5, 2.0);
  speedFactor = constrain(speedFactor, 0.5, 2.0);

  activeWaves.push({
    x: px,
    y: py,
    startTime: frameCount,
    speed: speedFactor
  });

  // Çok wave olursa eskileri at
  if (activeWaves.length > MAX_WAVES) {
    activeWaves.splice(0, activeWaves.length - MAX_WAVES);
  }

  lastBrushX = px;
  lastBrushY = py;
}

// Mouse ile brush
function mouseMoved() {
  if (mode === "paint") {
    addBrushWave(mouseX, mouseY);
  }
  return false;
}

// Dokunarak brush (iPad)
function touchMoved() {
  if (mode === "paint") {
    let t = touches[0];
    if (t) {
      addBrushWave(t.x, t.y);
    }
  }
  return false;
}

// Menü tıklama
function mousePressed() {
  if (mode === "menu") {
    handleMenuClick(mouseX, mouseY);
    return false;
  }
}

function touchStarted() {
  if (mode === "menu") {
    let t = touches[0];
    if (t) {
      handleMenuClick(t.x, t.y);
    }
  }
  return false;
}

// Dokunma / mouse bırakılınca brush başlangıcını resetle
function mouseReleased() {
  lastBrushX = null;
  lastBrushY = null;
}
function touchEnded() {
  lastBrushX = null;
  lastBrushY = null;
}
