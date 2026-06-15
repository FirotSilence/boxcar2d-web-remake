// 世代生命周期：构建世界 → 物理步进与淘汰 → 评估适应度 → 繁殖下一代
import { generateTerrainPoints } from './terrain.js';
import { buildCar, destroyCar } from './car.js';
import { randomGenome, nextGeneration, mutate, clone } from './genome.js';
import { mulberry32, hashSeed } from './rng.js';

export const DT = 1 / 60;
const START = { x: 1.5, y: 4 };

export class Simulation {
  constructor(cfg) {
    this.cfg = cfg;
    this.generation = 0;
    this.history = [];
    this.bestEver = null;
    this.onGeneration = null;
    this.evoRng = mulberry32((hashSeed(cfg.seed) ^ 0x9e3779b9) >>> 0);
    this.population = Array.from({ length: cfg.populationSize }, () => randomGenome(this.evoRng));
    this._build();
  }

  _build() {
    const pl = window.planck;
    this.world = pl.World(pl.Vec2(0, -this.cfg.gravity));
    const terrRng = mulberry32(hashSeed(this.cfg.seed));
    this.terrain = generateTerrainPoints(terrRng, this.cfg.difficulty, this.cfg.trackLength);
    const ground = this.world.createBody();
    ground.createFixture(pl.Chain(this.terrain.map((p) => pl.Vec2(p.x, p.y)), false), { friction: 0.95 });
    this.finishX = this.terrain[this.terrain.length - 2].x;
    this.time = 0;
    this.cars = this.population.map((genome, index) => ({
      genome,
      index,
      ...buildCar(this.world, genome, this.cfg, START),
      bestX: 0,
      lastProgress: 0,
      alive: true,
      finished: false,
      fitness: 0,
    }));
  }

  // 仅重建世界（换地形/种子），保留当前种群与进化进度
  rebuildWorld() { this._build(); }

  step(dt) {
    this.world.step(dt, 8, 3);
    this.time += dt;
    for (const c of this.cars) {
      if (!c.alive) continue;
      const p = c.chassis.getPosition();
      if (p.x > c.bestX + 0.03) {
        c.bestX = p.x;
        c.lastProgress = this.time;
      }
      c.fitness = Math.max(0, c.bestX);
      if (p.x >= this.finishX - 1.5) {
        c.finished = true;
        this._kill(c);
        continue;
      }
      // 卡住/翻车超时淘汰，或跌出世界
      if (this.time - c.lastProgress > this.cfg.stallTimeout || p.y < -60) this._kill(c);
    }
    if (this.cars.every((c) => !c.alive)) this._endGeneration();
  }

  leader() {
    let best = null;
    for (const c of this.cars) if (c.alive && (!best || c.bestX > best.bestX)) best = c;
    return best;
  }

  skip() {
    for (const c of this.cars) if (c.alive) this._kill(c);
    this._endGeneration();
  }

  // 用指定基因播种：1 份原体 + N-1 份变异体
  seedFrom(genome) {
    this.population = Array.from({ length: this.cfg.populationSize }, (_, i) =>
      i === 0 ? clone(genome) : mutate(clone(genome), Math.max(this.cfg.mutationRate, 0.2), this.cfg.mutationAmount, this.evoRng));
    this._build();
  }

  _kill(c) {
    if (!c.alive) return;
    c.alive = false;
    destroyCar(this.world, c);
  }

  _endGeneration() {
    const fits = this.cars.map((c) => c.fitness + (c.finished ? 100 : 0));
    const best = Math.max(...fits);
    const avg = fits.reduce((a, b) => a + b, 0) / fits.length;
    const bi = fits.indexOf(best);
    if (!this.bestEver || best > this.bestEver.fitness) {
      this.bestEver = { fitness: best, generation: this.generation, genome: clone(this.population[bi]) };
    }
    this.history.push({ gen: this.generation, best, avg });
    this.population = nextGeneration(this.population, fits, this.cfg, this.evoRng);
    this.generation++;
    this._build();
    if (this.onGeneration) this.onGeneration(this);
  }
}
