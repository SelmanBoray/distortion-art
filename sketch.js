/* ===============================
        GLOBAL STATE
=============================== */

let appState = "menu";   // "menu" or "app"

let menuImages = [];
let menuOptions = [
  { name: "Goril", file: "Goril.jpg" },
  { name: "Geyik", file: "Geyik.jpg" },
  { name: "Leopar", file: "Leopar.jpg" }
];

let selectedImageFile = null;


/* ===============================
       DISTORTION VARIABLES
=============================== */

let img;
let imgX, imgY;
let imgWidth, imgHeight;

let AFFECTED_RADIUS = 30;
let WAVE_STRENGTH = 15;
const WAVE_LIFETIME = 60;
const MAX_WAVES = 300;
const BRUSH_SPACING = 6;

let lastBrushX = null;
let lastBrushY = null;

let activeWaves = [];
let baseG;
let pg;


/* ===============================
            PRELOAD
=============================== */

function preload() {
  // Menüde görüntülenecek 3 resim
  menuImages = [
    loadImage("Goril.jpg"),
    loadImage("Geyik.jpg"),
    loadImage("Leopar.jpg")
  ];
}


/* ===============================
            SETUP
=============================== */

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);

  document.addEventListener("touchmove", e => e.preventDefault(), { passive: false });
}


/* ===============================
            WINDOW RESIZE
=============================== */

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

  if (appState === "app") {
    setupImageBuffers();
  }
}


/* ===============================
         DRAW (STATE MACHINE)
=============================== */

function draw() {
  if (appState === "menu") {
    drawMenu();
    return;
  }

  if (appState === "app") {
    drawDistortion();
    return;
  }
}


/* ===============================
            MENU DRAW
=============================== */

function drawMenu() {
  background(0);

  textAlign(CENTER, CENTER);
  textSize(40);
  fill(255);
  text("Bir Görsel Seç", width / 2, 80);

  let spacing = width / 3;
  let y = height / 2;

  for (let i = 0; i < 3; i++) {
    let x = spacing * (i + 0.5);

    let imgW = width * 0.25;
    let imgH = imgW * 0.75;

    // Görsel
    imageMode(CENTER);
    image(menuImages[i], x, y, imgW, imgH);

    // İsim
    fill(255);
    textSize(28);
    text(menuOptions[i].name, x, y + imgH / 2 + 40);
  }
}


/* ===============================
          MENU CLICK / TOUCH
=============================== */

function mousePressed() {
  if (appState === "menu") handleMenuPress(mouseX, mouseY);
}

function touchStarted() {
  if (appState === "menu") handleMenuPress(touches[0].x, touches[0].y);
}

function handleMenuPress(px, py) {
  let spacing = width / 3;
  let y = height / 2;
  let imgW = width * 0.25;
  let imgH = imgW * 0.75;

  for (let i = 0; i < 3; i++) {
    let x = spacing * (i + 0.5);

    if (px > x - imgW/2 && px < x + imgW/2 &&
        py > y - imgH/2 && py < y + imgH/2) {

      selectedImageFile = menuOptions[i].file;
      loadSelectedImage();
      return;
    }
  }
}


/* ===============================
       LOAD SELECTED IMAGE
=============================== */

function loadSelectedImage() {
  img = loadImage(selectedImageFile, () => {
    appState = "app";
    setupImageBuffers();
  });
}


/* ===============================
       DISTORTION SETUP
=============================== */

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


/* ===============================
        DISTORTION DRAW
=============================== */

function drawDistortion() {
  background(0);

  activeWaves = activeWaves.filter(w => (frameCount - w.startTime) < WAVE_LIFETIME);

  if (activeWaves.length === 0) {
    image(baseG, imgX, imgY);
    return;
  }

  baseG.loadPixels();
  pg.loadPixels();

  for (let i = 0; i < baseG.pixels.length; i++) {
    pg.pixels[i] = baseG.pixels[i];
  }

  for (let wave of activeWaves) {
    applyWave(wave);
  }

  pg.updatePixels();
  image(pg, imgX, imgY);
}


/* ===============================
          APPLY WAVE
=============================== */

function applyWave(wave) {
  let waveAge = frameCount - wave.startTime;
  let fadeFactor = 1 - (waveAge / WAVE_LIFETIME);

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

          let srcIndex = (sy * i*
