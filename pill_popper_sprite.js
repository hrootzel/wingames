import { roundRectPath, shadeHex } from './rendering_engine.js';

function segmentInsets(link, s) {
  if (link === 'L' || link === 'R') {
    return { padX: s * 0.06, padY: s * 0.14 };
  }
  if (link === 'U' || link === 'D') {
    return { padX: s * 0.14, padY: s * 0.06 };
  }
  return { padX: s * 0.1, padY: s * 0.1 };
}

function segmentRadii(link, baseR, flatR) {
  const r = { tl: baseR, tr: baseR, br: baseR, bl: baseR };
  if (link === 'R') {
    r.tr = flatR;
    r.br = flatR;
  } else if (link === 'L') {
    r.tl = flatR;
    r.bl = flatR;
  } else if (link === 'U') {
    r.tl = flatR;
    r.tr = flatR;
  } else if (link === 'D') {
    r.bl = flatR;
    r.br = flatR;
  }
  return r;
}

export function drawSegment(ctx, x, y, s, colorKey, link, paletteMap) {
  const palette = paletteMap[colorKey];
  const { padX, padY } = segmentInsets(link, s);
  const w = s - padX * 2;
  const h = s - padY * 2;
  const x0 = x + padX;
  const y0 = y + padY;
  const baseR = Math.min(w, h) / 2;
  const flatR = baseR * 0.28;
  const radii = segmentRadii(link, baseR, flatR);
  const path = roundRectPath(x0, y0, w, h, radii);

  const gx = x0 + w * 0.32;
  const gy = y0 + h * 0.25;
  const r0 = Math.min(w, h) * 0.08;
  const r1 = Math.max(w, h) * 0.95;
  const grad = ctx.createRadialGradient(gx, gy, r0, gx, gy, r1);
  grad.addColorStop(0, shadeHex(palette.light, 0.12));
  grad.addColorStop(0.55, palette.base);
  grad.addColorStop(1, palette.dark);
  ctx.fillStyle = grad;
  ctx.fill(path);

  ctx.lineWidth = Math.max(1, s * 0.055);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.stroke(path);

  ctx.save();
  ctx.clip(path);
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.ellipse(
    x0 + w * 0.35,
    y0 + h * 0.3,
    w * 0.38,
    h * 0.24,
    -0.35,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.globalAlpha = 0.38;
  ctx.beginPath();
  ctx.arc(x0 + w * 0.28, y0 + h * 0.22, Math.min(w, h) * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawVirus(ctx, x, y, s, colorKey, paletteMap) {
  const palette = paletteMap[colorKey];
  const virusPalette = {
    light: shadeHex(palette.light, -0.35),
    base: shadeHex(palette.base, -0.3),
    dark: shadeHex(palette.dark, -0.45),
  };
  const cx = x + s / 2;
  const cy = y + s / 2;
  const r = s * 0.42;
  const gx = cx - r + 2 * r * 0.35;
  const gy = cy - r + 2 * r * 0.3;
  const r0 = 2 * r * 0.05;
  const r1 = 2 * r * 0.85;
  const grad = ctx.createRadialGradient(gx, gy, r0, gx, gy, r1);
  grad.addColorStop(0, virusPalette.light);
  grad.addColorStop(0.55, virusPalette.base);
  grad.addColorStop(1, virusPalette.dark);

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.lineWidth = Math.max(1, s * 0.06);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.stroke();

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.strokeStyle = virusPalette.light;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.lineWidth = Math.max(1, s * 0.04);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.38)';
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  ctx.globalAlpha = 0.22;
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.ellipse(
    cx - r * 0.28,
    cy - r * 0.38,
    r * 0.7,
    r * 0.48,
    -0.35,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.arc(cx - r * 0.38, cy - r * 0.48, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  const eyeOffsetX = r * 0.22;
  const eyeOffsetY = r * 0.08;
  const eyeR = r * 0.14;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.beginPath();
  ctx.arc(cx - eyeOffsetX, cy - eyeOffsetY, eyeR, 0, Math.PI * 2);
  ctx.arc(cx + eyeOffsetX, cy - eyeOffsetY, eyeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(10, 10, 10, 0.9)';
  ctx.beginPath();
  ctx.arc(cx - eyeOffsetX + r * 0.04, cy - eyeOffsetY, eyeR * 0.42, 0, Math.PI * 2);
  ctx.arc(cx + eyeOffsetX + r * 0.04, cy - eyeOffsetY, eyeR * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(10, 10, 10, 0.75)';
  ctx.lineWidth = Math.max(1, s * 0.035);
  ctx.lineCap = 'round';
  const browY = cy - eyeOffsetY - eyeR * 0.9;
  ctx.beginPath();
  ctx.moveTo(cx - eyeOffsetX - eyeR * 0.6, browY - eyeR * 0.2);
  ctx.lineTo(cx - eyeOffsetX + eyeR * 0.4, browY + eyeR * 0.2);
  ctx.moveTo(cx + eyeOffsetX - eyeR * 0.4, browY + eyeR * 0.2);
  ctx.lineTo(cx + eyeOffsetX + eyeR * 0.6, browY - eyeR * 0.2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.24, r * 0.2, 1.1 * Math.PI, 1.9 * Math.PI);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = virusPalette.dark;
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r * 0.35, cy + Math.sin(a) * r * 0.25, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
