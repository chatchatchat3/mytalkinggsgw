const {
  Engine,
  Render,
  Runner,
  World,
  Bodies,
  Body,
  Composite,
  Constraint,
  Events,
  Common,
} = Matter;

const WIDTH = 500;
const HEIGHT = 640;
const WALL = 30;
const SCORE_LINE_Y = 560;
const REST_SPEED = 1.2;

const BUCKETS = [10, 5, 3, 2, 1, 1, 2, 3, 5, 10];

const engine = Engine.create();
engine.gravity.y = 1;

const canvas = document.getElementById("board");
const render = Render.create({
  canvas,
  engine,
  options: {
    width: WIDTH,
    height: HEIGHT,
    wireframes: false,
    background: "#00e000",
  },
});

Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);

function makeWalls() {
  const opts = { isStatic: true, render: { fillStyle: "#888" } };
  return [
    Bodies.rectangle(WIDTH / 2, HEIGHT + WALL / 2, WIDTH, WALL, opts),
    Bodies.rectangle(-WALL / 2, HEIGHT / 2, WALL, HEIGHT, opts),
    Bodies.rectangle(WIDTH + WALL / 2, HEIGHT / 2, WALL, HEIGHT, opts),
  ];
}

function makePegs() {
  const pegs = [];
  const top = 110;
  const rows = 9;
  const rowGap = 46;
  const colGap = 46;
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : colGap / 2;
    const cols = Math.floor((WIDTH - 2 * offset) / colGap);
    const rowWidth = (cols - 1) * colGap;
    const startX = (WIDTH - rowWidth) / 2;
    for (let c = 0; c < cols; c++) {
      const x = startX + c * colGap;
      const y = top + r * rowGap;
      pegs.push(
        Bodies.circle(x, y, 5, {
          isStatic: true,
          restitution: 0.3,
          friction: 0.02,
          render: { fillStyle: "#999" },
        })
      );
    }
  }
  return pegs;
}

function makeBuckets() {
  const dividers = [];
  const zones = [];
  const n = BUCKETS.length;
  const slotW = WIDTH / n;
  const wallTop = SCORE_LINE_Y - 20;
  const wallH = HEIGHT - wallTop;

  for (let i = 0; i <= n; i++) {
    const x = i * slotW;
    dividers.push(
      Bodies.rectangle(x, wallTop + wallH / 2, 6, wallH, {
        isStatic: true,
        render: { fillStyle: "#555" },
      })
    );
  }
  for (let i = 0; i < n; i++) {
    zones.push({
      minX: i * slotW,
      maxX: (i + 1) * slotW,
      value: BUCKETS[i],
      cx: i * slotW + slotW / 2,
    });
  }
  return { dividers, zones };
}

const { dividers, zones } = makeBuckets();

World.add(engine.world, makeWalls());
World.add(engine.world, makePegs());
World.add(engine.world, dividers);

const HORSE_SCALE = 0.85;
const HEAD_SCALE = 1.3;
const SPRITE_SCALE = HORSE_SCALE;
const PART_ART = {
  torso: { texture: "sprites/horse/torso.png", w: 44, h: 26 },
  head: { texture: "sprites/horse/head.png", w: 26 * HEAD_SCALE, h: 22 * HEAD_SCALE },
  leg: { texture: "sprites/horse/leg.png", w: 12, h: 22 },
};

let spritesReady = false;
const loadedTextures = {};

function preloadSprites() {
  const keys = Object.keys(PART_ART);
  let pending = keys.length;
  let allOk = true;
  keys.forEach((k) => {
    const img = new Image();
    img.onload = () => {
      loadedTextures[k] = img;
      if (--pending === 0) spritesReady = allOk;
    };
    img.onerror = () => {
      allOk = false;
      if (--pending === 0) spritesReady = allOk;
    };
    img.src = PART_ART[k].texture;
  });
}

function partRender(part, fallbackColor) {
  const img = loadedTextures[part];
  if (spritesReady && img) {
    const a = PART_ART[part];
    return {
      sprite: {
        texture: a.texture,
        xScale: (a.w * SPRITE_SCALE) / img.naturalWidth,
        yScale: (a.h * SPRITE_SCALE) / img.naturalHeight,
      },
    };
  }
  return { fillStyle: fallbackColor };
}

function makeHorse(x, y) {
  const s = HORSE_SCALE;
  const group = Body.nextGroup(true);
  const partOpts = {
    collisionFilter: { group },
    friction: 0.1,
    frictionAir: 0.008,
    restitution: 0.25,
    render: { fillStyle: "#444" },
  };

  const torso = Bodies.rectangle(x, y, 34 * s, 16 * s, {
    ...partOpts,
    render: partRender("torso", "#444"),
    label: "horse-torso",
  });

  const head = Bodies.rectangle(
    x + 22 * s,
    y - 10 * s,
    16 * s * HEAD_SCALE,
    13 * s * HEAD_SCALE,
    {
      ...partOpts,
      render: partRender("head", "#333"),
    }
  );

  const legDefs = [
    { dx: 12 * s, dy: 12 * s },
    { dx: 12 * s, dy: 12 * s },
    { dx: -12 * s, dy: 12 * s },
    { dx: -12 * s, dy: 12 * s },
  ];
  const legs = legDefs.map((d) =>
    Bodies.rectangle(x + d.dx, y + d.dy, 6 * s, 18 * s, {
      ...partOpts,
      render: partRender("leg", "#666"),
    })
  );

  const joints = [];
  const link = (a, b, pointA, pointB, stiffness) =>
    joints.push(
      Constraint.create({
        bodyA: a,
        bodyB: b,
        pointA,
        pointB,
        stiffness,
        length: 0,
        render: { visible: false },
      })
    );

  link(
    torso,
    head,
    { x: 17 * s, y: -6 * s },
    { x: -8 * s * HEAD_SCALE, y: 4 * s * HEAD_SCALE },
    0.6
  );
  link(torso, legs[0], { x: 12 * s, y: 8 * s }, { x: 0, y: -9 * s }, 0.5);
  link(torso, legs[1], { x: 12 * s, y: 8 * s }, { x: 0, y: -9 * s }, 0.5);
  link(torso, legs[2], { x: -12 * s, y: 8 * s }, { x: 0, y: -9 * s }, 0.5);
  link(torso, legs[3], { x: -12 * s, y: 8 * s }, { x: 0, y: -9 * s }, 0.5);

  const composite = Composite.create({ label: "horse" });
  Composite.add(composite, [torso, head, ...legs, ...joints]);

  Body.setAngularVelocity(torso, Common.random(-0.1, 0.1));

  return { composite, torso, head, scored: false, removeAt: 0 };
}

let score = 0;
let droppedCount = 0;
const horses = [];
const scoreEl = document.getElementById("score");
const droppedEl = document.getElementById("dropped");

function updateHud() {
  scoreEl.textContent = "Score: " + score;
  droppedEl.textContent = "Horses dropped: " + droppedCount;
}

function dropHorse(x) {
  const dropX = x ?? Common.random(WIDTH * 0.3, WIDTH * 0.7);
  const horse = makeHorse(dropX, 40);
  horses.push(horse);
  World.add(engine.world, horse.composite);
  droppedCount++;
  updateHud();
}

const HEAD_LIMIT = Math.PI / 4;

function normalizeAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

Events.on(engine, "afterUpdate", () => {
  const now = engine.timing.timestamp;
  for (const horse of horses) {
    const t = horse.torso;

    const rel = normalizeAngle(horse.head.angle - t.angle);
    if (rel > HEAD_LIMIT || rel < -HEAD_LIMIT) {
      const clamped = Math.max(-HEAD_LIMIT, Math.min(HEAD_LIMIT, rel));
      Body.setAngle(horse.head, t.angle + clamped);
      Body.setAngularVelocity(horse.head, t.angularVelocity);
    }

    if (!horse.scored && t.position.y > SCORE_LINE_Y) {
      const speed = Math.hypot(t.velocity.x, t.velocity.y);
      if (speed < REST_SPEED) {
        const zone = zones.find(
          (z) => t.position.x >= z.minX && t.position.x < z.maxX
        );
        if (zone) {
          score += zone.value;
          horse.scored = true;
          horse.removeAt = now + 1400;
          updateHud();
        }
      }
    }
  }

  for (let i = horses.length - 1; i >= 0; i--) {
    const horse = horses[i];
    if (horse.scored && now >= horse.removeAt) {
      World.remove(engine.world, horse.composite);
      horses.splice(i, 1);
    }
  }
});

Events.on(render, "afterRender", () => {
  const ctx = render.context;
  ctx.save();
  ctx.font = "bold 16px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const z of zones) {
    ctx.fillStyle = z.value >= 5 ? "#000" : "#888";
    ctx.fillText("x" + z.value, z.cx, HEIGHT - 22);
  }
  ctx.restore();
});

document.getElementById("drop").addEventListener("click", () => dropHorse());
document.getElementById("drop-many").addEventListener("click", () => {
  for (let i = 0; i < 5; i++) {
    setTimeout(() => dropHorse(), i * 220);
  }
});
document.getElementById("reset").addEventListener("click", () => {
  for (const horse of horses) World.remove(engine.world, horse.composite);
  horses.length = 0;
  score = 0;
  droppedCount = 0;
  updateHud();
});

canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * WIDTH;
  dropHorse(Math.max(WALL, Math.min(WIDTH - WALL, x)));
});

preloadSprites();
updateHud();
