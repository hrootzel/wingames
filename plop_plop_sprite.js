export function createPlopPlopSprite(palette, pinch, steps) {
  function drawPuyo(ctx, x, y, s, colorKey) {
    const colors = palette[colorKey];
    const cx = x + s / 2;
    const cy = y + s / 2;
    const r = s * 0.42;
    const grad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
    grad.addColorStop(0, colors.light);
    grad.addColorStop(0.55, colors.base);
    grad.addColorStop(1, colors.dark);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(1, s * 0.06);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.stroke();
  }

  function addTaperBridge(path, ax, ay, bx, by, r) {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return;

    const ux = dx / len;
    const uy = dy / len;
    const px = -uy;
    const py = ux;

    function w(t) {
      const s = Math.sin(Math.PI * t);
      const s2 = s * s;
      return r * (1 - (1 - pinch) * s2);
    }

    const top = [];
    const bot = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const wt = w(t);
      const x = ax + dx * t;
      const y = ay + dy * t;
      top.push({ x: x + px * wt, y: y + py * wt });
      bot.push({ x: x - px * wt, y: y - py * wt });
    }

    path.moveTo(top[0].x, top[0].y);
    for (let i = 1; i < top.length; i++) path.lineTo(top[i].x, top[i].y);
    for (let i = bot.length - 1; i >= 0; i--) path.lineTo(bot[i].x, bot[i].y);
    path.closePath();
  }

  function drawBridge(ctx, ax, ay, bx, by, colorKey, s) {
    const colors = palette[colorKey];
    const r = s * 0.42;
    const path = new Path2D();
    addTaperBridge(path, ax, ay, bx, by, r);

    const mx = (ax + bx) * 0.5;
    const my = (ay + by) * 0.5;
    const grad = ctx.createRadialGradient(mx - r * 0.25, my - r * 0.25, r * 0.15, mx, my, r * 1.2);
    grad.addColorStop(0, colors.light);
    grad.addColorStop(0.55, colors.base);
    grad.addColorStop(1, colors.dark);
    ctx.fillStyle = grad;
    ctx.fill(path);

    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.stroke(path);
  }

  return { drawPuyo, drawBridge };
}
