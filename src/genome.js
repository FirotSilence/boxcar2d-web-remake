// 染色体编码与遗传算子：随机生成、均匀交叉、高斯扰动变异、锦标赛选择 + 精英保留
export const VERTS = 8;

export const RANGES = {
  vert: [0.35, 2.4],          // 车身顶点幅值（米）
  chassisDensity: [10, 120],  // 车身密度
  on: [0, 1],                 // 轮子开关基因（>0.5 视为启用）
  radius: [0.18, 0.8],        // 轮子半径（米）
  density: [10, 120],         // 轮子密度
  torque: [150, 2200],        // 电机最大扭矩
  speed: [8, 45],             // 电机转速（rad/s）
};

export const clone = (g) => JSON.parse(JSON.stringify(g));
const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
const rand = (rng, [lo, hi]) => lo + rng() * (hi - lo);

export function randomGenome(rng) {
  return {
    verts: Array.from({ length: VERTS }, () => rand(rng, RANGES.vert)),
    chassisDensity: rand(rng, RANGES.chassisDensity),
    wheels: Array.from({ length: VERTS }, () => ({
      on: rng(),
      radius: rand(rng, RANGES.radius),
      density: rand(rng, RANGES.density),
      torque: rand(rng, RANGES.torque),
      speed: rand(rng, RANGES.speed),
    })),
  };
}

// 按“开关基因”降序挑选轮子槽位，并限制在 [minW, maxW] 范围内
export function decodeWheels(genome, minW, maxW) {
  const sorted = genome.wheels.map((w, i) => ({ w, i })).sort((a, b) => b.w.on - a.w.on);
  const wanted = sorted.filter((s) => s.w.on > 0.5).length;
  const count = Math.min(VERTS, Math.max(minW, Math.min(maxW, wanted)));
  return sorted.slice(0, count).map((s) => s.i).sort((a, b) => a - b);
}

export function crossover(a, b, rng) {
  return {
    verts: a.verts.map((v, i) => (rng() < 0.5 ? v : b.verts[i])),
    chassisDensity: rng() < 0.5 ? a.chassisDensity : b.chassisDensity,
    wheels: a.wheels.map((w, i) => clone(rng() < 0.5 ? w : b.wheels[i])),
  };
}

export function mutate(g, rate, amount, rng) {
  const m = clone(g);
  const jig = (v, r) => clamp(v + (rng() * 2 - 1) * amount * (r[1] - r[0]), r);
  m.verts = m.verts.map((v) => (rng() < rate ? jig(v, RANGES.vert) : v));
  if (rng() < rate) m.chassisDensity = jig(m.chassisDensity, RANGES.chassisDensity);
  for (const w of m.wheels) {
    if (rng() < rate) w.on = jig(w.on, RANGES.on);
    if (rng() < rate) w.radius = jig(w.radius, RANGES.radius);
    if (rng() < rate) w.density = jig(w.density, RANGES.density);
    if (rng() < rate) w.torque = jig(w.torque, RANGES.torque);
    if (rng() < rate) w.speed = jig(w.speed, RANGES.speed);
  }
  return m;
}

export function nextGeneration(pop, fits, cfg, rng) {
  const order = fits.map((_, i) => i).sort((a, b) => fits[b] - fits[a]);
  const next = [];
  for (let i = 0; i < Math.min(cfg.eliteCount, pop.length); i++) next.push(clone(pop[order[i]]));
  const pick = () => {
    // 三轮锦标赛选择
    let best = -1;
    for (let k = 0; k < 3; k++) {
      const c = Math.floor(rng() * pop.length);
      if (best < 0 || fits[c] > fits[best]) best = c;
    }
    return pop[best];
  };
  while (next.length < cfg.populationSize) {
    next.push(mutate(crossover(pick(), pick(), rng), cfg.mutationRate, cfg.mutationAmount, rng));
  }
  return next.slice(0, cfg.populationSize);
}
