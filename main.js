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

let PITCH = 2.0;
let SPEED = 1.2;
let RESPONSE_PITCH = 2.0;

const RESPONSES = [
  "audio/response/talking-bennnn-noo.mp3",
  "audio/response/talking-benn-yes.mp3",
  "audio/response/talking-benn-ughhh.mp3",
  "audio/response/ho-ho-ho-ben.mp3",
];

async function startRec() {
  if (recording || starting) return;
  starting = true;
  cancelStart = false;
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
  btn.classList.add("recording");
  btn.textContent = "Stop";

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
  btn.classList.remove("recording");
  btn.textContent = "Talk";
}

async function handleStop() {
  if (!chunks.length) return;
  const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
  const buf = await audioCtx.decodeAudioData(await blob.arrayBuffer());
  playPitched(buf);
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

btn.addEventListener("click", () => {
  if (recording || starting) stopRec();
  else startRec();
});

askBtn.addEventListener("click", () => {
  if (!audioCtx)
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  setTimeout(playResponse, 800);
});
