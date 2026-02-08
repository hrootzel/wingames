import { roundRectPath, shadeHex } from './rendering_engine.js';

function crystalFill(ctx, x, y, w, h, baseColor) {
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, shadeHex(baseColor, 0.35));
  grad.addColorStop(0.45, baseColor);
  grad.addColorStop(1, shadeHex(baseColor, -0.35));
  return grad;
}

function drawFacet(ctx, x, y, w, h, alpha = 0.2) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.08, y + h * 0.16);
  ctx.lineTo(x + w * 0.46, y + h * 0.08);
  ctx.lineTo(x + w * 0.34, y + h * 0.42);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = alpha * 0.75;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.6, y + h * 0.14);
  ctx.lineTo(x + w * 0.9, y + h * 0.22);
  ctx.lineTo(x + w * 0.72, y + h * 0.44);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function stageTone(stage, row, colorIndex) {
  const hue = (stage * 21 + row * 11 + colorIndex * 7) % 360;
  return `hsl(${hue} 85% 62%)`;
}

function drawNormalBrick(ctx, brick, color, stage) {
  const x = brick.x + 1;
  const y = brick.y + 1;
  const w = brick.w - 2;
  const h = brick.h - 2;
  const path = roundRectPath(x, y, w, h, { tl: 4, tr: 4, br: 4, bl: 4 });

  ctx.save();
  ctx.fillStyle = crystalFill(ctx, x, y, w, h, color);
  ctx.fill(path);

  // Subtle per-stage tint for more visual variety across stages.
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = stageTone(stage, brick.row, brick.colorIndex);
  ctx.fill(path);

  ctx.globalAlpha = 1;
  drawFacet(ctx, x, y, w, h, 0.24);

  // Glass top highlight.
  ctx.globalAlpha = 0.33;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + 2, y + 2, w - 4, h * 0.2);

  // Diagonal sheen.
  ctx.globalAlpha = 0.14;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.06, y + h * 0.9);
  ctx.lineTo(x + w * 0.34, y + h * 0.09);
  ctx.lineTo(x + w * 0.41, y + h * 0.09);
  ctx.lineTo(x + w * 0.13, y + h * 0.9);
  ctx.closePath();
  ctx.fill();

  // Tiny sparkle point.
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.arc(x + w * 0.82, y + h * 0.24, 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
  const edge = ctx.createLinearGradient(x, y, x + w, y + h);
  edge.addColorStop(0, 'rgba(255,255,255,0.45)');
  edge.addColorStop(0.45, 'rgba(255,255,255,0.08)');
  edge.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.3;
  ctx.stroke(path);

  ctx.restore();
}

function drawSilverBrick(ctx, brick) {
  const x = brick.x + 1;
  const y = brick.y + 1;
  const w = brick.w - 2;
  const h = brick.h - 2;
  const hp = brick.hits / brick.maxHits;
  const path = roundRectPath(x, y, w, h, { tl: 4, tr: 4, br: 4, bl: 4 });

  const top = shadeHex('#cbd5e1', 0.25 * hp + 0.15);
  const mid = shadeHex('#94a3b8', 0.15 * hp);
  const bot = shadeHex('#64748b', -0.15 + hp * 0.08);

  ctx.save();
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, top);
  grad.addColorStop(0.5, mid);
  grad.addColorStop(1, bot);
  ctx.fillStyle = grad;
  ctx.fill(path);

  ctx.globalAlpha = 0.32;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + 2, y + 2, w - 4, h * 0.24);

  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(245,248,255,0.8)';
  ctx.lineWidth = 1;
  ctx.stroke(path);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(brick.hits), x + w / 2, y + h / 2 + 4);
  ctx.restore();
}

function drawGoldBrick(ctx, brick) {
  const x = brick.x + 1;
  const y = brick.y + 1;
  const w = brick.w - 2;
  const h = brick.h - 2;
  const path = roundRectPath(x, y, w, h, { tl: 4, tr: 4, br: 4, bl: 4 });

  ctx.save();
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, '#fff3a8');
  grad.addColorStop(0.45, '#facc15');
  grad.addColorStop(1, '#d97706');
  ctx.fillStyle = grad;
  ctx.fill(path);

  ctx.globalAlpha = 0.34;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + 2, y + 2, w - 4, h * 0.25);

  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(120,70,0,0.6)';
  ctx.lineWidth = 1.2;
  ctx.stroke(path);
  ctx.restore();
}

export function drawBricks(ctx, bricks, brickColors, stage = 1) {
  for (const brick of bricks) {
    if (brick.type === 'gold') {
      drawGoldBrick(ctx, brick);
      continue;
    }

    if (brick.type === 'silver') {
      drawSilverBrick(ctx, brick);
      continue;
    }

    const color = brickColors[brick.colorIndex % brickColors.length];
    drawNormalBrick(ctx, brick, color, stage);
  }
}

export function drawPaddle(ctx, paddle, y, effects) {
  const x = paddle.x;
  const w = paddle.width;
  const h = 12;
  const base = effects.laser ? '#ef4444' : '#3b82f6';
  const path = roundRectPath(x, y, w, h, { tl: 6, tr: 6, br: 6, bl: 6 });

  ctx.save();

  ctx.shadowColor = effects.laser ? 'rgba(248,113,113,0.45)' : 'rgba(59,130,246,0.32)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 2;

  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, shadeHex(base, 0.34));
  grad.addColorStop(0.55, base);
  grad.addColorStop(1, shadeHex(base, -0.34));
  ctx.fillStyle = grad;
  ctx.fill(path);

  ctx.shadowColor = 'transparent';
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + 5, y + 2, w - 10, h * 0.24);

  const gloss = ctx.createLinearGradient(x, y, x + w, y + h);
  gloss.addColorStop(0, 'rgba(255,255,255,0.26)');
  gloss.addColorStop(0.45, 'rgba(255,255,255,0)');
  gloss.addColorStop(1, 'rgba(255,255,255,0.18)');
  ctx.globalAlpha = 0.38;
  ctx.fillStyle = gloss;
  ctx.fill(path);

  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke(path);

  if (effects.laser) {
    const cannonY = y - 4;
    const cannonW = 7;
    const cannonH = 5;
    const left = x + 9;
    const right = x + w - 16;

    const cannonGrad = ctx.createLinearGradient(0, cannonY, 0, cannonY + cannonH);
    cannonGrad.addColorStop(0, '#f8fafc');
    cannonGrad.addColorStop(1, '#94a3b8');

    ctx.fillStyle = cannonGrad;
    ctx.fillRect(left, cannonY, cannonW, cannonH);
    ctx.fillRect(right, cannonY, cannonW, cannonH);
  }

  ctx.restore();
}

export function drawBalls(ctx, balls, effects) {
  for (const ball of balls) {
    const r = 6;
    const base = effects.breakGate ? '#f97316' : '#fbbf24';

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.26)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;

    const grad = ctx.createRadialGradient(
      ball.x - r * 0.35,
      ball.y - r * 0.4,
      r * 0.2,
      ball.x,
      ball.y,
      r
    );
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.28, shadeHex(base, 0.4));
    grad.addColorStop(0.7, base);
    grad.addColorStop(1, shadeHex(base, -0.38));

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ball.x - r * 0.35, ball.y - r * 0.35, r * 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, r - 0.7, Math.PI * 1.1, Math.PI * 1.95);
    ctx.stroke();

    ctx.restore();
  }
}

export function drawBullets(ctx, bullets, bulletW, bulletH) {
  if (bullets.length === 0) return;

  for (const bullet of bullets) {
    const x = bullet.x - bulletW / 2;
    const y = bullet.y - bulletH;
    const grad = ctx.createLinearGradient(x, y, x, y + bulletH);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, '#cbd5e1');
    grad.addColorStop(1, '#64748b');

    ctx.fillStyle = grad;
    ctx.fillRect(x, y, bulletW, bulletH);
    ctx.strokeStyle = 'rgba(15,23,42,0.35)';
    ctx.strokeRect(x, y, bulletW, bulletH);
  }
}

export function drawCapsules(ctx, capsules) {
  for (const cap of capsules) {
    const x = cap.x - 12;
    const y = cap.y - 8;
    const w = 24;
    const h = 16;
    const path = roundRectPath(x, y, w, h, { tl: 8, tr: 8, br: 8, bl: 8 });

    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#f8fafc');
    grad.addColorStop(0.48, '#334155');
    grad.addColorStop(1, '#0f172a');

    ctx.save();
    ctx.fillStyle = grad;
    ctx.fill(path);

    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 2, y + 2, w - 4, h * 0.3);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(226,232,240,0.8)';
    ctx.lineWidth = 1;
    ctx.stroke(path);

    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(cap.type, cap.x, cap.y + 4);
    ctx.restore();
  }
}
