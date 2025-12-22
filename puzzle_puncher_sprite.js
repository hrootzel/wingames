import { roundRect } from './rendering_engine.js';

export function drawGemFill(ctx, x, y, s, palette) {
  const r = s * 0.2;
  const grad = ctx.createLinearGradient(x, y, x + s, y + s);
  grad.addColorStop(0, palette.light);
  grad.addColorStop(0.5, palette.base);
  grad.addColorStop(1, palette.dark);
  ctx.fillStyle = grad;
  roundRect(ctx, x + 1, y + 1, s - 2, s - 2, r);
  ctx.fill();

  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(x + s * 0.34, y + s * 0.28, s * 0.25, s * 0.18, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
