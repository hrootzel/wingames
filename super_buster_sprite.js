const SCENE_CACHE = new Map();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hash32(input) {
  let h = 2166136261 >>> 0;
  const str = String(input);
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed) {
  let x = seed >>> 0;
  return () => {
    x = (x + 0x6d2b79f5) >>> 0;
    let t = Math.imul(x ^ (x >>> 15), 1 | x);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildMountainPath(rng, worldW, baseY, amp, step, drift) {
  const points = [{ x: 0, y: baseY }];
  for (let x = 0; x <= worldW + step; x += step) {
    const phase = x * 0.018 + drift;
    const n = (rng() - 0.5) * amp * 0.6;
    const y = baseY - Math.sin(phase) * amp * 0.75 - n;
    points.push({ x, y });
  }
  return points;
}

function buildScene(worldW, worldH, floorY, levelIndex) {
  const seed = hash32(`bg:${levelIndex}:${worldW}:${worldH}:${floorY}`);
  const rng = makeRng(seed);
  const paletteMode = Math.floor(rng() * 3);
  const palettes = [
    {
      skyTop: '#050b17',
      skyMid: '#0d1f3d',
      skyBot: '#08182d',
      bandA: 'rgba(110, 170, 255, 0)',
      bandB: 'rgba(110, 170, 255, 0.15)',
      mountainBack: 'rgba(25, 39, 62, 0.7)',
      mountainFront: 'rgba(14, 27, 45, 0.92)',
      soilTop: '#4c2f27',
      soilMid: '#3a241f',
      soilBot: '#231714',
      soilRidge: 'rgba(252, 211, 161, 0.38)',
      craterFill: 'rgba(24, 12, 11, 0.42)',
      craterRim: 'rgba(248, 180, 130, 0.24)',
      starA: '#dbeafe',
      starB: '#bfdbfe',
    },
    {
      skyTop: '#060813',
      skyMid: '#1b1538',
      skyBot: '#12182f',
      bandA: 'rgba(186, 146, 255, 0)',
      bandB: 'rgba(186, 146, 255, 0.16)',
      mountainBack: 'rgba(44, 33, 73, 0.72)',
      mountainFront: 'rgba(24, 20, 54, 0.9)',
      soilTop: '#5a3d31',
      soilMid: '#402b24',
      soilBot: '#2a1d1a',
      soilRidge: 'rgba(255, 210, 178, 0.35)',
      craterFill: 'rgba(28, 16, 16, 0.45)',
      craterRim: 'rgba(255, 192, 170, 0.2)',
      starA: '#ede9fe',
      starB: '#ddd6fe',
    },
    {
      skyTop: '#031016',
      skyMid: '#0a2b32',
      skyBot: '#0d1d25',
      bandA: 'rgba(117, 255, 201, 0)',
      bandB: 'rgba(117, 255, 201, 0.14)',
      mountainBack: 'rgba(20, 57, 63, 0.68)',
      mountainFront: 'rgba(12, 35, 42, 0.9)',
      soilTop: '#4a3525',
      soilMid: '#322417',
      soilBot: '#231911',
      soilRidge: 'rgba(201, 254, 240, 0.28)',
      craterFill: 'rgba(17, 13, 10, 0.45)',
      craterRim: 'rgba(175, 255, 228, 0.2)',
      starA: '#ccfbf1',
      starB: '#a7f3d0',
    },
  ];
  const palette = palettes[paletteMode];
  const galaxy = {
    centerX: worldW * (0.38 + rng() * 0.24),
    centerY: worldH * (0.18 + rng() * 0.2),
    angle: -0.42 + rng() * 0.84,
    thickness: 26 + rng() * 34,
    feather: 1.1 + rng() * 0.65,
    density: 0.32 + rng() * 0.52,
    drift: rng() * Math.PI * 2,
  };
  galaxy.nx = -Math.sin(galaxy.angle);
  galaxy.ny = Math.cos(galaxy.angle);
  galaxy.tx = Math.cos(galaxy.angle);
  galaxy.ty = Math.sin(galaxy.angle);

  const zoneH = floorY - 56;
  const baseStars = 58 + Math.floor(rng() * 28);
  const bandStars = 32 + Math.floor(galaxy.density * 78);
  const stars = [];
  for (let i = 0; i < baseStars; i += 1) {
    stars.push({
      x: rng() * worldW,
      y: 8 + rng() * Math.max(18, zoneH),
      s: 0.7 + rng() * 1.6,
      a: 0.2 + rng() * 0.45,
      tw: rng() * Math.PI * 2,
      ts: 0.4 + rng() * 1.1,
      c: rng() < 0.35 ? palette.starB : palette.starA,
      bandBoost: 0,
    });
  }
  for (let i = 0; i < bandStars; i += 1) {
    const along = (rng() - 0.5) * (worldW + worldH * 0.95);
    const spread = (rng() - 0.5) * galaxy.thickness * 2.2;
    const x = galaxy.centerX + galaxy.tx * along + galaxy.nx * spread;
    const y = galaxy.centerY + galaxy.ty * along + galaxy.ny * spread;
    if (x < -6 || x > worldW + 6 || y < 2 || y > zoneH + 10) continue;
    stars.push({
      x,
      y,
      s: 0.8 + rng() * 1.9,
      a: 0.36 + rng() * 0.52,
      tw: rng() * Math.PI * 2,
      ts: 0.55 + rng() * 1.35,
      c: rng() < 0.45 ? palette.starB : palette.starA,
      bandBoost: 0.18 + rng() * 0.38,
    });
  }

  const planet = {
    x: worldW * (0.15 + rng() * 0.7),
    y: 42 + rng() * 36,
    r: 18 + rng() * 22,
    hue: rng() < 0.5 ? 'rgba(255, 184, 120, 0.2)' : 'rgba(110, 222, 255, 0.2)',
  };

  const auroraCount = 1 + Math.floor(rng() * 3);
  const auroras = [];
  for (let i = 0; i < auroraCount; i += 1) {
    auroras.push({
      y: worldH * (0.16 + rng() * 0.24),
      amp: 8 + rng() * 20,
      thick: 9 + rng() * 18,
      speed: 0.12 + rng() * 0.24,
      drift: rng() * Math.PI * 2,
      alpha: 0.06 + rng() * 0.1,
      colorA: paletteMode === 2 ? 'rgba(120, 255, 214, 0)' : 'rgba(110, 255, 228, 0)',
      colorB: paletteMode === 1 ? 'rgba(173, 145, 255, 0.18)' : 'rgba(118, 230, 255, 0.18)',
    });
  }

  const mountainsBack = buildMountainPath(rng, worldW, floorY - 60, 34 + rng() * 14, 34, rng() * 5.2);
  const mountainsFront = buildMountainPath(rng, worldW, floorY - 32, 24 + rng() * 12, 26, rng() * 5.2);

  const craterCount = 5 + Math.floor(rng() * 5);
  const craters = [];
  for (let i = 0; i < craterCount; i += 1) {
    const rw = 22 + rng() * 54;
    const rh = 6 + rng() * 14;
    craters.push({
      x: rw * 0.55 + rng() * (worldW - rw * 1.1),
      y: floorY + 7 + rng() * Math.max(4, worldH - floorY - 16),
      rw,
      rh,
    });
  }

  const rockCount = 14 + Math.floor(rng() * 14);
  const rocks = [];
  for (let i = 0; i < rockCount; i += 1) {
    const w = 6 + rng() * 16;
    const h = 2 + rng() * 6;
    rocks.push({
      x: rng() * (worldW - w),
      y: floorY + 3 + rng() * Math.max(4, worldH - floorY - h - 2),
      w,
      h,
    });
  }

  return { stars, galaxy, planet, auroras, mountainsBack, mountainsFront, craters, rocks, seed, palette };
}

function getScene(worldW, worldH, floorY, levelIndex) {
  const key = `${worldW}x${worldH}:${floorY}:${levelIndex}`;
  let scene = SCENE_CACHE.get(key);
  if (!scene) {
    scene = buildScene(worldW, worldH, floorY, levelIndex);
    SCENE_CACHE.set(key, scene);
  }
  return scene;
}

function fillMountainShape(ctx, points, worldW, floorY, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, floorY);
  for (const p of points) {
    ctx.lineTo(p.x, p.y);
  }
  ctx.lineTo(worldW, floorY);
  ctx.closePath();
  ctx.fill();
}

export function drawBackground(ctx, worldW, worldH, floorY, levelIndex = 0) {
  const t = performance.now() * 0.001;
  const scene = getScene(worldW, worldH, floorY, levelIndex);
  const pal = scene.palette;

  const sky = ctx.createLinearGradient(0, 0, 0, worldH);
  sky.addColorStop(0, pal.skyTop);
  sky.addColorStop(0.52, pal.skyMid);
  sky.addColorStop(1, pal.skyBot);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, worldW, worldH);

  const sway = Math.sin(t * 0.06 + scene.galaxy.drift) * 3.5;
  const swayX = scene.galaxy.nx * sway;
  const swayY = scene.galaxy.ny * sway;
  ctx.save();
  ctx.translate(scene.galaxy.centerX + swayX, scene.galaxy.centerY + swayY);
  ctx.rotate(scene.galaxy.angle);
  const bandW = worldW + worldH * 2;
  const bandH = scene.galaxy.thickness * (2.7 + scene.galaxy.feather);
  const galaxyGrad = ctx.createLinearGradient(0, -bandH * 0.5, 0, bandH * 0.5);
  galaxyGrad.addColorStop(0, pal.bandA);
  galaxyGrad.addColorStop(0.24, 'rgba(160, 200, 255, 0.06)');
  galaxyGrad.addColorStop(0.5, pal.bandB);
  galaxyGrad.addColorStop(0.76, 'rgba(160, 200, 255, 0.06)');
  galaxyGrad.addColorStop(1, pal.bandA);
  ctx.fillStyle = galaxyGrad;
  ctx.fillRect(-bandW * 0.5, -bandH * 0.5, bandW, bandH);
  ctx.restore();

  for (const aurora of scene.auroras) {
    const y = aurora.y + Math.sin(t * aurora.speed + aurora.drift) * 4;
    const auroraGrad = ctx.createLinearGradient(0, y - aurora.thick, 0, y + aurora.thick);
    auroraGrad.addColorStop(0, aurora.colorA);
    auroraGrad.addColorStop(0.5, aurora.colorB);
    auroraGrad.addColorStop(1, aurora.colorA);
    ctx.globalAlpha = aurora.alpha;
    ctx.fillStyle = auroraGrad;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= worldW; x += 24) {
      const ny = y + Math.sin(x * 0.018 + t * aurora.speed * 5 + aurora.drift) * aurora.amp;
      ctx.lineTo(x, ny);
    }
    ctx.lineTo(worldW, y + aurora.thick);
    ctx.lineTo(0, y + aurora.thick);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const planetGrad = ctx.createRadialGradient(scene.planet.x - scene.planet.r * 0.25, scene.planet.y - scene.planet.r * 0.25, 2, scene.planet.x, scene.planet.y, scene.planet.r);
  planetGrad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
  planetGrad.addColorStop(0.55, scene.planet.hue);
  planetGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = planetGrad;
  ctx.beginPath();
  ctx.arc(scene.planet.x, scene.planet.y, scene.planet.r, 0, Math.PI * 2);
  ctx.fill();

  for (const star of scene.stars) {
    const flicker = 0.74 + 0.26 * Math.sin(t * star.ts + star.tw);
    ctx.globalAlpha = clamp((star.a + star.bandBoost * scene.galaxy.density) * flicker, 0, 1);
    ctx.fillStyle = star.c;
    ctx.fillRect(star.x, star.y, star.s, star.s);
  }
  ctx.globalAlpha = 1;

  fillMountainShape(ctx, scene.mountainsBack, worldW, floorY, pal.mountainBack);
  fillMountainShape(ctx, scene.mountainsFront, worldW, floorY, pal.mountainFront);

  const soilGrad = ctx.createLinearGradient(0, floorY, 0, worldH);
  soilGrad.addColorStop(0, pal.soilTop);
  soilGrad.addColorStop(0.45, pal.soilMid);
  soilGrad.addColorStop(1, pal.soilBot);
  ctx.fillStyle = soilGrad;
  ctx.fillRect(0, floorY, worldW, worldH - floorY);

  ctx.globalAlpha = 0.22;
  for (const rock of scene.rocks) {
    ctx.fillStyle = '#2c1f1d';
    ctx.fillRect(rock.x, rock.y, rock.w, rock.h);
  }
  ctx.globalAlpha = 1;

  for (const crater of scene.craters) {
    ctx.fillStyle = pal.craterFill;
    ctx.beginPath();
    ctx.ellipse(crater.x, crater.y, crater.rw * 0.5, crater.rh, -0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = pal.craterRim;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(crater.x - crater.rw * 0.08, crater.y - crater.rh * 0.06, crater.rw * 0.4, crater.rh * 0.7, -0.08, Math.PI * 1.08, Math.PI * 1.95);
    ctx.stroke();
  }

  const ridge = ctx.createLinearGradient(0, floorY - 1, 0, floorY + 3);
  ridge.addColorStop(0, pal.soilRidge);
  ridge.addColorStop(1, 'rgba(252, 211, 161, 0)');
  ctx.strokeStyle = ridge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, floorY + 0.5);
  ctx.lineTo(worldW, floorY + 0.5);
  ctx.stroke();

  const meteorPhase = (t * 0.11 + (scene.seed % 100) / 100) % 1;
  if (meteorPhase > 0.72 && meteorPhase < 0.82) {
    const p = (meteorPhase - 0.72) / 0.1;
    const mx = worldW * (0.12 + p * 0.78);
    const my = 30 + p * 58;
    ctx.strokeStyle = `rgba(190, 230, 255, ${0.22 + (1 - p) * 0.25})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(mx - 18, my - 10);
    ctx.lineTo(mx, my);
    ctx.stroke();
  }
}

export function drawHarpoon(ctx, harpoon) {
  if (!harpoon.active) return;
  const t = performance.now() * 0.001;
  const pulse = 0.55 + 0.45 * Math.sin(t * 14);
  const shaftGrad = ctx.createLinearGradient(harpoon.x, harpoon.yBottom, harpoon.x, harpoon.yTop);
  shaftGrad.addColorStop(0, '#cbd5e1');
  shaftGrad.addColorStop(0.45, '#f8fafc');
  shaftGrad.addColorStop(1, '#93c5fd');
  ctx.shadowColor = `rgba(125, 211, 252, ${0.45 * pulse})`;
  ctx.shadowBlur = 7 + pulse * 7;
  ctx.strokeStyle = shaftGrad;
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(harpoon.x, harpoon.yBottom);
  ctx.lineTo(harpoon.x, harpoon.yTop);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(harpoon.x - 1, harpoon.yBottom);
  ctx.lineTo(harpoon.x - 1, harpoon.yTop);
  ctx.stroke();

  const tipY = harpoon.yTop;
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(harpoon.x, tipY - 6);
  ctx.lineTo(harpoon.x + 4, tipY + 1);
  ctx.lineTo(harpoon.x - 4, tipY + 1);
  ctx.closePath();
  ctx.fill();
}

export function drawBall(ctx, ball, radii, palettes) {
  const t = performance.now() * 0.001;
  const r = radii[ball.size];
  const palette = palettes[ball.size % palettes.length];
  const wobble = Math.sin(t * 4 + ball.x * 0.04 + ball.y * 0.03) * 0.08;
  const glowA = 0.15 + 0.1 * (0.5 + 0.5 * Math.sin(t * 6 + ball.size));

  ctx.save();
  ctx.shadowColor = `rgba(125, 211, 252, ${glowA})`;
  ctx.shadowBlur = r * (0.35 + glowA);
  ctx.shadowOffsetY = Math.max(1, r * 0.08);

  const grad = ctx.createRadialGradient(
    ball.x - r * (0.32 + wobble * 0.4),
    ball.y - r * (0.34 - wobble * 0.3),
    r * 0.15,
    ball.x,
    ball.y,
    r
  );
  grad.addColorStop(0, palette.highlight);
  grad.addColorStop(0.55, palette.base);
  grad.addColorStop(1, palette.shadow);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
  ctx.lineWidth = Math.max(1.2, r * 0.08);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.beginPath();
  ctx.arc(ball.x - r * 0.08, ball.y - r * 0.08, r * 0.74, Math.PI * 1.06, Math.PI * 1.96);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
  ctx.beginPath();
  ctx.ellipse(ball.x - r * 0.28, ball.y - r * 0.34, r * 0.23, r * 0.16, -0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath();
  ctx.arc(ball.x - r * 0.08, ball.y - r * 0.47, Math.max(1, r * 0.08), 0, Math.PI * 2);
  ctx.fill();

  const speed = Math.hypot(ball.vx || 0, ball.vy || 0);
  if (speed > 40) {
    const tx = ball.x - (ball.vx / speed) * r * 0.9;
    const ty = ball.y - (ball.vy / speed) * r * 0.9;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = Math.max(1, r * 0.07);
    ctx.beginPath();
    ctx.moveTo(ball.x, ball.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPlayer(ctx, player, floorY, harpoon = null) {
  const t = performance.now() * 0.001;
  const baseY = Number.isFinite(player.y) ? player.y : floorY;
  const facing = player.facing >= 0 ? 1 : -1;
  const isClimbing = !!player.onLadder;
  const walkPhase = Math.sin(t * 11);
  const climbPhase = Math.sin(t * 14);
  const idleBob = isClimbing ? Math.sin(t * 7.5) * 0.8 : Math.sin(t * 3.4) * 0.75;
  const shootKick = Math.max(0, Math.min(1, (player.shootTimer || 0) / 0.13));

  const cx = player.x;
  const feetY = baseY;
  const bodyH = 13;
  const bodyW = 12;
  const headR = 5;
  const bodyY = feetY - bodyH - 4 + idleBob;
  const headY = bodyY - headR - 0.5;
  const legLift = isClimbing ? climbPhase * 1.6 : walkPhase * 1.35;
  const armSwing = isClimbing ? -climbPhase * 1.3 : walkPhase * 0.9;
  const gunRecoil = shootKick * 1.8;
  const aimingUp = !!harpoon?.active || shootKick > 0.01;
  const armAngle = aimingUp ? (-Math.PI * 0.5 + facing * 0.12) : (facing * (0.1 + armSwing * 0.06));

  ctx.save();
  ctx.translate(cx, 0);

  // Backpack thruster
  ctx.fillStyle = '#475569';
  ctx.fillRect(-facing * 8, bodyY + 2, facing * -4, 8);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(-facing * 8, bodyY + 3, facing * -1.5, 3);
  if (shootKick > 0.02) {
    ctx.fillStyle = `rgba(56, 189, 248, ${0.2 + shootKick * 0.35})`;
    ctx.fillRect(-facing * 10.5, bodyY + 5, facing * -1.8, 2);
  }

  // Legs
  ctx.fillStyle = '#e2e8f0';
  const l1 = isClimbing ? -legLift : legLift;
  const l2 = -l1;
  ctx.fillRect(-4, feetY - 8 + l1, 3.6, 8.2);
  ctx.fillRect(0.4, feetY - 8 + l2, 3.6, 8.2);
  ctx.fillStyle = '#334155';
  ctx.fillRect(-4.8, feetY - 1 + l1, 5.1, 2.2);
  ctx.fillRect(0, feetY - 1 + l2, 5.1, 2.2);

  // Torso capsule
  const torsoGrad = ctx.createLinearGradient(0, bodyY, 0, bodyY + bodyH);
  torsoGrad.addColorStop(0, '#f8fafc');
  torsoGrad.addColorStop(0.48, '#e2e8f0');
  torsoGrad.addColorStop(1, '#94a3b8');
  ctx.fillStyle = torsoGrad;
  ctx.beginPath();
  ctx.roundRect(-bodyW * 0.5, bodyY, bodyW, bodyH, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Suit stripe
  ctx.fillStyle = '#f97316';
  ctx.fillRect(-1.2, bodyY + 2, 2.4, bodyH - 4);

  // Gun arm + harpoon launcher
  const shoulderX = facing * 2.4;
  const shoulderY = bodyY + 5.8 + armSwing * 0.45;
  ctx.save();
  ctx.translate(shoulderX, shoulderY);
  ctx.rotate(armAngle);
  const armLen = 6.2 - gunRecoil * 0.4;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(armLen, 0);
  ctx.stroke();

  const gunGrad = ctx.createLinearGradient(armLen - 1, -2, armLen + 6.5, 2);
  gunGrad.addColorStop(0, '#f8fafc');
  gunGrad.addColorStop(1, '#64748b');
  ctx.fillStyle = gunGrad;
  ctx.beginPath();
  ctx.roundRect(armLen - 0.8, -1.8, 6.3, 3.6, 1.2);
  ctx.fill();

  if (shootKick > 0.02) {
    ctx.fillStyle = `rgba(251, 191, 36, ${0.35 + shootKick * 0.55})`;
    ctx.beginPath();
    ctx.moveTo(armLen + 5.8, 0);
    ctx.lineTo(armLen + 8.8, -1.25);
    ctx.lineTo(armLen + 8.8, 1.25);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Helmet
  const helmetGrad = ctx.createLinearGradient(0, headY - headR, 0, headY + headR);
  helmetGrad.addColorStop(0, '#f8fafc');
  helmetGrad.addColorStop(1, '#cbd5e1');
  ctx.fillStyle = helmetGrad;
  ctx.beginPath();
  ctx.arc(0, headY, headR, 0, Math.PI * 2);
  ctx.fill();

  // Visor
  const visorGrad = ctx.createLinearGradient(-4.5 * facing, headY - 2.4, 4.5 * facing, headY + 2.4);
  visorGrad.addColorStop(0, '#38bdf8');
  visorGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = visorGrad;
  ctx.beginPath();
  ctx.ellipse(facing * 1.1, headY, 3.6, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.42)';
  ctx.beginPath();
  ctx.ellipse(facing * 0.4, headY - 0.8, 1.2, 0.7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Climbing support arm
  if (isClimbing) {
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-facing * 2.3, bodyY + 6);
    ctx.lineTo(-facing * 6.2, bodyY + 5.2 - climbPhase * 0.8);
    ctx.stroke();
  }

  ctx.restore();
}
