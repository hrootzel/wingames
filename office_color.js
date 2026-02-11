export function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

export function hexToRgb(hex) {
  const clean = String(hex || '').trim().replace('#', '');
  const src = clean.length === 3
    ? clean.split('').map((c) => `${c}${c}`).join('')
    : clean.padEnd(6, '0').slice(0, 6);
  const n = Number.parseInt(src, 16);
  return {
    r: (n >> 16) & 0xff,
    g: (n >> 8) & 0xff,
    b: n & 0xff,
  };
}

export function rgbToHex(rgb) {
  const r = Math.max(0, Math.min(255, Math.round(rgb.r)));
  const g = Math.max(0, Math.min(255, Math.round(rgb.g)));
  const b = Math.max(0, Math.min(255, Math.round(rgb.b)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function darken(hex, amount = 0.2) {
  const t = clamp01(amount);
  const c = hexToRgb(hex);
  return rgbToHex({
    r: c.r * (1 - t),
    g: c.g * (1 - t),
    b: c.b * (1 - t),
  });
}
