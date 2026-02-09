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

export function drawPlayer(ctx, player, floorY) {
  const t = performance.now() * 0.001;
  const baseY = Number.isFinite(player.y) ? player.y : floorY;
  const apexX = player.x;
  const apexY = baseY - player.h;
  const leftX = player.x - player.w / 2;
  const rightX = player.x + player.w / 2;
  const bob = player.onLadder ? Math.sin(t * 8) * 1.8 : 0;
  const bodyTop = apexY + 4 + bob;
  const bodyBottom = baseY - 3 + bob;

  const bodyGrad = ctx.createLinearGradient(apexX, bodyTop, apexX, bodyBottom);
  bodyGrad.addColorStop(0, '#fdba74');
  bodyGrad.addColorStop(0.55, '#f97316');
  bodyGrad.addColorStop(1, '#c2410c');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(apexX, bodyTop);
  ctx.lineTo(rightX - 1, bodyBottom);
  ctx.lineTo(leftX + 1, bodyBottom);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(apexX, bodyTop - 4, 4.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(apexX - 1.2, bodyTop - 4.4, 1.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(apexX + 1.2, bodyTop - 4.4, 1.15, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0ea5e9';
  ctx.fillRect(apexX + 3, bodyTop + 3, 8, 3.3);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(apexX + 9.5, bodyTop + 3.6, 2.5, 2.1);

  ctx.strokeStyle = 'rgba(15, 23, 42, 0.48)';
  ctx.lineWidth = 2.1;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.34)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(apexX, bodyTop + 1);
  ctx.lineTo(apexX + 5, bodyBottom - 4);
  ctx.stroke();
}
