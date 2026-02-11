const HALF = 0.5;

export const ISO_DIRS = ['NE', 'NW', 'SE', 'SW'];

export const DIR_VECTORS = {
  NE: { x: 1, y: -1 },
  NW: { x: -1, y: -1 },
  SE: { x: 1, y: 1 },
  SW: { x: -1, y: 1 },
};

export function isoToScreen(x, y, tileW = 64, tileH = 32) {
  return {
    x: (x - y) * tileW * HALF,
    y: (x + y) * tileH * HALF,
  };
}

export function screenToIso(sx, sy, tileW = 64, tileH = 32) {
  const ix = sy / tileH + sx / tileW;
  const iy = sy / tileH - sx / tileW;
  return { x: ix, y: iy };
}

export function nearFarForDir(dir) {
  return (dir === 'NE' || dir === 'SE')
    ? { near: 'R', far: 'L' }
    : { near: 'L', far: 'R' };
}
