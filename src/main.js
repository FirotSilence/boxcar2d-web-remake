// 主入口：配置、主循环（物理与渲染解耦）、画布交互、导入导出与本地存档
import { Simulation, DT } from './simulation.js';
import { Renderer } from './render.js';
import { UI } from './ui.js';

const cfg = {
  populationSize: 20,
  mutationRate: 0.15,
  mutationAmount: 0.25,
  eliteCount: 2,
  minWheels: 2,
  maxWheels: 6,
  stallTimeout: 4,
  gravity: 9.8,
  difficulty: 0.45,
  seed: String(Math.floor(Math.random() * 1e9)),
  trackLength: 1000,
};

const state = { speed: 1, paused: false, selected: null, cameraFree: false };
const canvas = document.getElementById('world');
const renderer = new Renderer(canvas, state);

let sim;
const ctx = { cfg, state, renderer, getSim: () => sim, resetAll, applyWorld, exportBest, importFile, loadLocal, clearLocal };
const ui = new UI(ctx);

function attach(s) {
  sim = s;
  sim.onGeneration = () => {
    state.selected = null;
    ui.onGeneration(sim);
    saveLocal();
  };
}
attach(new Simulation(cfg));
ui.onGeneration(sim);

function resetAll() {
  attach(new Simulation(cfg));
  state.selected = null;
  ui.onGeneration(sim);
}

function applyWorld() {
  state.selected = null;
  sim.rebuildWorld();
}

function exportBest() {
  const b = sim.bestEver;
  if (!b) { alert('还没有最佳基因，先让进化跑完一代吧'); return; }
  const blob = new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `boxcar-gen${b.generation + 1}-${b.fitness.toFixed(0)}m.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importFile(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const genome = data.genome || data;
    if (!genome.verts || !genome.wheels) throw new Error('bad genome');
    state.selected = null;
    sim.seedFrom(genome);
  } catch {
    alert('导入失败：文件格式不正确');
  }
}

const SAVE_KEY = 'boxcar2d.save';
function saveLocal() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ bestEver: sim.bestEver, history: sim.history }));
  } catch { /* 存储满时静默失败 */ }
}
function loadLocal() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) { alert('没有本地存档'); return; }
  try {
    const d = JSON.parse(raw);
    if (d.bestEver) {
      sim.bestEver = d.bestEver;
      sim.history = d.history || [];
      state.selected = null;
      sim.seedFrom(d.bestEver.genome);
      ui.onGeneration(sim);
    }
  } catch {
    alert('存档已损坏');
  }
}
function clearLocal() {
  localStorage.removeItem(SAVE_KEY);
  alert('本地存档已清除');
}

// ---- 画布交互：点选小车 / 拖拽平移 / 滚轮缩放 ----
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, cx: renderer.cam.x, cy: renderer.cam.y, moved: false };
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  if (Math.hypot(dx, dy) > 5) drag.moved = true;
  if (drag.moved) {
    state.cameraFree = true;
    document.getElementById('btn-follow').hidden = false;
    renderer.cam.x = drag.cx - dx / renderer.cam.zoom;
    renderer.cam.y = drag.cy + dy / renderer.cam.zoom;
  }
});
addEventListener('pointerup', (e) => {
  if (drag && !drag.moved) {
    const w = renderer.screenToWorld(e.clientX, e.clientY);
    let hit = null;
    let best = 2.5;
    for (const c of sim.cars) {
      if (!c.alive) continue;
      const p = c.chassis.getPosition();
      const d = Math.hypot(p.x - w.x, p.y - w.y);
      if (d < best) { best = d; hit = c; }
    }
    state.selected = hit;
    if (hit) ui.showDetail(hit);
  }
  drag = null;
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  renderer.cam.zoom = Math.min(90, Math.max(8, renderer.cam.zoom * (e.deltaY < 0 ? 1.1 : 0.9)));
}, { passive: false });
addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !/INPUT|TEXTAREA/.test(e.target.tagName)) {
    e.preventDefault();
    document.getElementById('btn-pause').click();
  }
});

// ---- 主循环：物理步进与渲染解耦，MAX 档按帧时间预算狂奔 ----
function frame() {
  if (!state.paused) {
    if (state.speed === 'max') {
      const t0 = performance.now();
      do {
        for (let i = 0; i < 4; i++) sim.step(DT);
      } while (performance.now() - t0 < 12);
    } else {
      for (let i = 0; i < state.speed; i++) sim.step(DT);
    }
  }
  renderer.draw(sim);
  ui.refresh(sim);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
