const el = (id) => document.getElementById(id);

const leftOpen = el("left-eye-open");
const leftClosed = el("left-eye-closed");
const rightOpen = el("right-eye-open");
const rightClosed = el("right-eye-closed");
const mouthClosed = el("mouth-closed");
const mouthOpen = el("mouth-open");
const tongue = el("tongue");
const btn = el("talk");

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

// freaky tongue movement but only when mouth is closed
// freaky tongue emote

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

async function startRec() {
  if (recording || starting) return;
  starting = true;
  cancelStart = false;
  if (!audioCtx)
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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
    // button released before the mic was ready
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

  maxTimer = setTimeout(stopRec, 600000); // 10 minute cap
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

function playPitched(buf) {
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = 2.0; // higher pitch

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
