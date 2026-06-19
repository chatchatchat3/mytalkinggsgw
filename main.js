const el = (id) => document.getElementById(id);

const leftOpen = el("left-eye-open");
const leftClosed = el("left-eye-closed");
const rightOpen = el("right-eye-open");
const rightClosed = el("right-eye-closed");
const mouthClosed = el("mouth-closed");
const mouthOpen = el("mouth-open");
const tongue = el("tongue");
const btn = el("talk");
const askBtn = el("ask");
const foodBtn = el("food");
const stage = el("stage");
const foodCount = el("food-count");
const character = el("character");
const coalitionBtn = el("coalition");
const buttons2 = el("buttons-2");
let foodEaten = 0;
const animatedClones = [];
let pairCount = 0;
let bgScaleX = 1;
let lastScale = 1;
let activeFood = 0;

const MAX_ON_SCREEN_FOOD = 15;

let isTalking = false;
let mouthIsOpen = false;

function setMouth(open) {
  mouthIsOpen = open;
  mouthOpen.classList.toggle("hidden", !open);
  mouthClosed.classList.toggle("hidden", open);
  if (open) tongue.classList.add("hidden");
}

function blink(openEl, closedEl) {
  openEl.classList.add("hidden");
  closedEl.classList.remove("hidden");
  setTimeout(() => {
    closedEl.classList.add("hidden");
    openEl.classList.remove("hidden");
  }, 120);
}

function scheduleEye(openEl, closedEl) {
  setTimeout(
    () => {
      blink(openEl, closedEl);
      scheduleEye(openEl, closedEl);
    },
    2000 + Math.random() * 4000,
  );
}

scheduleEye(leftOpen, leftClosed);
scheduleEye(rightOpen, rightClosed);

function scheduleTongue() {
  setTimeout(
    () => {
      if (!mouthIsOpen && !isTalking) {
        tongue.classList.remove("hidden");
        setTimeout(
          () => tongue.classList.add("hidden"),
          700 + Math.random() * 1200,
        );
      }
      scheduleTongue();
    },
    4000 + Math.random() * 6000,
  );
}

scheduleTongue();

let audioCtx;
let mediaRecorder;
let stream;
let chunks = [];
let recording = false;
let starting = false;
let cancelStart = false;
let maxTimer;
let askMode = false;

let PITCH = 2.0;
let SPEED = 1.2;
let RESPONSE_PITCH = 2.0;

const FOODS = [
  "sprites/food/food_r0_c0.png","sprites/food/food_r0_c1.png","sprites/food/food_r0_c2.png",
  "sprites/food/food_r0_c3.png","sprites/food/food_r0_c4.png","sprites/food/food_r0_c5.png",
  "sprites/food/food_r0_c6.png","sprites/food/food_r0_c7.png","sprites/food/food_r1_c0.png",
  "sprites/food/food_r1_c2.png","sprites/food/food_r1_c3.png","sprites/food/food_r1_c4.png",
  "sprites/food/food_r1_c5.png","sprites/food/food_r1_c6.png","sprites/food/food_r1_c7.png",
  "sprites/food/food_r1_c9.png","sprites/food/food_r2_c0.png","sprites/food/food_r2_c1.png",
  "sprites/food/food_r2_c2.png","sprites/food/food_r2_c3.png","sprites/food/food_r2_c4.png",
  "sprites/food/food_r2_c5.png","sprites/food/food_r2_c6.png","sprites/food/food_r2_c7.png",
  "sprites/food/food_r2_c8.png","sprites/food/food_r3_c0.png","sprites/food/food_r3_c1.png",
  "sprites/food/food_r3_c2.png","sprites/food/food_r3_c3.png","sprites/food/food_r3_c4.png",
  "sprites/food/food_r3_c5.png","sprites/food/food_r3_c6.png","sprites/food/food_r3_c7.png",
  "sprites/food/food_r4_c3.png","sprites/food/food_r4_c4.png","sprites/food/food_r4_c5.png",
  "sprites/food/food_r4_c6.png","sprites/food/food_r4_c7.png","sprites/food/food_r5_c3.png",
  "sprites/food/food_r5_c4.png","sprites/food/food_r5_c5.png","sprites/food/food_r5_c6.png",
];

const RESPONSES = [
  "audio/response/talking-bennnn-noo.mp3",
  "audio/response/talking-benn-yes.mp3",
  "audio/response/talking-benn-ughhh.mp3",
  "audio/response/ho-ho-ho-ben.mp3",
];

async function startRec(isAsk = false) {
  if (recording || starting) return;
  starting = true;
  cancelStart = false;
  askMode = isAsk;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    starting = false;
    alert("Microphone access is needed to talk back.");
    return;
  }

  starting = false;
  if (cancelStart) {
    stream.getTracks().forEach((t) => t.stop());
    return;
  }

  chunks = [];
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  mediaRecorder.onstop = handleStop;
  mediaRecorder.start();
  recording = true;

  const activeBtn = askMode ? askBtn : btn;
  activeBtn.classList.add("recording");
  activeBtn.textContent = "Stop";

  maxTimer = setTimeout(stopRec, 600000);
}

function stopRec() {
  if (starting) {
    cancelStart = true;
    return;
  }
  if (!recording) return;
  recording = false;
  clearTimeout(maxTimer);
  if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
  if (stream) stream.getTracks().forEach((t) => t.stop());

  const activeBtn = askMode ? askBtn : btn;
  activeBtn.classList.remove("recording");
  activeBtn.textContent = askMode ? "Ask Question" : "Talk";
}

async function handleStop() {
  if (askMode) {
    setTimeout(playResponse, 800);
  } else {
    if (!chunks.length) return;
    const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
    const buf = await audioCtx.decodeAudioData(await blob.arrayBuffer());
    playPitched(buf);
  }
}

async function playResponse() {
  if (audioCtx.state === "suspended") await audioCtx.resume();
  const path = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];
  const arrayBuf = await fetch(path).then((r) => r.arrayBuffer());
  const buf = await audioCtx.decodeAudioData(arrayBuf);

  const src = audioCtx.createBufferSource();
  src.buffer = timeStretch(buf, RESPONSE_PITCH);
  src.playbackRate.value = RESPONSE_PITCH;

  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 1024;
  src.connect(analyser);
  analyser.connect(audioCtx.destination);

  const data = new Uint8Array(analyser.fftSize);
  const THRESHOLD = 0.04;

  isTalking = true;
  tongue.classList.add("hidden");

  function loop() {
    if (!isTalking) return;
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    setMouth(Math.sqrt(sum / data.length) > THRESHOLD);
    requestAnimationFrame(loop);
  }

  src.onended = () => {
    isTalking = false;
    setMouth(false);
  };
  src.start();
  loop();
}

function timeStretch(buf, factor) {
  if (Math.abs(factor - 1) < 0.001) return buf;
  const { numberOfChannels, length, sampleRate } = buf;
  const frame = 2048;
  const synHop = frame >> 1;
  const anaHop = Math.max(1, Math.round(synHop / factor));
  const seek = 512;
  const outLen = Math.floor(length * factor) + frame;

  const win = new Float32Array(frame);
  for (let i = 0; i < frame; i++)
    win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frame - 1));

  const out = audioCtx.createBuffer(numberOfChannels, outLen, sampleRate);
  const template = new Float32Array(frame);

  for (let ch = 0; ch < numberOfChannels; ch++) {
    const input = buf.getChannelData(ch);
    const output = out.getChannelData(ch);
    let haveTemplate = false;
    let outPos = 0;
    let frameIdx = 0;

    while (outPos + frame < outLen) {
      const anaPos = frameIdx * anaHop;

      let delta = 0;
      if (haveTemplate) {
        let best = -Infinity;
        for (let d = -seek; d <= seek; d++) {
          const p = anaPos + d;
          if (p < 0 || p + frame >= length) continue;
          let corr = 0;
          for (let i = 0; i < frame; i += 8) corr += input[p + i] * template[i];
          if (corr > best) {
            best = corr;
            delta = d;
          }
        }
      }

      const p = Math.max(0, Math.min(length - frame - 1, anaPos + delta));
      for (let i = 0; i < frame; i++) output[outPos + i] += input[p + i] * win[i];

      const t0 = p + synHop;
      for (let i = 0; i < frame; i++) template[i] = input[t0 + i] || 0;
      haveTemplate = true;

      outPos += synHop;
      frameIdx++;
    }
  }
  return out;
}

function playPitched(buf) {
  const src = audioCtx.createBufferSource();
  src.buffer = timeStretch(buf, PITCH / SPEED);
  src.playbackRate.value = PITCH;

  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 1024;
  src.connect(analyser);
  analyser.connect(audioCtx.destination);

  const data = new Uint8Array(analyser.fftSize);
  const THRESHOLD = 0.04;

  isTalking = true;
  tongue.classList.add("hidden");

  function loop() {
    if (!isTalking) return;
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length);
    setMouth(rms > THRESHOLD);
    requestAnimationFrame(loop);
  }

  src.onended = () => {
    isTalking = false;
    setMouth(false);
  };
  src.start();
  loop();
}

async function playMunch() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") await audioCtx.resume();
  const arrayBuf = await fetch("audio/munch-sound-effect.mp3").then((r) => r.arrayBuffer());
  const buf = await audioCtx.decodeAudioData(arrayBuf);
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const gain = audioCtx.createGain();
  gain.gain.value = 0.5;
  src.connect(gain);
  gain.connect(audioCtx.destination);
  src.start();
}

function registerFood(n = 1) {
  foodEaten += n;
  foodCount.textContent = `Food: ${foodEaten}`;
  const scale = 1 + foodEaten * 0.002;
  if (Math.abs(scale - lastScale) >= 0.005) {
    lastScale = scale;
    stage.style.setProperty("--lizard-scale", scale);
  }
  if (foodEaten > 0) buttons2.classList.remove("hidden");
  updateCoalition();
}

function animateFeed(mouthOffsetX, mouthOffsetY, setMouthOpen, onEaten) {
  activeFood++;
  const img = document.createElement("img");
  img.src = FOODS[Math.floor(Math.random() * FOODS.length)];
  img.style.cssText =
    "position:absolute;width:32px;height:32px;object-fit:contain;pointer-events:none;user-select:none;z-index:10;image-rendering:pixelated;";

  const sw = stage.offsetWidth;
  const sh = stage.offsetHeight;
  const size = 32;

  const mouthX = sw * 0.445 - size / 2 + mouthOffsetX;
  const mouthY = sh * 0.555 - size / 2 + mouthOffsetY;

  const edge = Math.floor(Math.random() * 4);
  let sx, sy;
  if (edge === 0) { sx = -size; sy = Math.random() * sh; }
  else if (edge === 1) { sx = sw; sy = Math.random() * sh; }
  else if (edge === 2) { sx = Math.random() * sw; sy = -size; }
  else { sx = Math.random() * sw; sy = sh; }

  img.style.left = sx + "px";
  img.style.top = sy + "px";
  stage.appendChild(img);

  const dist = Math.hypot(mouthX - sx, mouthY - sy);
  const dur = 300 + dist * 0.9;

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      img.style.transition = `left ${dur}ms ease-in, top ${dur}ms ease-in`;
      img.style.left = mouthX + "px";
      img.style.top = mouthY + "px";
    })
  );

  setTimeout(() => setMouthOpen(true), Math.max(0, dur - 300));

  setTimeout(() => {
    img.remove();
    activeFood--;
    setMouthOpen(false);
    playMunch();
    if (onEaten) onEaten();
  }, dur);
}

function throwFood() {
  animateFeed(0, 0, setMouth, registerFood);
}

btn.addEventListener("click", () => {
  if (recording || starting) stopRec();
  else startRec(false);
});

askBtn.addEventListener("click", () => {
  if (recording || starting) stopRec();
  else startRec(true);
});

foodBtn.addEventListener("click", throwFood);

const CLONE_TRANSFORM = (xPct, yPct) =>
  `translateX(${xPct}%) translateY(${yPct}%) scaleX(var(--lizard-scale, 1))`;

let staticSpriteURL = null;
const pendingStaticImgs = [];

(function buildStaticSprite() {
  const srcs = [
    "sprites/lizard/lizard_body.png",
    "sprites/lizard/lizard_left_eye_open.png",
    "sprites/lizard/lizard_right_eye_open.png",
    "sprites/lizard/lizard_mouth.png",
  ];
  const imgs = srcs.map((src) => {
    const im = new Image();
    im.src = src;
    return im;
  });
  Promise.all(imgs.map((im) => im.decode().catch(() => {}))).then(() => {
    const w = imgs[0].naturalWidth || 1170;
    const h = imgs[0].naturalHeight || 1751;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.filter = "grayscale(100%)";
    const dx = -0.015 * w;
    const dy = -0.02 * h;
    imgs.forEach((im, i) => {
      if (i === 0) ctx.drawImage(im, 0, 0, w, h);
      else ctx.drawImage(im, dx, dy, w, h);
    });
    try {
      staticSpriteURL = canvas.toDataURL("image/png");
    } catch (e) {
      staticSpriteURL = "sprites/lizard/lizard_body.png";
      document.documentElement.classList.add("static-fallback");
    }
    for (const im of pendingStaticImgs) im.src = staticSpriteURL;
    pendingStaticImgs.length = 0;
  });
})();

function createStaticClone(xPct, yPct) {
  const img = document.createElement("img");
  img.className = "clone-static";
  img.alt = "";
  img.style.transform = CLONE_TRANSFORM(xPct, yPct);
  if (staticSpriteURL) img.src = staticSpriteURL;
  else pendingStaticImgs.push(img);
  return img;
}

function createAnimatedClone(xPct, yPct) {
  const div = document.createElement("div");
  div.className = "clone-lizard";
  div.style.transform = CLONE_TRANSFORM(xPct, yPct);

  const makeImg = (src, hidden = false) => {
    const img = document.createElement("img");
    img.src = src;
    img.className = "layer face" + (hidden ? " hidden" : "");
    img.alt = "";
    return img;
  };

  const body = document.createElement("img");
  body.src = "sprites/lizard/lizard_body.png";
  body.className = "layer";
  body.alt = "";

  const leftOpen   = makeImg("sprites/lizard/lizard_left_eye_open.png");
  const leftClosed = makeImg("sprites/lizard/lizard_left_eye_closed.png", true);
  const rightOpen  = makeImg("sprites/lizard/lizard_right_eye_open.png");
  const rightClosed= makeImg("sprites/lizard/lizard_right_eye_closed.png", true);
  const mClosed    = makeImg("sprites/lizard/lizard_mouth.png");
  const mOpen      = makeImg("sprites/lizard/lizard_mouth_open.png", true);
  const tongueel   = makeImg("sprites/lizard/lizard_tongue.png", true);

  div.append(body, leftOpen, leftClosed, rightOpen, rightClosed, mClosed, mOpen, tongueel);

  const setMouthOpen = (open) => {
    mOpen.classList.toggle("hidden", !open);
    mClosed.classList.toggle("hidden", open);
    if (open) tongueel.classList.add("hidden");
  };

  let blinking = false;
  const blink = () => {
    if (blinking) return;
    blinking = true;
    leftOpen.classList.add("hidden");  leftClosed.classList.remove("hidden");
    rightOpen.classList.add("hidden"); rightClosed.classList.remove("hidden");
    setTimeout(() => {
      leftClosed.classList.add("hidden");  leftOpen.classList.remove("hidden");
      rightClosed.classList.add("hidden"); rightOpen.classList.remove("hidden");
      blinking = false;
    }, 120);
  };

  const flickTongue = () => {
    if (mClosed.classList.contains("hidden")) return;
    tongueel.classList.remove("hidden");
    setTimeout(() => tongueel.classList.add("hidden"), 700 + Math.random() * 1200);
  };

  animatedClones.push({ xPct, yPct, setMouthOpen, blink, flickTongue });
  return div;
}

function createClone(xPct, yPct) {
  return yPct === 4
    ? createAnimatedClone(xPct, yPct)
    : createStaticClone(xPct, yPct);
}

setInterval(() => {
  for (const c of animatedClones) {
    if (Math.random() < 0.12) c.blink();
    if (Math.random() < 0.04) c.flickTongue();
  }
}, 350);

function sampleTriggers(n, p) {
  if (n <= 64) {
    let c = 0;
    for (let i = 0; i < n; i++) if (Math.random() < p) c++;
    return c;
  }
  const mean = n * p;
  const sd = Math.sqrt(n * p * (1 - p));
  const z = Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
  return Math.max(0, Math.round(mean + z * sd));
}

setInterval(() => {
  const totalClones = pairCount * 2;
  if (totalClones > 0) {
    const triggers = sampleTriggers(totalClones, 0.05);
    if (triggers > 0) registerFood(triggers);
  }

  const sw = stage.offsetWidth;
  const sh = stage.offsetHeight;
  for (const c of animatedClones) {
    if (activeFood >= MAX_ON_SCREEN_FOOD) break;
    if (Math.random() < 0.05) {
      const ox = (c.xPct / 100) * sw;
      const oy = ((c.yPct - 4) / 100) * sh;
      animateFeed(ox, oy, c.setMouthOpen, null);
    }
  }
}, 250);

const COALITION_COST = 50;

function updateCoalition() {
  const pct = Math.min(foodEaten / COALITION_COST, 1) * 100;
  coalitionBtn.style.setProperty("--fill", pct + "%");
  coalitionBtn.disabled = foodEaten < COALITION_COST;
}

const ROW_STEP_Y = 5;
const STACK_ROWS = 16;
const ROW_MAGS = [14.5, 29, 43.5, 58, 72.5, 87, 101.5, 116];
const pairSlots = [];
pairSlots.push({ mag: 58, yPct: 4, expand: true });
pairSlots.push({ mag: 116, yPct: 4, expand: true });
for (const mag of [29, 87]) pairSlots.push({ mag, yPct: 4, expand: false });
for (let row = 1; row <= STACK_ROWS; row++) {
  for (const mag of ROW_MAGS) {
    pairSlots.push({ mag, yPct: 4 - row * ROW_STEP_Y, expand: false });
  }
}

function summonPair() {
  const idx = pairCount++;
  if (idx >= pairSlots.length) {
    return;
  }
  const slot = pairSlots[idx];
  const left = createClone(-slot.mag, slot.yPct);
  const right = createClone(slot.mag, slot.yPct);
  const ref = el("background").nextSibling;
  stage.insertBefore(right, ref);
  stage.insertBefore(left, ref);
  if (slot.expand) {
    bgScaleX += 1.2;
    el("background").style.transform = `scaleX(${bgScaleX})`;
  }
}

coalitionBtn.addEventListener("click", () => {
  if (foodEaten < COALITION_COST) return;
  summonPair();
  foodEaten -= COALITION_COST;
  foodCount.textContent = `Food: ${foodEaten}`;
  updateCoalition();
});

if (new URLSearchParams(location.search).get("debug") === "true") {
  el("debug-panel").classList.remove("hidden");

  el("debug-add-food").addEventListener("click", () => {
    const n = Math.max(1, parseInt(el("debug-food-amount").value, 10) || 0);
    registerFood(n);
  });

  el("debug-add-clones").addEventListener("click", () => {
    const n = Math.max(1, parseInt(el("debug-clone-amount").value, 10) || 0);
    for (let i = 0; i < n; i++) summonPair();
  });
}
