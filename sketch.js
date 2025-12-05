let img;
let imgX, imgY;
let imgWidth, imgHeight;

// Belleğe kaydettiğimiz ayarlar
const AFFECTED_RADIUS = 20;
const WAVE_STRENGTH = 15;
const WAVE_LIFETIME = 60; // ~1 saniye
const MAX_WAVES = 200;    // aynı anda en fazla bu kadar dalga
const BRUSH_SPACING = 10; // fırça dalga aralığı (piksel)

// Dalga ve buffer'lar
let activeWaves = [];
let baseG;
let pg;

// Fırça için son noktayı hatırlayalım
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
  let scaleFactor = min(width / img.width, height / img.height) * 0.9;

  imgWidth = int(img.width * scaleFactor);
  imgHeight = int(img.height * scaleFactor);

  imgX = int((width - imgWidth) / 2);
  imgY = int((height - imgHeight) / 2);

  // Kaynak buffer (ölçeklenmiş orijinal)
  baseG = createGraphics(imgWidth, imgHeight);
  baseG.pixelDensity(1);
  baseG.image(img, 0, 0, imgWidth, imgHeight);
  baseG.loadPixels();

  // Çıktı buffer
  pg = createGraphics(imgWidth, imgHeight);
  pg.pixelDensity(1);

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
    let age = frameCount - wave.startTime;
    let fade = 1 - (age / WAVE_LIFETIME);
    fade = constrain(fade, 0, 1);

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
          let wavePos = sin(d * 0.2 + age * 0.5);
          let strength = (1 - d / AFFECTED_RADIUS) * fade;
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

// Ortak fırça fonksiyonu (mouse + touch burayı kullanacak)
function addBrushWave(screenX, screenY) {
  // Görselin üstünde miyiz?
  if (!(screenX > imgX && screenX < imgX + imgWidth &&
        screenY > imgY && screenY < imgY + imgHeight)) {
    return;
  }

  // Fırça aralığı kontrolü
  if (lastBrushX !== null && lastBrushY !== null) {
    let d = dist(screenX, screenY, lastBrushX, lastBrushY);
    if (d < BRUSH_SPACING) {
      return;
    }
  }

  lastBrushX = screenX;
  lastBrushY = screenY;

  // Dalga sayısını limitla
  if (activeWaves.length >= MAX_WAVES) {
    activeWaves.shift(); // en eskiyi at
  }

  activeWaves.push({
    x: screenX,
    y: screenY,
    startTime: frameCount
  });
}

// Mouse fırça (masaüstü)
function mouseMoved() {
  addBrushWave(mouseX, mouseY);
}

// İlk tıklamada da dalga olsun
function mouseDragged() {
  addBrushWave(mouseX, mouseY);
}

// Touch fırça (iPad / telefon)
function touchMoved() {
  for (let t of touches) {
    addBrushWave(t.x, t.y);
  }
  return false; // iOS scroll / zoom yapmasın
}

function touchStarted() {
  if (touches.length > 0) {
    addBrushWave(touches[0].x, touches[0].y);
  }
  return false;
}
