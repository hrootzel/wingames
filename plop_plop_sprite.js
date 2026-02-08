export function createPlopPlopSprite(palette, pinch, steps) {
  function drawBlobCore(ctx, r) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
  }

  function drawEyes(ctx, r, phase, seed, colorKey) {
    const blinkCycle = ((phase * 1.1 + seed * 3.7) % (Math.PI * 2));
    const blink = blinkCycle > 5.9 ? Math.max(0, 1 - (blinkCycle - 5.9) * 8) : 1;
    const lookX = Math.sin(phase * 0.7 + seed * 1.3) * r * 0.06;
    const lookY = Math.cos(phase * 0.5 + seed * 1.9) * r * 0.04;
    const eyeSpacing = r * 0.32;
    const eyeY = -r * 0.1;
    const eyeR = r * 0.16;
    const pupilR = r * 0.09;
    for (let side = -1; side <= 1; side += 2) {
      const ex = side * eyeSpacing + lookX;
      const ey = eyeY + lookY;
      // White
      ctx.fillStyle = colorKey === 'X' ? 'rgba(200,200,200,0.85)' : '#fff';
      ctx.beginPath();
      ctx.ellipse(ex, ey, eyeR, eyeR * blink, 0, 0, Math.PI * 2);
      ctx.fill();
      // Pupil
      if (blink > 0.3) {
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.arc(ex + lookX * 0.5, ey + lookY * 0.3, pupilR * blink, 0, Math.PI * 2);
        ctx.fill();
        // Pupil highlight
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.arc(ex + lookX * 0.5 - pupilR * 0.3, ey + lookY * 0.3 - pupilR * 0.3, pupilR * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawPuyo(ctx, x, y, s, colorKey, opts = {}) {
    const colors = palette[colorKey];
    const cx = x + s / 2;
    const cy = y + s / 2;
    const r = s * 0.42;
    const phase = opts.phase || 0;
    const seed = opts.seed || 0;
    const squash = opts.squash || 0; // -1 = squished, +1 = stretched
    const popScale = opts.popScale !== undefined ? opts.popScale : 1;
    const wobbleX = 1 + Math.sin(phase * 2.1 + seed * 1.7) * 0.028;
    const wobbleY = 1 + Math.cos(phase * 1.8 + seed * 2.3) * 0.03;
    const tilt = Math.sin(phase * 1.3 + seed * 0.9) * 0.085;
    const sx = (wobbleX + squash * 0.18) * popScale;
    const sy = (wobbleY - squash * 0.14) * popScale;

    ctx.save();
    ctx.globalAlpha = (ctx.globalAlpha || 1) * 0.24;
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.88, r * 0.95 * popScale, r * 0.34 * popScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);
    ctx.scale(sx, sy);

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

    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.24, -r * 0.3, r * 0.34, r * 0.22, -0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.arc(-r * 0.06, -r * 0.47, r * 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    if (popScale > 0.3) {
      drawEyes(ctx, r, phase, seed, colorKey);
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
    const phase = opts.phase || 0;
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
    const flow = Math.sin(phase * 1.7 + seed * 1.1) * 0.18;
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

  return { drawPuyo, drawBridge };
}
