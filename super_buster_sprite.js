export function drawBackground(ctx, worldW, worldH, floorY) {
  const grad = ctx.createLinearGradient(0, 0, 0, worldH);
  grad.addColorStop(0, '#111827');
  grad.addColorStop(1, '#0b1120');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, worldW, worldH);

  ctx.fillStyle = '#0b1d2a';
  ctx.fillRect(0, floorY, worldW, worldH - floorY);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, floorY + 0.5);
  ctx.lineTo(worldW, floorY + 0.5);
  ctx.stroke();
}

export function drawHarpoon(ctx, harpoon) {
  if (!harpoon.active) return;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(harpoon.x, harpoon.yBottom);
  ctx.lineTo(harpoon.x, harpoon.yTop);
  ctx.stroke();
}

export function drawBall(ctx, ball, radii, palettes) {
  const r = radii[ball.size];
  const palette = palettes[ball.size % palettes.length];
  const grad = ctx.createRadialGradient(
    ball.x - r * 0.35,
    ball.y - r * 0.35,
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
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.stroke();
}

export function drawPlayer(ctx, player, floorY) {
  const apexX = player.x;
  const apexY = floorY - player.h;
  const leftX = player.x - player.w / 2;
  const rightX = player.x + player.w / 2;
  const baseY = floorY;

  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.moveTo(apexX, apexY);
  ctx.lineTo(rightX, baseY);
  ctx.lineTo(leftX, baseY);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(15, 23, 42, 0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();
}
