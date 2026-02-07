import { roundRect } from './rendering_engine.js';

export function drawGemFill(ctx, x, y, s, palette, opts = {}) {
  const r = s * 0.2;
  const grad = ctx.createLinearGradient(x, y, x + s, y + s);
  grad.addColorStop(0, palette.light);
  grad.addColorStop(0.5, palette.base);
  grad.addColorStop(1, palette.dark);
  ctx.fillStyle = grad;
  roundRect(ctx, x + 1, y + 1, s - 2, s - 2, r);
  ctx.fill();

  if (opts.highlight !== false) {
    ctx.save();
    const phase = opts.shinePhase ?? 0;
    const shimmer = 0.22 + 0.22 * (0.5 + 0.5 * Math.sin(phase * 6.283));
    ctx.globalAlpha = shimmer;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(
      x + s * (0.31 + 0.05 * Math.sin(phase * 12.566)),
      y + s * 0.27,
      s * 0.25,
      s * 0.18,
      -0.4,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();
  }

  if (opts.face) {
    drawGemFace(ctx, x, y, s, opts.faceVariant ?? 0);
  }
}

export function drawGemBorder(ctx, x, y, s, stroke) {
  const r = s * 0.2;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  roundRect(ctx, x + 1, y + 1, s - 2, s - 2, r);
  ctx.stroke();
}

export function drawPowerEdges(ctx, x, y, s, edges, stroke) {
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  const inset = 2;
  if (edges.top) {
    ctx.beginPath();
    ctx.moveTo(x + inset, y + inset);
    ctx.lineTo(x + s - inset, y + inset);
    ctx.stroke();
  }
  if (edges.bottom) {
    ctx.beginPath();
    ctx.moveTo(x + inset, y + s - inset);
    ctx.lineTo(x + s - inset, y + s - inset);
    ctx.stroke();
  }
  if (edges.left) {
    ctx.beginPath();
    ctx.moveTo(x + inset, y + inset);
    ctx.lineTo(x + inset, y + s - inset);
    ctx.stroke();
  }
  if (edges.right) {
    ctx.beginPath();
    ctx.moveTo(x + s - inset, y + inset);
    ctx.lineTo(x + s - inset, y + s - inset);
    ctx.stroke();
  }
}

export function drawCrashOverlay(ctx, x, y, s) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = Math.max(2, s * 0.1);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x + s * 0.24, y + s * 0.24);
  ctx.lineTo(x + s * 0.76, y + s * 0.76);
  ctx.moveTo(x + s * 0.76, y + s * 0.24);
  ctx.lineTo(x + s * 0.24, y + s * 0.76);
  ctx.stroke();
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.arc(x + s * 0.5, y + s * 0.5, s * 0.16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawGemFace(ctx, x, y, s, variant) {
  const eyeY = y + s * 0.48;
  const eyeRX = s * 0.045;
  const eyeRY = s * 0.06;
  const leftX = x + s * 0.38;
  const rightX = x + s * 0.62;
  ctx.save();
  ctx.fillStyle = 'rgba(13, 18, 26, 0.72)';
  ctx.beginPath();
  ctx.ellipse(leftX, eyeY, eyeRX, eyeRY, 0, 0, Math.PI * 2);
  ctx.ellipse(rightX, eyeY, eyeRX, eyeRY, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(13, 18, 26, 0.72)';
  ctx.lineWidth = Math.max(1, s * 0.06);
  ctx.lineCap = 'round';
  const mouthY = y + s * 0.67;
  if (variant % 4 === 0) {
    ctx.beginPath();
    ctx.arc(x + s * 0.5, mouthY, s * 0.1, 0, Math.PI);
    ctx.stroke();
  } else if (variant % 4 === 1) {
    ctx.beginPath();
    ctx.arc(x + s * 0.5, mouthY + s * 0.03, s * 0.08, Math.PI, 0);
    ctx.stroke();
  } else if (variant % 4 === 2) {
    ctx.beginPath();
    ctx.moveTo(x + s * 0.42, mouthY);
    ctx.lineTo(x + s * 0.58, mouthY);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(x + s * 0.5, mouthY, s * 0.06, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawGarbageOverlay(ctx, x, y, s) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(1.2, s * 0.045);
  ctx.beginPath();
  ctx.moveTo(x + s * 0.2, y + s * 0.2);
  ctx.lineTo(x + s * 0.8, y + s * 0.8);
  ctx.moveTo(x + s * 0.8, y + s * 0.2);
  ctx.lineTo(x + s * 0.2, y + s * 0.8);
  ctx.stroke();
  ctx.restore();
}

export function drawCounterNumber(ctx, x, y, s, value) {
  if (!Number.isFinite(value) || value <= 0) return;
  ctx.save();
  ctx.fillStyle = '#fef3c7';
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.lineWidth = 3;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${Math.floor(s * 0.42)}px Trebuchet MS, Segoe UI, sans-serif`;
  const txt = String(Math.floor(value));
  ctx.strokeText(txt, x + s * 0.5, y + s * 0.54);
  ctx.fillText(txt, x + s * 0.5, y + s * 0.54);
  ctx.restore();
}

export function drawPowerRectGloss(ctx, x, y, w, h, palette, phase = 0) {
  const r = Math.min(w, h) * 0.18;
  ctx.save();

  const body = ctx.createLinearGradient(x, y, x + w, y + h);
  body.addColorStop(0, palette.light);
  body.addColorStop(0.55, palette.base);
  body.addColorStop(1, palette.dark);
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = body;
  roundRect(ctx, x + 1, y + 1, w - 2, h - 2, r);
  ctx.fill();

  const gleam = ctx.createLinearGradient(x, y, x, y + h * 0.6);
  gleam.addColorStop(0, 'rgba(255,255,255,0.55)');
  gleam.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = gleam;
  roundRect(ctx, x + 2, y + 2, w - 4, Math.max(8, h * 0.42), r * 0.8);
  ctx.fill();

  ctx.globalAlpha = 0.28 + 0.2 * (0.5 + 0.5 * Math.sin(phase * 6.283));
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(
    x + w * 0.26 + Math.sin(phase * 12.566) * Math.min(6, w * 0.05),
    y + h * 0.22,
    Math.max(8, w * 0.2),
    Math.max(6, h * 0.14),
    -0.35,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = palette.stroke;
  roundRect(ctx, x + 1, y + 1, w - 2, h - 2, r);
  ctx.stroke();
  ctx.restore();
}

export function drawDiamond(ctx, x, y, s) {
  const size = s * 0.6;
  ctx.save();
  ctx.translate(x + s / 2, y + s / 2);
  ctx.rotate(Math.PI / 4);
  const grad = ctx.createLinearGradient(-size / 2, -size / 2, size / 2, size / 2);
  grad.addColorStop(0, '#f9fafb');
  grad.addColorStop(1, '#94a3b8');
  ctx.fillStyle = grad;
  ctx.fillRect(-size / 2, -size / 2, size, size);
  const rainbow = ctx.createLinearGradient(-size / 2, 0, size / 2, 0);
  rainbow.addColorStop(0, '#f43f5e');
  rainbow.addColorStop(0.25, '#f59e0b');
  rainbow.addColorStop(0.5, '#22c55e');
  rainbow.addColorStop(0.75, '#3b82f6');
  rainbow.addColorStop(1, '#a855f7');
  ctx.strokeStyle = rainbow;
  ctx.lineWidth = s * 0.12;
  ctx.strokeRect(-size / 2, -size / 2, size, size);
  ctx.restore();
}
