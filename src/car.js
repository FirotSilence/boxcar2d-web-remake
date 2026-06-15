// 基因 → 物理车辆：车身为 8 片三角扇凸多边形，轮子通过旋转关节电机驱动
// 所有车辆使用同一负碎片组（filterGroupIndex: -1），彼此不碰撞，仅与地面碰撞
import { decodeWheels, VERTS } from './genome.js';

const TAU = Math.PI * 2;

export function buildCar(world, genome, cfg, start) {
  const pl = window.planck;
  const Vec2 = pl.Vec2;
  const verts = genome.verts.map((m, i) =>
    Vec2(m * Math.cos((i * TAU) / VERTS), m * Math.sin((i * TAU) / VERTS)));

  const chassis = world.createBody({ type: 'dynamic', position: Vec2(start.x, start.y) });
  for (let i = 0; i < VERTS; i++) {
    chassis.createFixture(pl.Polygon([Vec2(0, 0), verts[i], verts[(i + 1) % VERTS]]), {
      density: genome.chassisDensity,
      friction: 0.6,
      restitution: 0.1,
      filterGroupIndex: -1,
    });
  }

  const wheels = [];
  for (const i of decodeWheels(genome, cfg.minWheels, cfg.maxWheels)) {
    const g = genome.wheels[i];
    const pos = Vec2(start.x + verts[i].x, start.y + verts[i].y);
    const body = world.createBody({ type: 'dynamic', position: pos });
    body.createFixture(pl.Circle(g.radius), {
      density: g.density,
      friction: 1.4,
      restitution: 0.05,
      filterGroupIndex: -1,
    });
    world.createJoint(pl.RevoluteJoint(
      { enableMotor: true, motorSpeed: -g.speed, maxMotorTorque: g.torque },
      chassis, body, pos,
    ));
    wheels.push({ body, radius: g.radius, slot: i });
  }

  return { chassis, wheels, verts };
}

export function destroyCar(world, car) {
  for (const w of car.wheels) world.destroyBody(w.body); // 关节随刚体一同销毁
  world.destroyBody(car.chassis);
}
