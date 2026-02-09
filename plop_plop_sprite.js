export function createPlopPlopSprite(palette, pinch, steps) {
  const TAU = Math.PI * 2;

  function normPhase(phase) {
    const t = phase % TAU;
    return t < 0 ? t + TAU : t;
  }

  function coreHueForColor(colorKey) {
    switch (colorKey) {
      case 'R':
        return 8;
      case 'G':
        return 112;
      case 'B':
        return 208;
      case 'Y':
        return 46;
      case 'X':
      default:
        return 28;
    }
  }

  function drawBlobCore(ctx, r) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
  }

  function plopMotion(phase, seed, squash, popScale) {
    const wobbleX = 1 + Math.sin(phase * 2 + seed * 1.7) * 0.028;
    const wobbleY = 1 + Math.cos(phase * 3 + seed * 2.3) * 0.03;
    const tilt = Math.sin(phase * 1 + seed * 0.9) * 0.085;
    return {
      tilt,
      sx: (wobbleX + squash * 0.18) * popScale,
      sy: (wobbleY - squash * 0.14) * popScale,
    };
  }

  function drawPlopShadow(ctx, cx, cy, r, popScale) {
    ctx.save();
    ctx.globalAlpha = (ctx.globalAlpha || 1) * 0.24;
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.88, r * 0.95 * popScale, r * 0.34 * popScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlopShell(ctx, s, r, colors) {
    const grad = ctx.createRadialGradient(-r * 0.36, -r * 0.4, r * 0.12, 0, 0, r * 1.03);
    grad.addColorStop(0, colors.light);
    grad.addColorStop(0.52, colors.base);
    grad.addColorStop(1, colors.dark);
    ctx.fillStyle = grad;
    drawBlobCore(ctx, r);
    ctx.fill();

    const innerShade = ctx.createRadialGradient(r * 0.18, r * 0.35, r * 0.1, 0, 0, r * 1.15);
    innerShade.addColorStop(0, 'rgba(2, 6, 23, 0)');
    innerShade.addColorStop(1, 'rgba(2, 6, 23, 0.28)');
    ctx.fillStyle = innerShade;
    drawBlobCore(ctx, r);
    ctx.fill();

    ctx.lineWidth = Math.max(1, s * 0.052);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.19)';
    drawBlobCore(ctx, r * 0.98);
    ctx.stroke();

    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.strokeStyle = 'rgba(2, 6, 23, 0.34)';
    drawBlobCore(ctx, r);
    ctx.stroke();
  }

  function drawPlopSpecular(ctx, r) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.24, -r * 0.3, r * 0.34, r * 0.22, -0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.arc(-r * 0.06, -r * 0.47, r * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlopInnerCore(ctx, r, phase, seed, colorKey) {
    const pulse = 0.5 + 0.5 * Math.sin(phase * 2 + seed * 1.4);
    const ember = 0.5 + 0.5 * Math.cos(phase * 4 + seed * 2.1);
    const hueBase = coreHueForColor(colorKey);
    const hueWarm = (hueBase + 18 + pulse * 22) % 360;
    const hueHot = (hueBase + 40 + ember * 34) % 360;
    const hueSparkA = (hueBase + 85 + pulse * 45) % 360;
    const hueSparkB = (hueBase + 155 + ember * 55) % 360;
    const coreRadius = r * (0.2 + pulse * 0.08);
    const coreX = Math.sin(phase * 1 + seed * 2.8) * r * 0.12;
    const coreY = Math.cos(phase * 2 + seed * 1.6) * r * 0.1;

    const innerGlow = ctx.createRadialGradient(
      coreX,
      coreY,
      coreRadius * 0.2,
      coreX,
      coreY,
      r * (0.62 + pulse * 0.08)
    );
    innerGlow.addColorStop(0, `hsla(${hueHot} 96% 72% / ${0.42 + pulse * 0.26})`);
    innerGlow.addColorStop(0.4, `hsla(${hueWarm} 92% 60% / ${0.24 + pulse * 0.2})`);
    innerGlow.addColorStop(1, `hsla(${(hueBase + 8) % 360} 90% 50% / 0)`);
    ctx.fillStyle = innerGlow;
    drawBlobCore(ctx, r * 0.96);
    ctx.fill();

    ctx.fillStyle = `hsla(${hueHot} 100% 84% / ${0.48 + ember * 0.28})`;
    ctx.beginPath();
    ctx.arc(coreX * 0.75, coreY * 0.75, r * (0.06 + ember * 0.03), 0, Math.PI * 2);
    ctx.fill();

    const spark1X = Math.sin(phase * 3 + seed * 1.1) * r * 0.2;
    const spark1Y = Math.cos(phase * 2 + seed * 2.4) * r * 0.18;
    ctx.fillStyle = `hsla(${hueSparkA} 96% 72% / ${0.22 + pulse * 0.2})`;
    ctx.beginPath();
    ctx.arc(spark1X, spark1Y, r * 0.04, 0, Math.PI * 2);
    ctx.fill();

    const spark2X = Math.cos(phase * 4 + seed * 1.9) * r * 0.22;
    const spark2Y = Math.sin(phase * 1 + seed * 2.7) * r * 0.15;
    ctx.fillStyle = `hsla(${hueSparkB} 94% 66% / ${0.18 + ember * 0.16})`;
    ctx.beginPath();
    ctx.arc(spark2X, spark2Y, r * 0.03, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlop(ctx, x, y, s, colorKey, opts = {}) {
    const colors = palette[colorKey];
    const cx = x + s / 2;
    const cy = y + s / 2;
    const r = s * 0.42;
    const phase = normPhase(opts.phase || 0);
    const seed = opts.seed || 0;
    const squash = opts.squash || 0; // -1 = squished, +1 = stretched
    const popScale = opts.popScale !== undefined ? opts.popScale : 1;
    const motion = plopMotion(phase, seed, squash, popScale);

    drawPlopShadow(ctx, cx, cy, r, popScale);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(motion.tilt);
    ctx.scale(motion.sx, motion.sy);

    drawPlopShell(ctx, s, r, colors);
    drawPlopSpecular(ctx, r);

    if (popScale > 0.3) {
      drawPlopInnerCore(ctx, r, phase, seed, colorKey);
    }

    ctx.restore();
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

  function drawBridge(ctx, ax, ay, bx, by, colorKey, s, opts = {}) {
    const colors = palette[colorKey];
    const r = s * 0.42;
    const phase = normPhase(opts.phase || 0);
    const seed = opts.seed || 0;
    const path = new Path2D();
    addTaperBridge(path, ax, ay, bx, by, r);

    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return;
    const ux = dx / len;
    const uy = dy / len;
    const px = -uy;
    const py = ux;
    const mx = (ax + bx) * 0.5;
    const my = (ay + by) * 0.5;
    const flow = Math.sin(phase * 2 + seed * 1.1) * 0.18;
    const grad = ctx.createLinearGradient(
      ax - px * r * (0.48 + flow),
      ay - py * r * (0.48 + flow),
      bx + px * r * (0.42 - flow),
      by + py * r * (0.42 - flow)
    );
    grad.addColorStop(0, colors.dark);
    grad.addColorStop(0.52, colors.base);
    grad.addColorStop(1, colors.light);
    ctx.save();
    ctx.fillStyle = grad;
    ctx.fill(path);

    ctx.clip(path);
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.2, r * 0.64);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.beginPath();
    ctx.moveTo(ax - px * r * 0.24, ay - py * r * 0.24);
    ctx.lineTo(mx - px * r * 0.2, my - py * r * 0.2);
    ctx.lineTo(bx - px * r * 0.24, by - py * r * 0.24);
    ctx.stroke();
    ctx.restore();

    ctx.lineWidth = Math.max(1, s * 0.048);
    ctx.strokeStyle = 'rgba(2, 6, 23, 0.3)';
    ctx.stroke(path);
  }

  return { drawPlop: drawPlop, drawBridge };
}
