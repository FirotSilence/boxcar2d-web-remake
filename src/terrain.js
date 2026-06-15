// 程序化崎岖地形：起点平台 + 随距离递增的随机坡度，首尾设挡墙
export function generateTerrainPoints(rng, difficulty, length = 1000) {
  const pts = [
    { x: -14, y: 10 }, // 起点挡墙
    { x: -14, y: 0 },
    { x: 0, y: 0 },
    { x: 10, y: 0 },   // 平坦起步区
  ];
  let x = 10;
  let y = 0;
  while (x < length) {
    const seg = 1.2 + rng() * 2.2;
    const ramp = Math.min(1, x / 250); // 难度随距离渐升
    const maxSlope = Math.tan((0.06 + difficulty * 0.85) * ramp * (Math.PI / 3));
    y += (rng() * 2 - 1) * seg * maxSlope;
    y = Math.max(-30, Math.min(60, y));
    x += seg;
    pts.push({ x: +x.toFixed(3), y: +y.toFixed(3) });
  }
  pts.push({ x: x + 1, y: y + 12 }); // 终点挡墙
  return pts;
}
