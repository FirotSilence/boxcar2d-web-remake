// Canvas 渲染：天空渐变、双层视差远山、地形渐变填充、里程标、终点旗、车辆与平滑相机
export class Renderer {
  constructor(canvas, state) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = state;
    this.cam = { x: 6, y: 3, zoom: 34 };
    this._resize();
    addEventListener('resize', () => this._resize());
  }

  _resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.dpr = dpr;
    this.canvas.width = innerWidth * dpr;
    this.canvas.height = innerHeight * dpr;
    this.canvas.style.width = innerWidth + 'px';
    this.canvas.style.height = innerHeight + 'px';
  }

  v(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  sx(x) { return (x - this.cam.x) * this.cam.zoom + innerWidth / 2; }
  sy(y) { return innerHeight / 2 - (y - this.cam.y) * this.cam.zoom; }

  screenToWorld(px, py) {
    return {
      x: this.cam.x + (px - innerWidth / 2) / this.cam.zoom,
      y: this.cam.y - (py - innerHeight / 2) / this.cam.zoom,
    };
  }

  draw(sim) {
    const ctx = this.ctx;
    const W = innerWidth;
    const H = innerHeight;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // 平滑相机：优先跟随选中车，否则跟随领先车
    const sel = this.state.selected;
    const target = sel && sel.alive ? sel : sim.leader();
    if (!this.state.cameraFree && target) {
      const p = target.chassis.getPosition();
      this.cam.x += (p.x + 3 - this.cam.x) * 0.08;
      this.cam.y += (p.y + 1 - this.cam.y) * 0.05;
    }

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, this.v('--sky-top'));
    sky.addColorStop(1, this.v('--sky-bottom'));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    this._hills(ctx, W, H, 0.15, this.v('--hill-far'), 0.52, 14);
    this._hills(ctx, W, H, 0.35, this.v('--hill-near'), 0.66, 9);
    this._terrain(ctx, sim, H);
    this._markers(ctx, sim, W);
    for (const c of sim.cars) if (c.alive) this._car(ctx, c);
  }

  _hills(ctx, W, H, parallax, color, base, scale) {
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let px = 0; px <= W; px += 8) {
      const wx = this.cam.x * parallax + px / 40;
      const y = H * base - (Math.sin(wx * 0.7) * 0.5 + Math.sin(wx * 0.23 + 2) * 1.1 + Math.sin(wx * 0.057) * 2.2) * scale;
      ctx.lineTo(px, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  _terrain(ctx, sim, H) {
    const pts = sim.terrain;
    ctx.beginPath();
    ctx.moveTo(this.sx(pts[0].x), this.sy(pts[0].y));
    for (let i = 1; i < pts.length; i++) ctx.lineTo(this.sx(pts[i].x), this.sy(pts[i].y));
    ctx.lineTo(this.sx(pts[pts.length - 1].x), H + 60);
    ctx.lineTo(this.sx(pts[0].x), H + 60);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, this.v('--terrain-top'));
    g.addColorStop(1, this.v('--terrain-bottom'));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = this.v('--terrain-line');
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 终点旗
    const fx = sim.finishX - 1;
    const x = this.sx(fx);
    const y = this.sy(this._groundY(sim, fx));
    ctx.strokeStyle = this.v('--text');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 46);
    ctx.stroke();
    ctx.fillStyle = this.v('--accent');
    ctx.beginPath();
    ctx.moveTo(x, y - 46);
    ctx.lineTo(x + 26, y - 39);
    ctx.lineTo(x, y - 32);
    ctx.closePath();
    ctx.fill();
  }

  _groundY(sim, x) {
    const pts = sim.terrain;
    for (let i = 1; i < pts.length; i++) {
      if (pts[i].x >= x) {
        const a = pts[i - 1];
        const b = pts[i];
        const t = (x - a.x) / Math.max(1e-6, b.x - a.x);
        return a.y + (b.y - a.y) * t;
      }
    }
    return 0;
  }

  _markers(ctx, sim, W) {
    const z = this.cam.zoom;
    const minX = this.cam.x - W / (2 * z);
    const maxX = this.cam.x + W / (2 * z);
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let m = Math.max(50, Math.ceil(minX / 50) * 50); m <= maxX && m < sim.finishX; m += 50) {
      const x = this.sx(m);
      const y = this.sy(this._groundY(sim, m));
      ctx.strokeStyle = this.v('--marker');
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - 26);
      ctx.stroke();
      ctx.fillStyle = this.v('--text-dim');
      ctx.fillText(m + 'm', x, y - 32);
    }
  }

  _car(ctx, c) {
    const z = this.cam.zoom;
    const hue = (c.index * 137.5) % 360;
    const sel = this.state.selected === c;

    // 轮子（含转动辐条）
    for (const w of c.wheels) {
      const p = w.body.getPosition();
      const a = w.body.getAngle();
      const x = this.sx(p.x);
      const y = this.sy(p.y);
      const r = w.radius * z;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue}, 25%, 30%, 0.9)`;
      ctx.fill();
      ctx.lineWidth = Math.max(1.5, r * 0.18);
      ctx.strokeStyle = `hsl(${hue}, 60%, 70%)`;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * r * 0.85, y - Math.sin(a) * r * 0.85);
      ctx.stroke();
    }

    // 车身多边形
    const pos = c.chassis.getPosition();
    const ang = c.chassis.getAngle();
    ctx.save();
    ctx.translate(this.sx(pos.x), this.sy(pos.y));
    ctx.rotate(-ang);
    ctx.beginPath();
    ctx.moveTo(c.verts[0].x * z, -c.verts[0].y * z);
    for (let i = 1; i < c.verts.length; i++) ctx.lineTo(c.verts[i].x * z, -c.verts[i].y * z);
    ctx.closePath();
    if (sel) {
      ctx.shadowColor = `hsl(${hue}, 90%, 60%)`;
      ctx.shadowBlur = 18;
    }
    ctx.fillStyle = `hsla(${hue}, 70%, 55%, 0.85)`;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2;
    ctx.strokeStyle = `hsl(${hue}, 80%, 70%)`;
    ctx.stroke();
    ctx.restore();

    // 编号标签
    const top = Math.max(...c.genome.verts) * z + 10;
    ctx.fillStyle = this.v('--text-dim');
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('#' + (c.index + 1), this.sx(pos.x), this.sy(pos.y) - top);
  }
}
