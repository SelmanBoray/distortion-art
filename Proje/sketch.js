let img;
let imgX, imgY;
let imgWidth, imgHeight;

// Senin ayarın: küçük yarıçaplı fırça
let AFFECTED_RADIUS = 20;
let WAVE_STRENGTH = 15;

// Dalga ömrü: ~1 saniye (60 FPS varsayımı)
const WAVE_LIFETIME = 60;

// Fırça gibi olması için dalga aralığı, max dalga sayısı
const MIN_WAVE_DISTANCE = 5;   // fırça taneleri birbirine yakın
const MAX_WAVES = 200;         // hafızayı patlatmamak için limit

let activeWaves = [];
let baseG; // kaynak (scale edilmiş orijinal)
let pg;    // bozulmuş çıktı buffer

// Son dalga noktası (fırça izi için)
let lastWaveX = null;
let lastWaveY = null;

function preload() {
  // Senin görselin
  img = loadImage('kucukMaymun.jpg');
}

function setup() {
  // iPad’de tam ekran
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);

  setupImageBuffers();
}

function windowResized() {
  // Ekran dönerse / boyut değişirse yeniden ayarla
  resizeCanvas(windowWidth, windowHeight);
  setupImageBuffers();
}

// Görseli ekran boyutuna göre oranlı yerleştiren fonksiyon
function setupImageBuffers() {
  if (!img) return;

  // Görseli ekran içine oranlı sığdır (galeri hissi için %90)
  let scaleFactor = Math.min(width / img.width, height / img.height) * 0.9;

  imgWidth = Math.floor(img.width * scaleFactor);
  imgHeight = Math.floor(img.height * scaleFactor);

  imgX = Math.floor((width - imgWidth) / 2);
  imgY = Math.floor((height - imgHeight) / 2);

  // Kaynak buffer (değişmeyen scale edilmiş görüntü)
  baseG = createGraphics(imgWidth, imgHeight);
  baseG.pixelDensity(1);
  baseG.image(img, 0, 0, imgWidth, imgHeight);
  baseG.loadPixels();

  // Çıktı buffer
  pg = createGraphics(imgWidth, imgHeight);
  pg.pixelDensity(1);

  // Eski dalgalar eski koordinatla uyumsuz olacağı için sıfırla
  activeWaves = [];
  lastWaveX = null;
  lastWaveY = null;
}

function draw() {
  background(0);

  if (!img || !baseG || !pg) {
    // Görsel daha yüklenmediyse veya buffer hazır değilse bekle
    return;
  }

  // Dalga ömrü dolanları temizle
  activeWaves = activeWaves.filter(w => {
    let age = frameCount - w.startTime;
    return age < WAVE_LIFETIME;
  });

  // Fazla dalga birikmesin (performans için)
  if (activeWaves.length > MAX_WAVES) {
    let extra = activeWaves.length - MAX_WAVES;
    activeWaves.splice(0, extra); // en eski dalgaları sil
  }

  // Hiç dalga yoksa direkt orijinal resmi çiz
  if (activeWaves.length === 0) {
    image(baseG, imgX, imgY);
    return;
  }

  baseG.loadPixels();
  pg.loadPixels();

  // baseG → pg kopyala (bozulmamış hal)
  for (let i = 0; i < baseG.pixels.length; i++) {
    pg.pixels[i] = baseG.pixels[i];
  }

  // Her aktif dalga için bozulma uygula
  for (let wave of activeWaves) {
    let waveAge = frameCount - wave.startTime;
    let lifeRatio = waveAge / WAVE_LIFETIME;
    let fadeFactor = 1 - lifeRatio;                // zamanla sönme
    fadeFactor = constrain(fadeFactor, 0, 1);

    let waveCenterX = wave.x - imgX;
    let waveCenterY = wave.y - imgY;

    // Dalganın etkilediği alan (bounding box)
    let minX = Math.max(0, Math.floor(waveCenterX - AFFECTED_RADIUS));
    let maxX = Math.min(imgWidth - 1, Math.ceil(waveCenterX + AFFECTED_RADIUS));
    let minY = Math.max(0, Math.floor(waveCenterY - AFFECTED_RADIUS));
    let maxY = Math.min(imgHeight - 1, Math.ceil(waveCenterY + AFFECTED_RADIUS));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        let dx = x - waveCenterX;
        let dy = y - waveCenterY;
        let d = Math.sqrt(dx * dx + dy * dy);

        if (d < AFFECTED_RADIUS) {
          // Dalganın sinüs tabanlı salınımı
          let wavePos = Math.sin(d * 0.2 + waveAge * 0.5);

          // Kenarlara yaklaştıkça güç azalsın
          let radialStrength = 1 - (d / AFFECTED_RADIUS);

          // Fırça hızına göre ek kuvvet: wave.speed
          let speedFactor = wave.speed || 1.0;

          let displacement =
            wavePos * WAVE_STRENGTH * radialStrength * fadeFactor * speedFactor;

          let angle = Math.atan2(dy, dx);

          let moveX = Math.cos(angle) * displacement;
          let moveY = Math.sin(angle) * displacement;

          let sourceX = Math.floor(x - moveX);
          let sourceY = Math.floor(y - moveY);

          if (
            sourceX >= 0 &&
            sourceX < imgWidth &&
            sourceY >= 0 &&
            sourceY < imgHeight
          ) {
            let srcIndex = (sourceY * imgWidth + sourceX) * 4;
            let dstIndex = (y * imgWidth + x) * 4;

            pg.pixels[dstIndex] = baseG.pixels[srcIndex];       // R
            pg.pixels[dstIndex + 1] = baseG.pixels[srcIndex + 1]; // G
            pg.pixels[dstIndex + 2] = baseG.pixels[srcIndex + 2]; // B
            pg.pixels[dstIndex + 3] = baseG.pixels[srcIndex + 3]; // A
          }
        }
      }
    }
  }

  pg.updatePixels();
  image(pg, imgX, imgY);
}

/**
 * Ortak dalga ekleme fonksiyonu
 * hem mouse hem touch burayı kullanıyor
 */
function addWaveAt(x, y) {
  // Görselin dışındaysa boşver
  if (
    x < imgX ||
    x > imgX + imgWidth ||
    y < imgY ||
    y > imgY + imgHeight
  ) {
    return;
  }

  let speed = 1.0;

  if (lastWaveX !== null && lastWaveY !== null) {
    let d = dist(x, y, lastWaveX, lastWaveY);

    // Dalga noktaları birbirine çok yakınsa yenisini ekleme (performans + kontrol)
    if (d < MIN_WAVE_DISTANCE) {
      return;
    }

    // Hıza göre fırça gücü (ne kadar hızlı çekersen o kadar agresif)
    speed = constrain(d / 10, 0.4, 2.0);
  }

  lastWaveX = x;
  lastWaveY = y;

  activeWaves.push({
    x: x,
    y: y,
    startTime: frameCount,
    speed: speed
  });

  // Limit aşılırsa en eski dalgayı sil
  if (activeWaves.length > MAX_WAVES) {
    activeWaves.shift();
  }
}

/** 
 * Mouse ile fırça (bilgisayar kullanırken)
 */
function mouseMoved() {
  addWaveAt(mouseX, mouseY);
}

function mouseDragged() {
  addWaveAt(mouseX, mouseY);
}

/**
 * iPad / dokunmatik için:
 * touchMoved sürekli çağrılır, mouseX/mouseY dokunma noktasına eşit olur
 */
function touchMoved() {
  addWaveAt(mouseX, mouseY);
  // Tarayıcının default scroll/zoom davranışını engelle
  return false;
}

// iPad’de parmak kaldırınca fırçayı resetlemek istersen:
function touchEnded() {
  lastWaveX = null;
  lastWaveY = null;
}

function mouseReleased() {
  lastWaveX = null;
  lastWaveY = null;
}
