export function roundRect(ctx, x, y, w, h, r, corners) {
  const cfg = corners || { tl: true, tr: true, br: true, bl: true };
  const tl = cfg.tl ? r : 0;
  const tr = cfg.tr ? r : 0;
  const br = cfg.br ? r : 0;
  const bl = cfg.bl ? r : 0;

  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  if (tr) ctx.arcTo(x + w, y, x + w, y + tr, tr);
  else ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - br);
  if (br) ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  else ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + bl, y + h);
  if (bl) ctx.arcTo(x, y + h, x, y + h - bl, bl);
  else ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + tl);
  if (tl) ctx.arcTo(x, y, x + tl, y, tl);
  else ctx.lineTo(x, y);
  ctx.closePath();
}

export function roundRectPath(x, y, w, h, radii) {
  const maxR = Math.min(w, h) / 2;
  const tl = Math.min(radii.tl, maxR);
  const tr = Math.min(radii.tr, maxR);
  const br = Math.min(radii.br, maxR);
  const bl = Math.min(radii.bl, maxR);

  const p = new Path2D();
  p.moveTo(x + tl, y);
  p.lineTo(x + w - tr, y);
  p.arcTo(x + w, y, x + w, y + tr, tr);
  p.lineTo(x + w, y + h - br);
  p.arcTo(x + w, y + h, x + w - br, y + h, br);
  p.lineTo(x + bl, y + h);
  p.arcTo(x, y + h, x, y + h - bl, bl);
  p.lineTo(x, y + tl);
  p.arcTo(x, y, x + tl, y, tl);
  p.closePath();
  return p;
}

export function hexToRgb(hex) {
  const cleaned = hex.replace('#', '');
  const full = cleaned.length === 3
    ? cleaned.split('').map((c) => c + c).join('')
    : cleaned;
  const num = Number.parseInt(full, 16);
  if (!Number.isFinite(num)) return null;
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

export function shadeHex(hex, amount) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const t = amount < 0 ? 0 : 255;
  const p = Math.min(1, Math.max(0, Math.abs(amount)));
  const r = Math.round(rgb.r + (t - rgb.r) * p);
  const g = Math.round(rgb.g + (t - rgb.g) * p);
  const b = Math.round(rgb.b + (t - rgb.b) * p);
  return `rgb(${r}, ${g}, ${b})`;
}
