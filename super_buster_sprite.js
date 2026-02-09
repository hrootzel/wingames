export function drawBackground(ctx, worldW, worldH, floorY) {
  const t = performance.now() * 0.001;
  const sky = ctx.createLinearGradient(0, 0, 0, worldH);
  sky.addColorStop(0, '#081225');
  sky.addColorStop(0.55, '#12284a');
  sky.addColorStop(1, '#101b33');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, worldW, worldH);

  const haze = ctx.createRadialGradient(worldW * 0.5, -30, 20, worldW * 0.5, worldH * 0.45, worldW * 0.8);
  haze.addColorStop(0, 'rgba(125, 211, 252, 0.18)');
  haze.addColorStop(1, 'rgba(125, 211, 252, 0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, worldW, worldH);

  ctx.globalAlpha = 0.32;
  ctx.fillStyle = '#8ec5ff';
  for (let i = 0; i < 38; i++) {
    const px = ((i * 73 + Math.sin(t + i * 1.3) * 28) % worldW + worldW) % worldW;
    const py = 16 + (i * 31) % Math.max(20, floorY - 70);
    const s = (i % 3) + 1;
    ctx.fillRect(px, py, s, s);
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#0a1428';
  ctx.beginPath();
  ctx.moveTo(0, floorY - 26);
  for (let x = 0; x <= worldW; x += 20) {
    const y = floorY - 26 - Math.sin(x * 0.025 + t * 0.5) * 5;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(worldW, floorY);
  ctx.lineTo(0, floorY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#0b1d2a';
  ctx.fillRect(0, floorY, worldW, worldH - floorY);

  const floorGrad = ctx.createLinearGradient(0, floorY, 0, worldH);
  floorGrad.addColorStop(0, 'rgba(20, 35, 58, 0.8)');
  floorGrad.addColorStop(1, 'rgba(4, 9, 20, 0.95)');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, floorY, worldW, worldH - floorY);

  ctx.strokeStyle = 'rgba(180, 220, 255, 0.3)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(0, floorY + 0.5);
  ctx.lineTo(worldW, floorY + 0.5);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(125, 211, 252, 0.16)';
  ctx.lineWidth = 1;
  for (let x = -40; x < worldW + 40; x += 24) {
    const shift = ((t * 18) % 24);
    ctx.beginPath();
    ctx.moveTo(x + shift, floorY + 1);
    ctx.lineTo(x + shift - 10, worldH);
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
