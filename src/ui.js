// 控制面板：参数滑条、速度/暂停/主题、排行榜、车辆详情、曲线重绘
import { decodeWheels } from './genome.js';
import { drawChart } from './chart.js';

export class UI {
  constructor(ctx) {
    this.ctx = ctx;
    this._frame = 0;
    this._bind();
  }

  $(id) { return document.getElementById(id); }

  _bind() {
    const { cfg, state } = this.ctx;

    const slider = (id, vid, key, fmt = (v) => v) => {
      const el = this.$(id);
      el.value = cfg[key];
      this.$(vid).textContent = fmt(cfg[key]);
      el.addEventListener('input', () => {
        cfg[key] = parseFloat(el.value);
        this.$(vid).textContent = fmt(cfg[key]);
      });
    };
    slider('in-pop', 'v-pop', 'populationSize');
    slider('in-mut', 'v-mut', 'mutationRate', (v) => Math.round(v * 100) + '%');
    slider('in-amp', 'v-amp', 'mutationAmount', (v) => Math.round(v * 100) + '%');
    slider('in-elite', 'v-elite', 'eliteCount');
    slider('in-minw', 'v-minw', 'minWheels');
    slider('in-maxw', 'v-maxw', 'maxWheels');
    slider('in-stall', 'v-stall', 'stallTimeout', (v) => v + 's');
    slider('in-diff', 'v-diff', 'difficulty', (v) => Math.round(v * 100) + '%');

    // 重力实时生效
    const grav = this.$('in-grav');
    grav.value = cfg.gravity;
    this.$('v-grav').textContent = cfg.gravity.toFixed(1);
    grav.addEventListener('input', () => {
      cfg.gravity = parseFloat(grav.value);
      this.$('v-grav').textContent = cfg.gravity.toFixed(1);
      this.ctx.getSim().world.setGravity(window.planck.Vec2(0, -cfg.gravity));
    });

    this.$('in-seed').value = cfg.seed;
    this.$('btn-dice').addEventListener('click', () => {
      this.$('in-seed').value = String(Math.floor(Math.random() * 1e9));
    });
    this.$('btn-apply').addEventListener('click', () => {
      cfg.seed = this.$('in-seed').value.trim() || '0';
      this.ctx.applyWorld();
    });

    this.$('speed-group').querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => {
        state.speed = b.dataset.speed === 'max' ? 'max' : parseInt(b.dataset.speed, 10);
        this.$('speed-group').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
      }));

    this.$('btn-pause').addEventListener('click', () => {
      state.paused = !state.paused;
      this.$('btn-pause').textContent = state.paused ? '▶ 继续' : '⏸ 暂停';
    });
    this.$('btn-skip').addEventListener('click', () => this.ctx.getSim().skip());
    this.$('btn-theme').addEventListener('click', () => {
      const root = document.documentElement;
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      this.$('btn-theme').textContent = root.dataset.theme === 'dark' ? '🌙' : '☀️';
      this.redrawChart();
    });

    this.$('btn-reset').addEventListener('click', () => this.ctx.resetAll());
    this.$('btn-export').addEventListener('click', () => this.ctx.exportBest());
    this.$('btn-import').addEventListener('click', () => this.$('file-import').click());
    this.$('file-import').addEventListener('change', (e) => {
      this.ctx.importFile(e.target.files[0]);
      e.target.value = '';
    });
    this.$('btn-load').addEventListener('click', () => this.ctx.loadLocal());
    this.$('btn-clear').addEventListener('click', () => this.ctx.clearLocal());
    this.$('btn-follow').addEventListener('click', () => {
      state.cameraFree = false;
      this.$('btn-follow').hidden = true;
    });
  }

  refresh(sim) {
    this._frame++;
    this.$('stat-gen').textContent = sim.generation + 1;
    const alive = sim.cars.filter((c) => c.alive).length;
    this.$('stat-alive').textContent = alive + '/' + sim.cars.length;
    const lead = sim.leader();
    this.$('stat-best').textContent = (lead ? lead.bestX : 0).toFixed(1) + ' m';
    this.$('stat-record').textContent = (sim.bestEver ? sim.bestEver.fitness : 0).toFixed(1) + ' m';
    if (this._frame % 15 === 0) {
      this._leaderboard(sim);
      if (this.ctx.state.selected) this.showDetail(this.ctx.state.selected);
    }
  }

  _leaderboard(sim) {
    const ol = this.$('leaderboard');
    const top = sim.cars.filter((c) => c.alive).sort((a, b) => b.bestX - a.bestX).slice(0, 5);
    ol.innerHTML = top.map((c) => {
      const hue = (c.index * 137.5) % 360;
      return `<li data-i="${c.index}"><span class="dot" style="background:hsl(${hue},70%,55%)"></span>小车 #${c.index + 1}<b>${c.bestX.toFixed(1)} m</b></li>`;
    }).join('') || '<li class="muted">本代已结束</li>';
    ol.querySelectorAll('li[data-i]').forEach((li) =>
      li.addEventListener('click', () => {
        const car = sim.cars[parseInt(li.dataset.i, 10)];
        this.ctx.state.selected = car;
        this.showDetail(car);
      }));
  }

  showDetail(c) {
    const { cfg } = this.ctx;
    const g = c.genome;
    const wheels = decodeWheels(g, cfg.minWheels, cfg.maxWheels);
    this.$('car-detail').innerHTML = `
      <div class="kv"><span>编号</span><b>#${c.index + 1}</b></div>
      <div class="kv"><span>当前距离</span><b>${c.bestX.toFixed(1)} m</b></div>
      <div class="kv"><span>状态</span><b>${c.finished ? '🏁 抵达终点' : c.alive ? '行驶中' : '已淘汰'}</b></div>
      <div class="kv"><span>车身密度</span><b>${g.chassisDensity.toFixed(0)}</b></div>
      <div class="kv"><span>顶点幅值</span><b>${g.verts.map((v) => v.toFixed(1)).join(' / ')}</b></div>
      <div class="kv"><span>轮子数量</span><b>${wheels.length}</b></div>
      ${wheels.map((i) => {
        const w = g.wheels[i];
        return `<div class="wheel">轮 ${i + 1} · 半径 ${w.radius.toFixed(2)}m · 扭矩 ${w.torque.toFixed(0)} · 转速 ${w.speed.toFixed(0)} rad/s</div>`;
      }).join('')}`;
  }

  onGeneration(sim) {
    this.redrawChart(sim);
    this._leaderboard(sim);
  }

  redrawChart(sim) {
    drawChart(this.$('chart'), (sim || this.ctx.getSim()).history);
  }
}
