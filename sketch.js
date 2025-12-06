let img;
let imgX, imgY;
let imgWidth, imgHeight;

// Dalga ayarları
let AFFECTED_RADIUS = 50;
let WAVE_STRENGTH = 15;
const WAVE_LIFETIME = 40;   // 1 sn
const MAX_WAVES = 30;      // Bellek / FPS koruması
const BRUSH_SPACING = 6;    // Dalgalar arası mesafe (brush efekti)

// Brush için son pozisyon
let lastBrushX = null;
let lastBrushY = null;

let activeWaves = [];
let baseG;
let pg;

// ---- Mod ve resimler ----
let mode = "menu";  // "menu" veya "paint"
let imgMaymun, imgLeopar, imgGeyik;

// Geri ok butonu için ayarlar
const BACK_SIZE = 50;
const BACK_MARGIN = 20;

function preload() {
  // 3 resmi de önceden yükle
  imgMaymun  = loadImage('kucukMaymun.jpg');
  imgLeopar  = loadImage('kucukLeopar.jpg');
  imgGeyik   = loadImage('kucukGeyik.jpg');

  // Varsayılan olarak maymunu seç
  img = imgMaymun;
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

  // 1) Goril (eski Maymun)
  let bx = width / 2 - buttonWidth / 2;
  let by = startY;
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

  // 3) Antilop (eski Geyik)
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

  // Bir butonun içine tıklandı mı?
  function inside(bxLocal, byLocal) {
    return px >= bxLocal && px <= bxLocal + buttonWidth &&
           py >= byLocal && py <= byLocal + buttonHeight;
  }

  if (inside(bx, by1)) {
    img = imgMaymun;
  } else if (inside(bx, by2)) {
    img = imgLeopar;
  } else if (inside(bx, by3)) {
    img = imgGeyik;
  } else {
    return; // Hiçbirine tıklanmadıysa çık
  }

  // Birini seçtiysek:
  setupImageBuffers(); // Seçilen görsele göre buffer'ları yeniden hazırla
  mode = "paint";      // Artık fırça/dalga moduna geç
}

// ---- GERİ OK BUTONU ----
function drawBackButton() {
  push();
  // Arka plan kutusu
  noStroke();
  fill(0, 160); // hafif transparan siyah
  rect(BACK_MARGIN, BACK_MARGIN, BACK_SIZE, BACK_SIZE, 14);

  // Ok ikonu
  translate(BACK_MARGIN + BACK_SIZE / 2, BACK_MARGIN + BACK_SIZE / 2);
  stroke(255);
  strokeWeight(3);
  noFill();

  // Gövde çizgisi
  line(8, 0, -4, 0);
  // Okun uç kısmı (sola bakan)
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

  // ---- BURADAN SONRASI PAINT MODU (ESKİ DAVRANIŞ) ----
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
  }

  pg.updatePixels();
  image(pg, imgX, imgY);

  // Her durumda (dalga olsa da olmasa da) geri ok butonunu çiz
  drawBackButton();
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

// Menü tıklama + geri ok
function mousePressed() {
  if (mode === "menu") {
    handleMenuClick(mouseX, mouseY);
    return false;
  } else if (mode === "paint") {
    // Geri oka tıklanırsa menüye dön
    if (isInsideBackButton(mouseX, mouseY)) {
      mode = "menu";
      activeWaves = [];
      lastBrushX = null;
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
      return false;
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
