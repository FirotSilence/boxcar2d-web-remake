// 适应度曲线：每代最佳（主色）与平均（辅色），主题感知
export function drawChart(canvas, history) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, devicePixelRatio || 1);
  const W = canvas.clientWidth || 300;
  const H = canvas.clientHeight || 140;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue('--accent').trim();
  const accent2 = css.getPropertyValue('--accent-2').trim();
  const dim = css.getPropertyValue('--text-dim').trim();

  if (history.length < 1) {
    ctx.fillStyle = dim;
    ctx.font = '12px sans-serif';
    ctx.fillText('完成第一代后显示曲线', 12, H / 2);
    return;
  }

  const max = Math.max(1, ...history.map((h) => h.best));
  const px = (i) => (history.length === 1 ? W - 10 : 10 + ((W - 20) * i) / (history.length - 1));
  const py = (v) => H - 16 - ((H - 30) * v) / max;

  // 最佳曲线下方渐变填充
  ctx.beginPath();
  history.forEach((h, i) => (i ? ctx.lineTo(px(i), py(h.best)) : ctx.moveTo(px(i), py(h.best))));
  ctx.lineTo(px(history.length - 1), H - 16);
  ctx.lineTo(px(0), H - 16);
  ctx.closePath();
  ctx.fillStyle = accent + '22';
  ctx.fill();

  const line = (key, color) => {
    ctx.beginPath();
    history.forEach((h, i) => (i ? ctx.lineTo(px(i), py(h[key])) : ctx.moveTo(px(i), py(h[key]))));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
  };
  line('avg', accent2);
  line('best', accent);

  ctx.font = '10px sans-serif';
  ctx.fillStyle = dim;
  ctx.fillText('0', 4, H - 6);
  ctx.fillText(max.toFixed(0) + 'm', 4, 12);
  const last = history[history.length - 1];
  ctx.fillStyle = accent;
  ctx.fillText('最佳 ' + last.best.toFixed(1), W - 88, 12);
  ctx.fillStyle = accent2;
  ctx.fillText('平均 ' + last.avg.toFixed(1), W - 88, 24);
}
