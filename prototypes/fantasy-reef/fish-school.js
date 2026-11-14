/* Species-aware Boids for the painterly scene. The original V1 Fish class stays
 * untouched. All neighbors are read from one snapshot, avoiding update-order bias.
 */
(() => {
  'use strict';
  const { clamp, lerp, seeded, TAU } = globalThis.CyberAquarium;
  const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const species = {
    reef: { name: '蓝绿礁鱼', asset: 'fish', width: 96, speed: 31, turn: 1.15, radius: 160, cohesion: .095, alignment: .65, spacing: .54, range: [.31,.77], beat: 5.3, fins: .65, tail: .9, profile: 0 },
    tetra: { name: '荧光灯鱼', asset: 'tetra', width: 67, speed: 45, turn: 1.85, radius: 190, cohesion: .20, alignment: 1.15, spacing: .40, range: [.25,.70], beat: 9.0, fins: .45, tail: 1.1, profile: 1 },
    angel: { name: '长鳍神仙鱼', asset: 'angelfish', width: 117, speed: 22, turn: .78, radius: 130, cohesion: .025, alignment: .17, spacing: .55, range: [.35,.77], beat: 2.8, fins: 1.5, tail: .55, profile: 2 },
  };
  const composition = ['tetra','tetra','reef','tetra','reef','angel','tetra','reef','tetra','angel'];
  const CENTER_X = [.23,.53,.78];
  function shoalCenters(world, centers) {
    if (centers.time === world.time && centers.width === world.width && centers.height === world.height) return centers;
    for (let i=0;i<3;i++) {
      const c=centers[i] || (centers[i]={});
      c.x=world.width*(CENTER_X[i]+Math.sin(world.time*.105+i*2)*.12);
      c.y=world.height*(.46+Math.sin(world.time*.14+i*2.2)*.15);
    }
    centers.time=world.time; centers.width=world.width; centers.height=world.height;
    return centers;
  }

  class SchoolFish {
    constructor(id, kind, world, slot) {
      this.id = id; this.kind = kind; this.species = species[kind];
      const rng = seeded(id * 919 + 316);
      this.phase = rng() * TAU; this.depth = [.24,.62,.86][slot % 3] + (rng() - .5) * .10;
      this.individualSize = .88 + rng() * .23; this.speedVariation = .86 + rng() * .25;
      this.group = slot % 3; this.beat = 0; this.turnRate = 0; this.hungry = false; this.target = null;
      this.motion = { beat:0, tail:0, fins:this.species.fins, profile:this.species.profile }; this.centers=[];
      this.heading = (slot % 3 === 0 ? Math.PI : 0) + (rng() - .5) * .32;
      this.resize(world);
      // Several small shoals across both dimensions, never a central spawn pile.
      const gx = kind === 'tetra' ? [.23,.53,.78][this.group] : .12 + rng() * .76;
      const gy = kind === 'tetra' ? [.39,.56,.35][this.group] : lerp(this.species.range[0], this.species.range[1], rng());
      this.x = clamp(world.width * gx + (rng() - .5) * world.width * .12, this.radius + 12, world.width - this.radius - 12);
      this.y = clamp(world.height * gy + (rng() - .5) * world.height * .10, 115, world.height - 145);
      this.speed = this.cruise; this.vx = Math.cos(this.heading) * this.speed; this.vy = Math.sin(this.heading) * this.speed;
      this.updateAppearance();
    }
    resize(world) {
      const scale = clamp(world.width / 1200, .64, 1.12);
      this.artWidth = this.species.width * scale * lerp(.64, 1.08, this.depth) * this.individualSize;
      this.radius = this.artWidth * (this.kind === 'angel' ? .29 : .31);
      this.size = this.radius;
      this.cruise = this.species.speed * scale * this.speedVariation;
      this.maxTurn = this.species.turn;
      this.perception = this.species.radius * scale;
    }
    updateAppearance() {
      // Continuous yaw projection passes through edge-on during a turn. No sign
      // threshold and no discontinuous minimum-width mirror switch.
      this.yaw = Math.cos(this.heading);
      this.angle = Math.atan2(this.vy, Math.abs(this.vx) + this.cruise * .8) * this.yaw;
      this.bank = this.turnRate * .07 * this.yaw;
      this.opacity = lerp(.42, .84, this.depth);
      this.motion.beat=this.beat;
      this.motion.tail=this.species.tail * (.72 + this.speed / this.cruise * .3);
    }
    update(dt, world, neighbors) {
      const s = this.species, w = world.width, h = world.height;
      const perceptionSquared=this.perception*this.perception;
      let ax = 0, ay = 0, weight = 0, cx = 0, cy = 0, avx = 0, avy = 0;
      const breath = .58 + .42 * Math.sin(world.time * .15 + this.group * 2.1);
      for (const other of neighbors) {
        if (other.id === this.id) continue;
        let dx = this.x - other.x, dy = this.y - other.y;
        const space = (this.artWidth + other.artWidth) * s.spacing * .5 + 6;
        const distanceSquared=dx*dx+dy*dy;
        if(distanceSquared>perceptionSquared && distanceSquared>space*space) continue;
        let d = Math.hypot(dx, dy);
        if (d < .01) { dx = this.id < other.id ? -.01 : .01; dy = 0; d = .01; }
        const depthWeight = Math.max(.15, 1 - Math.abs(this.depth - other.depth) * .9);
        if (d < space) {
          const force = (1 - d / space) ** 2 * 100 * depthWeight;
          ax += dx / d * force; ay += dy / d * force;
        }
        if (d < this.perception) {
          const social = (other.kind === this.kind ? 1 : .10) * (1 - d / this.perception) * depthWeight;
          weight += social; cx += other.x * social; cy += other.y * social; avx += other.vx * social; avy += other.vy * social;
        }
      }
      if (weight > .01) {
        ax += (cx / weight - this.x) * s.cohesion * breath + (avx / weight - this.vx) * s.alignment * (.45 + breath * .55);
        ay += (cy / weight - this.y) * s.cohesion * breath + (avy / weight - this.vy) * s.alignment * (.45 + breath * .55);
      }
      const range = Math.min(w * .62, 520) * (this.kind === 'tetra' ? 1.15 : this.kind === 'angel' ? .9 : 1);
      if (this.target && (this.target.eaten || this.target.life <= 0 || !world.food.includes(this.target) || Math.hypot(this.target.x - this.x, this.target.y - this.y) > range * 1.3)) this.target = null;
      let nearest = this.target ? Math.hypot(this.target.x - this.x, this.target.y - this.y) * .65 : range;
      for (const food of world.food) {
        if (food.eaten) continue;
        const d = Math.hypot(food.x - this.x, food.y - this.y);
        if (d < nearest) { this.target = food; nearest = d; }
      }
      this.hungry = !!this.target;
      let goalSpeed = this.cruise * (1 + Math.sin(world.time * .45 + this.phase) * .10);
      if (this.target) {
        const dx = this.target.x - this.x, dy = this.target.y - this.y, distance = Math.hypot(dx, dy) || 1;
        goalSpeed = this.cruise * 1.7 * clamp(distance / 45, .38, 1);
        ax += (dx / distance * goalSpeed - this.vx) * 1.9;
        ay += (dy / distance * goalSpeed - this.vy) * 1.9;
        if (distance < Math.max(9, this.radius * .55)) {
          this.target.eaten = true; world.sparkle(this.target.x, this.target.y, 4); this.target = null;
        }
      } else {
        let tx, ty;
        if (this.kind === 'tetra') {
          // Roaming shoal centers overlap and drift apart. Social forces may
          // transfer fish between nearby groups; these are weak currents, not rails.
          const centers = world.school ? world.school.centers : shoalCenters(world,this.centers);
          const current = centers[this.group];
          const ownDist = Math.hypot(current.x - this.x, current.y - this.y);
          for (let i = 0; i < centers.length; i++) {
            if (Math.hypot(centers[i].x - this.x, centers[i].y - this.y) < ownDist * .55) this.group = i;
          }
          tx = centers[this.group].x; ty = centers[this.group].y;
        } else {
          tx = w * (.5 + Math.sin(world.time * (this.kind === 'angel' ? .037 : .07) + this.phase) * .36);
          ty = h * lerp(s.range[0], s.range[1], .5 + Math.sin(world.time * .08 + this.phase) * .45);
        }
        ax += (tx - this.x) * (this.kind === 'tetra' ? .042 : .016);
        ay += (ty - this.y) * (this.kind === 'tetra' ? .042 : .022);
        ax += Math.cos(world.time * .58 + this.phase) * (this.kind === 'angel' ? 3 : 6);
        ay += Math.sin(world.time * .49 + this.phase * 1.7) * (this.kind === 'angel' ? 3 : 7);
        // Soft species activity bands, relaxed during feeding.
        const top = h * s.range[0], bottom = h * s.range[1];
        if (this.y < top) ay += (top - this.y) * .45;
        if (this.y > bottom) ay -= (this.y - bottom) * .45;
      }
      // Avoid the actual bell position, not the center of the long jelly image.
      for (const jelly of world.jellies) {
        const jy = jelly.y - jelly.height * .35;
        const dx = this.x - jelly.x, dy = this.y - jy, d = Math.hypot(dx, dy) || 1;
        const safe = jelly.height * .20 + this.radius;
        if (d < safe) { ax += dx / d * (1 - d / safe) * 44; ay += dy / d * (1 - d / safe) * 44; }
      }
      const edge = Math.max(48, this.cruise / this.maxTurn * 2 + this.radius);
      const px = this.x + this.vx * .65, py = this.y + this.vy * .65;
      if (px < edge) ax += (edge - px) * 1.3;
      if (px > w - edge) ax -= (px - w + edge) * 1.3;
      if (py < 95 + this.radius) ay += (95 + this.radius - py) * 1.1;
      if (py > h - 115 - this.radius) ay -= (py - h + 115 + this.radius) * 1.1;
      // Convert steering acceleration into a desired heading; bounded angular
      // velocity and angular acceleration make U-turns continuous at any dt.
      const desiredX = this.vx + clamp(ax, -150, 150) * .8;
      const desiredY = this.vy + clamp(ay, -150, 150) * .8;
      const desiredHeading = Math.atan2(desiredY, desiredX);
      const wantedRate = clamp(angleDelta(desiredHeading, this.heading) * 2.4, -this.maxTurn, this.maxTurn);
      this.turnRate = lerp(this.turnRate, wantedRate, 1 - Math.exp(-dt * 4));
      this.heading = angleDelta(this.heading + this.turnRate * dt, 0);
      goalSpeed *= 1 - Math.min(.25, Math.abs(this.turnRate) / this.maxTurn * .20);
      this.speed = lerp(this.speed, goalSpeed, 1 - Math.exp(-dt * 1.5));
      this.vx = Math.cos(this.heading) * this.speed; this.vy = Math.sin(this.heading) * this.speed;
      this.x = clamp(this.x + this.vx * dt, this.radius + 4, w - this.radius - 4);
      this.y = clamp(this.y + this.vy * dt, 85 + this.radius, h - 100 - this.radius);
      this.beat += dt * s.beat * (.65 + this.speed / this.cruise * .48);
      this.updateAppearance();
    }
  }

  class School {
    constructor() { this.nextId = 0; this.neighbors = []; this.centers=[]; }
    setCount(world, count) {
      const n = clamp(Math.round(Number(count) || 18), 10, 30);
      while (world.fish.length < n) {
        const slot = world.fish.length;
        world.fish.push(new SchoolFish(this.nextId++, composition[slot % composition.length], world, slot));
      }
      world.fish.length = n; world.count = n;
      return n;
    }
    update(world, dt) {
      shoalCenters(world,this.centers);
      this.neighbors.length = world.fish.length;
      for (let i = 0; i < world.fish.length; i++) {
        const f = world.fish[i], n = this.neighbors[i] || (this.neighbors[i] = {});
        n.id=f.id; n.kind=f.kind; n.x=f.x; n.y=f.y; n.vx=f.vx; n.vy=f.vy; n.depth=f.depth; n.artWidth=f.artWidth;
      }
      for (const fish of world.fish) fish.update(dt, world, this.neighbors);
    }
  }
  globalThis.ReefSchool = { School, SchoolFish, species, angleDelta };
})();
