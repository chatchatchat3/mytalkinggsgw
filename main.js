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
let foodEaten = 0;

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
  src.connect(audioCtx.destination);
  src.start();
}

function throwFood() {
  const img = document.createElement("img");
  img.src = FOODS[Math.floor(Math.random() * FOODS.length)];
  img.style.cssText =
    "position:absolute;width:32px;height:32px;object-fit:contain;pointer-events:none;user-select:none;z-index:10;image-rendering:pixelated;";

  const sw = stage.offsetWidth;
  const sh = stage.offsetHeight;
  const size = 32;

  const mouthX = sw * 0.445 - size / 2;
  const mouthY = sh * 0.555 - size / 2;

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

  setTimeout(() => setMouth(true), Math.max(0, dur - 300));

  setTimeout(() => {
    img.remove();
    setMouth(false);
    playMunch();
    foodCount.textContent = `Food eaten: ${++foodEaten}`;
  }, dur);
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
