import { darken, hexToRgb, rgbToHex } from './office_color.js';
import { nearFarForDir } from './office_iso.js';

function roundedRectPath(x, y, w, h, r) {
  const rr = Math.min(r, w * 0.5, h * 0.5);
  const p = new Path2D();
  p.moveTo(x + rr, y);
  p.lineTo(x + w - rr, y);
  p.quadraticCurveTo(x + w, y, x + w, y + rr);
  p.lineTo(x + w, y + h - rr);
  p.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  p.lineTo(x + rr, y + h);
  p.quadraticCurveTo(x, y + h, x, y + h - rr);
  p.lineTo(x, y + rr);
  p.quadraticCurveTo(x, y, x + rr, y);
  p.closePath();
  return p;
}

function roundedRectPathXY(x, y, w, h, rx, ry) {
  const rrX = Math.min(Math.max(0, rx), w * 0.5);
  const rrY = Math.min(Math.max(0, ry), h * 0.5);
  const k = 0.5522847498307936;
  const p = new Path2D();
  p.moveTo(x + rrX, y);
  p.lineTo(x + w - rrX, y);
  p.bezierCurveTo(x + w - rrX + rrX * k, y, x + w, y + rrY - rrY * k, x + w, y + rrY);
  p.lineTo(x + w, y + h - rrY);
  p.bezierCurveTo(x + w, y + h - rrY + rrY * k, x + w - rrX + rrX * k, y + h, x + w - rrX, y + h);
  p.lineTo(x + rrX, y + h);
  p.bezierCurveTo(x + rrX - rrX * k, y + h, x, y + h - rrY + rrY * k, x, y + h - rrY);
  p.lineTo(x, y + rrY);
  p.bezierCurveTo(x, y + rrY - rrY * k, x + rrX - rrX * k, y, x + rrX, y);
  p.closePath();
  return p;
}

function capsulePath(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const p = new Path2D();
  p.moveTo(x1 + nx * r, y1 + ny * r);
  p.lineTo(x2 + nx * r, y2 + ny * r);
  p.arc(x2, y2, r, Math.atan2(ny, nx), Math.atan2(-ny, -nx));
  p.lineTo(x1 - nx * r, y1 - ny * r);
  p.arc(x1, y1, r, Math.atan2(-ny, -nx), Math.atan2(ny, nx));
  p.closePath();
  return p;
}

function ellipsePath(cx, cy, rx, ry) {
  const p = new Path2D();
  p.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  return p;
}

function averageNormal(prev, next) {
  const vx = prev.x + next.x;
  const vy = prev.y + next.y;
  const len = Math.hypot(vx, vy) || 1;
  return { x: -vy / len, y: vx / len };
}

function ribbonPath(points, widths) {
  const n = points.length;
  if (n < 2) return new Path2D();
  const norms = [];
  for (let i = 0; i < n; i += 1) {
    if (i === 0) {
      const dx = points[1].x - points[0].x;
      const dy = points[1].y - points[0].y;
      const len = Math.hypot(dx, dy) || 1;
      norms.push({ x: -dy / len, y: dx / len });
    } else if (i === n - 1) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      const len = Math.hypot(dx, dy) || 1;
      norms.push({ x: -dy / len, y: dx / len });
    } else {
      const p0 = points[i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const d0 = { x: (p1.x - p0.x) / (Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1), y: (p1.y - p0.y) / (Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1) };
      const d1 = { x: (p2.x - p1.x) / (Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1), y: (p2.y - p1.y) / (Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1) };
      norms.push(averageNormal(d0, d1));
    }
  }

  const left = [];
  const right = [];
  for (let i = 0; i < n; i += 1) {
    const w = widths[i] || widths[widths.length - 1] || 4;
    left.push({
      x: points[i].x + norms[i].x * (w * 0.5),
      y: points[i].y + norms[i].y * (w * 0.5),
    });
    right.push({
      x: points[i].x - norms[i].x * (w * 0.5),
      y: points[i].y - norms[i].y * (w * 0.5),
    });
  }

  const p = new Path2D();
  p.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < left.length; i += 1) p.lineTo(left[i].x, left[i].y);
  for (let i = right.length - 1; i >= 0; i -= 1) p.lineTo(right[i].x, right[i].y);
  p.closePath();
  return p;
}

function fillAndStroke(ctx, path, fill, outline, lw, shadowFill = null) {
  if (shadowFill) {
    ctx.save();
    ctx.translate(0.9, 0.9);
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = shadowFill;
    ctx.fill(path);
    ctx.restore();
  }
  ctx.fillStyle = fill;
  ctx.fill(path);
  ctx.strokeStyle = outline;
  ctx.lineWidth = lw;
  ctx.stroke(path);
}

function fillOnly(ctx, path, fill, shadowFill = null) {
  if (shadowFill) {
    ctx.save();
    ctx.translate(0.8, 0.8);
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = shadowFill;
    ctx.fill(path);
    ctx.restore();
  }
  ctx.fillStyle = fill;
  ctx.fill(path);
}

function lighten(hex, amount = 0.2) {
  const t = Math.max(0, Math.min(1, amount));
  const c = hexToRgb(hex);
  return rgbToHex({
    r: c.r + (255 - c.r) * t,
    g: c.g + (255 - c.g) * t,
    b: c.b + (255 - c.b) * t,
  });
}

function rgba(hex, alpha = 1) {
  const c = hexToRgb(hex);
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function primaryOutline() {
  return '#000000';
}

const LAYER_Z = {
  farArm: 10,
  farLeg: 20,
  torso: 30,
  tie: 34,
  badge: 36,
  head: 40,
  headAccessory: 42,
  hair: 44,
  eyewear: 46,
  nearLeg: 60,
  nearArm: 70,
  heldItem: 80,
};

// SVG part library with explicit local anchors.
const SVG_PARTS = {
  head: {
    d: 'M55 5 H85 A50 50 0 0 1 135 55 V105 A50 50 0 0 1 85 155 H55 A50 50 0 0 1 5 105 V55 A50 50 0 0 1 55 5 Z',
    anchors: {
      center: [70, 80],
      neck: [70, 150],
      eyeL: [48, 73],
      eyeR: [92, 73],
      mouth: [70, 108],
      earL: [8, 84],
      earR: [132, 84],
    },
  },
  torso: {
    d: 'M15 140 L105 140 L115 110 L105 40 Q105 20 85 10 L35 10 Q15 20 15 40 L5 110 Z',
    anchors: {
      neck: [60, 10],
      shoulderL: [18, 40],
      shoulderR: [102, 40],
      hipL: [28, 136],
      hipR: [92, 136],
      waist: [60, 138],
      chest: [60, 64],
    },
  },
  arm: {
    d: 'M10 10 C0 10 0 30 5 50 L15 100 Q20 115 35 110 Q45 105 40 90 L30 30 C25 10 20 10 10 10 Z',
    anchors: {
      shoulder: [15, 10],
      elbow: [20, 62],
      wrist: [25, 108],
    },
  },
  leg: {
    d: 'M10 10 C10 0 40 0 40 10 L40 70 Q40 85 25 85 L10 85 Q0 85 0 70 Z',
    anchors: {
      hip: [25, 10],
      knee: [25, 54],
      ankle: [25, 79],
      foot: [25, 85],
    },
  },
};

const PART_BOUNDS = {
  head: { x: 5, y: 5, w: 130, h: 150 },
  torso: { x: 5, y: 10, w: 110, h: 130 },
  arm: { x: 0, y: 10, w: 45, h: 105 },
  leg: { x: 0, y: 0, w: 40, h: 85 },
};

const PART_PATHS = new Map();
const SANITY_LOGGED = new Set();

function getPartPath(partName) {
  if (PART_PATHS.has(partName)) return PART_PATHS.get(partName);
  const def = SVG_PARTS[partName];
  const path = new Path2D(def?.d || '');
  PART_PATHS.set(partName, path);
  return path;
}

function partAnchor(partName, anchorName) {
  const def = SVG_PARTS[partName];
  if (!def) return [0, 0];
  return def.anchors[anchorName] || [0, 0];
}

function mapPartAnchor(partName, fromAnchor, toAnchor, tx) {
  const [fromX, fromY] = partAnchor(partName, fromAnchor);
  const [toX, toY] = partAnchor(partName, toAnchor);
  const dx = (toX - fromX) * tx.scaleX;
  const dy = (toY - fromY) * tx.scaleY;
  const cr = Math.cos(tx.rotate);
  const sr = Math.sin(tx.rotate);
  return {
    x: tx.x + dx * cr - dy * sr,
    y: tx.y + dx * sr + dy * cr,
  };
}

function drawPartFromAnchor(ctx, partName, tx, paint) {
  const [ax, ay] = partAnchor(partName, tx.anchor);
  ctx.save();
  ctx.translate(tx.x, tx.y);
  ctx.rotate(tx.rotate || 0);
  ctx.scale(tx.scaleX, tx.scaleY);
  ctx.translate(-ax, -ay);
  if (paint.shadowFill) {
    ctx.save();
    ctx.translate(0.9 / Math.max(0.001, Math.abs(tx.scaleX)), 0.9 / Math.max(0.001, Math.abs(tx.scaleY)));
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = paint.shadowFill;
    ctx.fill(getPartPath(partName));
    ctx.restore();
  }
  ctx.fillStyle = paint.fill;
  ctx.fill(getPartPath(partName));
  ctx.strokeStyle = paint.stroke;
  ctx.lineWidth = paint.lineWidth;
  ctx.stroke(getPartPath(partName));
  ctx.restore();
}

function buildHeadTx(rig) {
  const headW = rig.headRX * 2.02;
  const headH = rig.headRY * 1.94;
  const scaleY = headH / PART_BOUNDS.head.h;
  const neckToCenter = SVG_PARTS.head.anchors.neck[1] - SVG_PARTS.head.anchors.center[1];
  const centerY = rig.neckTopY - neckToCenter * scaleY;
  return {
    x: 0,
    y: centerY,
    anchor: 'center',
    scaleX: headW / PART_BOUNDS.head.w,
    scaleY,
    rotate: 0,
  };
}

function buildTorsoTx(rig) {
  const torsoW = rig.torsoW * 0.95;
  const torsoH = rig.torsoH * 1.04;
  return {
    x: 0,
    y: rig.neckBottomY,
    anchor: 'neck',
    scaleX: torsoW / PART_BOUNDS.torso.w,
    scaleY: torsoH / PART_BOUNDS.torso.h,
    rotate: 0,
  };
}

function runRigSanity(spec, rig, pose) {
  const headTx = buildHeadTx(rig);
  const torsoTx = buildTorsoTx(rig);
  const headNeck = mapPartAnchor('head', 'center', 'neck', headTx);
  const torsoNeck = mapPartAnchor('torso', 'neck', 'neck', torsoTx);
  const torsoShoulderL = mapPartAnchor('torso', 'neck', 'shoulderL', torsoTx);
  const torsoShoulderR = mapPartAnchor('torso', 'neck', 'shoulderR', torsoTx);
  const torsoHipL = mapPartAnchor('torso', 'neck', 'hipL', torsoTx);
  const torsoHipR = mapPartAnchor('torso', 'neck', 'hipR', torsoTx);

  const issues = [];
  const neckGap = Math.abs(headNeck.y - torsoNeck.y);
  const expectedNeckGap = Math.abs(rig.neckBottomY - rig.neckTopY);
  if (Math.abs(neckGap - expectedNeckGap) > 2.2) {
    issues.push(`neck gap ${neckGap.toFixed(2)} deviates from expected ${expectedNeckGap.toFixed(2)}`);
  }

  const headW = PART_BOUNDS.head.w * headTx.scaleX;
  const torsoW = PART_BOUNDS.torso.w * torsoTx.scaleX;
  const ratio = headW / Math.max(0.001, torsoW);
  if (ratio < 0.8 || ratio > 1.45) issues.push(`head/torso ratio ${ratio.toFixed(2)} out of range`);

  const shoulderSpan = Math.abs(torsoShoulderR.x - torsoShoulderL.x);
  const armShoulderSpan = Math.abs(pose.armNear.shoulderX - pose.armFar.shoulderX);
  if (Math.abs(shoulderSpan - armShoulderSpan) > 8.5) {
    issues.push(`shoulder anchor drift ${(shoulderSpan - armShoulderSpan).toFixed(2)}`);
  }

  const hipsMid = (torsoHipL.x + torsoHipR.x) * 0.5;
  const legsMid = (pose.legNear.hipX + pose.legFar.hipX) * 0.5;
  if (Math.abs(hipsMid - legsMid) > 3.2) issues.push(`hip center drift ${(hipsMid - legsMid).toFixed(2)}`);

  const torsoBottom = Math.max(torsoHipL.y, torsoHipR.y);
  const legTop = Math.min(pose.legNear.hipY, pose.legFar.hipY);
  if (torsoBottom > legTop + 6.5) issues.push('torso overlaps legs too deeply');

  if (issues.length) {
    const key = `${spec.seed}:${issues.join('|')}`;
    if (SANITY_LOGGED.has(key)) return;
    SANITY_LOGGED.add(key);
    console.warn(`[office-dude sanity ${spec.seed}] ${issues.join(' | ')}`);
  }
}

function paintLightPass(ctx, path, bounds, opts = {}) {
  const highlight = opts.highlight ?? 0.22;
  const shade = opts.shade ?? 0.26;
  const specular = opts.specular ?? 0.16;
  const bx = bounds.x;
  const by = bounds.y;
  const bw = Math.max(1, bounds.w);
  const bh = Math.max(1, bounds.h);

  ctx.save();
  ctx.clip(path);

  const grad = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
  grad.addColorStop(0, `rgba(255,255,255,${highlight})`);
  grad.addColorStop(0.45, 'rgba(255,255,255,0)');
  grad.addColorStop(1, `rgba(2,6,23,${shade})`);
  ctx.fillStyle = grad;
  ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);

  const glint = ctx.createRadialGradient(
    bx + bw * 0.28,
    by + bh * 0.24,
    Math.max(1, Math.min(bw, bh) * 0.06),
    bx + bw * 0.24,
    by + bh * 0.2,
    Math.max(3, Math.max(bw, bh) * 0.7),
  );
  glint.addColorStop(0, `rgba(255,255,255,${specular})`);
  glint.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glint;
  ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);

  ctx.restore();
}

function computeMotion(anim, frame, frameCount) {
  const count = Math.max(1, frameCount);
  const phase = (frame % count) / count;
  const wave = Math.sin(phase * Math.PI * 2);
  const isWalk = anim === 'walk' || anim === 'carry_walk';
  return {
    bob: isWalk ? wave * 1.4 : Math.sin(phase * Math.PI * 2) * 0.6,
    torsoScaleY: isWalk ? 1 - Math.abs(wave) * 0.03 : 1,
    armSwing: isWalk ? wave * 4.8 : 0.5,
    legSwing: isWalk ? wave * 3.4 : 0,
    carry: anim === 'carry_idle' || anim === 'carry_walk',
  };
}

function computeRig(spec, m, dir) {
  const scale = spec.scale || 1;
  const body = spec.body || {};
  const torsoW = spec.torsoWidth * scale;
  const torsoH = spec.torsoHeight * scale * m.torsoScaleY;
  const headR = (15 * (spec.headScale || 1)) * scale;
  const headRX = headR * (body.headW || 1);
  const headRY = headR * (body.headH || 1);
  const legLen = spec.legLength * scale;
  const armLen = spec.armLength * scale;
  const limbT = (2.8 * (spec.limbThickness || 1));
  const hipY = -legLen;
  const torsoTop = hipY - torsoH;
  const torsoBottom = torsoTop + torsoH;
  const shoulderY = torsoTop + 4 * scale + (body.neckHeight || 1) * 0.35;
  const shoulderDX = torsoW * 0.45 * (body.shoulderWidth || 1);
  const hipDX = torsoW * 0.24;
  const headCenterY = torsoTop - headRY + m.bob - (body.neckHeight || 1) * 0.45;
  const neckTopY = headCenterY + headRY * 0.74;
  const neckBottomY = torsoTop + 2.4;
  const neckW = torsoW * 0.25;
  const handsY = shoulderY + armLen;
  const side = nearFarForDir(dir);
  const eyeGap = (3.6 * (body.eyeGap || 1));
  const eyeY = headCenterY - headRY * 0.06;
  const eyeR = clamp(0.7 * (body.eyeSize || 1), 0.55, 1.4);
  const mouthY = headCenterY + headRY * 0.28;

  return {
    torsoW,
    torsoH,
    headR,
    headRX,
    headRY,
    legLen,
    armLen,
    limbT,
    hipY,
    torsoTop,
    torsoBottom,
    shoulderY,
    shoulderDX,
    hipDX,
    neckTopY,
    neckBottomY,
    neckW,
    headCenterY,
    handsY,
    side,
    eyeGap,
    eyeY,
    eyeR,
    mouthY,
  };
}

function computeLegPose(rig, which, depth, m) {
  const isLeft = which === 'L';
  const sway = isLeft ? -m.legSwing : m.legSwing;
  const hipX = (isLeft ? -rig.hipDX : rig.hipDX) + (depth === 'far' ? -0.6 : 0.6);
  const kneeX = hipX + sway * 0.42;
  const kneeY = rig.hipY + rig.legLen * 0.52;
  const footX = hipX + sway;
  const footY = 0;
  return {
    which,
    depth,
    hipX,
    hipY: rig.hipY,
    kneeX,
    kneeY,
    footX,
    footY,
  };
}

function computeArmPose(rig, which, depth, m) {
  const isLeft = which === 'L';
  const sway = isLeft ? -m.armSwing : m.armSwing;
  const shoulderX = isLeft ? -rig.shoulderDX : rig.shoulderDX;
  const shoulderY = rig.shoulderY;
  const holdBias = m.carry && depth === 'near' ? -6 : 0;
  const elbowX = shoulderX + sway * 0.34 + holdBias * 0.2;
  const elbowY = shoulderY + rig.armLen * 0.38;
  const wristX = shoulderX + sway * 0.62 + holdBias;
  const wristY = shoulderY + rig.armLen * 0.7 + Math.abs(sway) * 0.2 + (m.carry && depth === 'near' ? -5.5 : 0);
  return {
    which,
    depth,
    shoulderX,
    shoulderY,
    elbowX,
    elbowY,
    wristX,
    wristY,
  };
}

function drawLeg(ctx, spec, rig, pose) {
  const { which, depth, hipX: x, hipY, kneeX, kneeY, footX, footY } = pose;
  const isLeft = which === 'L';
  const legX = x * 0.58 + footX * 0.42;
  const legY = hipY + 0.25;
  const bareLeg = spec.outfit.shoeStyle === 'no_shoes';
  const legFill = bareLeg ? darken(spec.palette.skin, 0.03) : spec.palette.pants;
  const legWidth = spec.outfit.pantsStyle === 'slacks' ? 5.05 : 4.7;
  const legLen = Math.max(4.4, rig.legLen * 0.66);
  const tx = {
    x: legX,
    y: legY,
    anchor: 'hip',
    scaleX: legWidth / PART_BOUNDS.leg.w,
    scaleY: legLen / (SVG_PARTS.leg.anchors.foot[1] - SVG_PARTS.leg.anchors.hip[1]),
    rotate: 0,
  };
  drawPartFromAnchor(ctx, 'leg', tx, {
    fill: legFill,
    stroke: primaryOutline(),
    lineWidth: 1,
    shadowFill: darken(legFill, 0.1),
  });

  const ankle = mapPartAnchor('leg', 'hip', 'ankle', tx);
  const foot = mapPartAnchor('leg', 'hip', 'foot', tx);
  const seamTop = mapPartAnchor('leg', 'hip', 'knee', tx);

  if (!bareLeg) {
    ctx.strokeStyle = darken(spec.palette.pants, 0.22);
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(seamTop.x - 0.15, seamTop.y - 1.1);
    ctx.lineTo(ankle.x - 0.18, ankle.y - 0.35);
    ctx.stroke();
  }

  if (spec.outfit.shoeStyle !== 'no_shoes') {
    const shoeW = spec.outfit.shoeStyle === 'loafer' ? 8.2 : 9.1;
    const shoeH = spec.outfit.shoeStyle === 'heel' ? 4.2 : 5.2;
    const shoe = ellipsePath(foot.x, foot.y - shoeH * 0.42, shoeW * 0.52, shoeH * 0.58);
    fillAndStroke(ctx, shoe, spec.palette.shoes, primaryOutline(), 1.05, darken(spec.palette.shoes, 0.2));
    paintLightPass(ctx, shoe, {
      x: foot.x - shoeW * 0.52,
      y: foot.y - shoeH,
      w: shoeW * 1.04,
      h: shoeH * 0.95,
    }, { highlight: 0.2, shade: 0.28, specular: 0.2 });

    ctx.strokeStyle = darken(spec.palette.shoes, 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(foot.x - 3.5, foot.y - 1.2);
    ctx.lineTo(foot.x + 4, foot.y - 1.2);
    ctx.stroke();

    if (spec.outfit.shoeStyle === 'sneaker') {
      ctx.strokeStyle = lighten(spec.palette.shoes, 0.42);
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(foot.x - 2.8, foot.y - 2.8);
      ctx.lineTo(foot.x + 2.9, foot.y - 2.8);
      ctx.stroke();
    } else if (spec.outfit.shoeStyle === 'heel') {
      const heel = roundedRectPath(foot.x + 2.3, foot.y - 2.2, 1.5, 2.2, 0.5);
      fillAndStroke(ctx, heel, darken(spec.palette.shoes, 0.1), primaryOutline(), 0.8);
    } else if (spec.outfit.shoeStyle === 'oxford') {
      ctx.fillStyle = darken(spec.palette.shoes, 0.4);
      ctx.beginPath();
      ctx.arc(foot.x + 2.4, foot.y - 3.2, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (!bareLeg && spec.outfit.pantsStyle === 'jeans') {
    ctx.strokeStyle = lighten(spec.palette.pants, 0.2);
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(seamTop.x - 0.8, seamTop.y - 0.8);
    ctx.lineTo(ankle.x - 0.6, ankle.y - 0.55);
    ctx.stroke();
  }
  if (!bareLeg && spec.outfit.pantsStyle === 'chinos') {
    const cuff = roundedRectPath(foot.x - 2.4, foot.y - 5.2, 4.8, 1.8, 0.7);
    fillAndStroke(ctx, cuff, darken(spec.palette.pants, 0.12), spec.palette.outline, 0.75);
  }

  if (spec.outfit.skirt && depth === 'far' && !isLeft) {
    const skirt = new Path2D();
    skirt.moveTo(-rig.torsoW * 0.46, hipY - 1.9);
    skirt.lineTo(rig.torsoW * 0.46, hipY - 1.9);
    skirt.quadraticCurveTo(rig.torsoW * 0.42, hipY + 4.8, 0, hipY + 6.3);
    skirt.quadraticCurveTo(-rig.torsoW * 0.42, hipY + 4.8, -rig.torsoW * 0.46, hipY - 1.9);
    skirt.closePath();
    fillAndStroke(ctx, skirt, darken(spec.palette.shirt, 0.06), spec.palette.outline, 1.2, darken(spec.palette.shirt, 0.2));
  }

  return { kneeY, footX, footY };
}

function drawArm(ctx, spec, rig, pose) {
  const { elbowX, elbowY, shoulderX, shoulderY, wristX, wristY, which } = pose;
  const dir = which === 'L' ? -1 : 1;
  const dx = wristX - shoulderX;
  const dy = wristY - shoulderY;
  const len = Math.max(4, Math.hypot(dx, dy));
  // Arm path is authored with shoulder->wrist along +Y; rotate to target vector.
  const angle = Math.atan2(dy, dx) - Math.PI * 0.5;
  const armW = clamp(rig.limbT * 2.5, 8.2, 11.4);
  const baseLen = SVG_PARTS.arm.anchors.wrist[1] - SVG_PARTS.arm.anchors.shoulder[1];
  const tx = {
    x: shoulderX,
    y: shoulderY,
    anchor: 'shoulder',
    scaleX: (dir < 0 ? -1 : 1) * (armW / PART_BOUNDS.arm.w),
    scaleY: len / baseLen,
    rotate: angle,
  };
  drawPartFromAnchor(ctx, 'arm', tx, {
    fill: darken(spec.palette.shirt, 0.01),
    stroke: primaryOutline(),
    lineWidth: 0.95,
    shadowFill: darken(spec.palette.shirt, 0.12),
  });

  if (spec.outfit.sleevesRolled) {
    const roll = roundedRectPath(wristX - 2.15, wristY - 3.4, 4.3, 1.65, 0.65);
    fillAndStroke(ctx, roll, darken(spec.palette.shirt, 0.12), primaryOutline(), 0.65);
  }

  const handR = 1.8;
  const hand = ellipsePath(wristX, wristY + 0.35, handR * 1.12, handR);
  fillAndStroke(ctx, hand, spec.palette.skin, primaryOutline(), 0.8);

  return { x: wristX, y: wristY };
}

function buildLayerPlan(ctx, spec, rig, side, m, pose) {
  const layers = [
    { name: 'farArm', z: LAYER_Z.farArm, draw: () => drawArm(ctx, spec, rig, pose.armFar) },
    { name: 'farLeg', z: LAYER_Z.farLeg, draw: () => drawLeg(ctx, spec, rig, pose.legFar) },
    { name: 'torso', z: LAYER_Z.torso, draw: () => drawTorso(ctx, spec, rig) },
  ];

  if (spec.outfit.tie) layers.push({ name: 'tie', z: LAYER_Z.tie, draw: () => drawTie(ctx, spec, rig) });
  if (spec.outfit.badge) layers.push({ name: 'badge', z: LAYER_Z.badge, draw: () => drawBadge(ctx, spec, rig) });

  layers.push(
    { name: 'head', z: LAYER_Z.head, draw: () => drawHead(ctx, spec, rig) },
    { name: 'headAccessory', z: LAYER_Z.headAccessory, draw: () => drawHeadAccessory(ctx, spec, rig, side) },
    { name: 'hair', z: LAYER_Z.hair, draw: () => drawHair(ctx, spec, rig, side) },
  );

  const eyewear = spec.outfit.eyewear || (spec.outfit.glasses ? 'round' : 'none');
  if (eyewear !== 'none') layers.push({ name: 'eyewear', z: LAYER_Z.eyewear, draw: () => drawEyewear(ctx, spec, rig) });

  layers.push(
    { name: 'nearLeg', z: LAYER_Z.nearLeg, draw: () => drawLeg(ctx, spec, rig, pose.legNear) },
    { name: 'nearArm', z: LAYER_Z.nearArm, draw: () => drawArm(ctx, spec, rig, pose.armNear) },
  );

  if (m.carry) layers.push({ name: 'heldItem', z: LAYER_Z.heldItem, draw: () => drawHeldItem(ctx, spec, rig, pose.handNear) });

  return layers
    .map((layer, idx) => ({ ...layer, idx }))
    .sort((a, b) => (a.z - b.z) || (a.idx - b.idx));
}

function drawTorso(ctx, spec, rig) {
  const shirtBase = lighten(spec.palette.shirt, 0.03);
  const neckH = Math.max(1.6, rig.neckBottomY - rig.neckTopY);
  const neck = new Path2D();
  neck.moveTo(-rig.neckW * 0.46, rig.neckTopY);
  neck.lineTo(rig.neckW * 0.46, rig.neckTopY);
  neck.lineTo(rig.neckW * 0.4, rig.neckTopY + neckH);
  neck.lineTo(-rig.neckW * 0.4, rig.neckTopY + neckH);
  neck.closePath();
  fillAndStroke(ctx, neck, darken(spec.palette.skin, 0.03), primaryOutline(), 1, darken(spec.palette.skin, 0.14));

  const tx = buildTorsoTx(rig);
  drawPartFromAnchor(ctx, 'torso', tx, {
    fill: shirtBase,
    stroke: primaryOutline(),
    lineWidth: 1.45,
    shadowFill: darken(spec.palette.shirt, 0.14),
  });

  const shoulderL = mapPartAnchor('torso', 'neck', 'shoulderL', tx);
  const shoulderR = mapPartAnchor('torso', 'neck', 'shoulderR', tx);
  const waist = mapPartAnchor('torso', 'neck', 'waist', tx);
  const chest = mapPartAnchor('torso', 'neck', 'chest', tx);
  const clipW = (shoulderR.x - shoulderL.x) + 14;
  const clipH = (waist.y - rig.neckBottomY) + 14;
  const body = roundedRectPath(shoulderL.x - 7, rig.neckBottomY - 2, clipW, clipH, 5);
  paintLightPass(ctx, body, {
    x: shoulderL.x - 7,
    y: rig.neckBottomY - 2,
    w: clipW,
    h: clipH,
  }, { highlight: 0.14, shade: 0.12, specular: 0.08 });

  // Neck opening.
  const neckOuter = ellipsePath(0, rig.neckBottomY + 0.95, (shoulderR.x - shoulderL.x) * 0.24, 2.6);
  const neckInner = ellipsePath(0, rig.neckBottomY + 0.95, (shoulderR.x - shoulderL.x) * 0.16, 1.55);
  fillAndStroke(ctx, neckOuter, darken(shirtBase, 0.04), primaryOutline(), 1.05);
  fillAndStroke(ctx, neckInner, darken(spec.palette.skin, 0.02), primaryOutline(), 0.75);

  // Waist band for part separation.
  const waistband = roundedRectPath(shoulderL.x + 4.5, waist.y - 1.3, (shoulderR.x - shoulderL.x) - 9, 2.9, 1.8);
  fillAndStroke(ctx, waistband, darken(spec.palette.pants, 0.03), primaryOutline(), 0.95, darken(spec.palette.pants, 0.12));

  if (spec.outfit.shirtPattern === 'pinstripe') {
    ctx.save();
    ctx.clip(body);
    ctx.strokeStyle = rgba(lighten(spec.palette.shirt, 0.35), 0.35);
    ctx.lineWidth = 0.7;
    for (let x = -rig.torsoW * 0.45; x <= rig.torsoW * 0.45; x += 3.2) {
      ctx.beginPath();
      ctx.moveTo(x, rig.torsoTop + 1);
      ctx.lineTo(x + 0.9, rig.torsoTop + rig.torsoH - 1);
      ctx.stroke();
    }
    ctx.restore();
  } else if (spec.outfit.shirtPattern === 'color_block') {
    const block = roundedRectPath(-rig.torsoW * 0.06, rig.torsoTop + 2, rig.torsoW * 0.52, rig.torsoH - 4, 2.8);
    fillAndStroke(ctx, block, darken(spec.palette.shirt, 0.2), darken(spec.palette.shirt, 0.35), 0.9);
  }

  if (spec.outfit.shirtStyle === 'button_down') {
    ctx.strokeStyle = darken(spec.palette.shirt, 0.3);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(0, rig.torsoTop + 3);
    ctx.lineTo(0, rig.torsoTop + rig.torsoH - 2);
    ctx.stroke();
  }

  if (spec.outfit.shirtStyle === 'sweater') {
    const band = roundedRectPath(-rig.torsoW * 0.52, rig.torsoTop + rig.torsoH - 6, rig.torsoW * 1.04, 5, 2.5);
    fillAndStroke(ctx, band, darken(spec.palette.shirt, 0.15), spec.palette.outline, 1.05);
  }

  if (spec.outfit.shirtStyle === 'hoodie') {
    const hood = roundedRectPath(-rig.torsoW * 0.28, rig.torsoTop - 2.4, rig.torsoW * 0.56, 6.4, 2.4);
    fillAndStroke(ctx, hood, darken(spec.palette.shirt, 0.2), spec.palette.outline, 1.05);
    ctx.strokeStyle = darken(spec.palette.shirt, 0.4);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-2.4, rig.torsoTop + 4.2);
    ctx.lineTo(-2.8, rig.torsoTop + 8.8);
    ctx.moveTo(2.4, rig.torsoTop + 4.2);
    ctx.lineTo(2.8, rig.torsoTop + 8.8);
    ctx.stroke();
  }
  if (spec.outfit.shirtStyle === 'vest') {
    const vest = roundedRectPath(-rig.torsoW * 0.44, rig.torsoTop + 1.6, rig.torsoW * 0.88, rig.torsoH - 1.8, 4.3);
    fillAndStroke(ctx, vest, darken(spec.palette.shirt, 0.28), spec.palette.outline, 1.05);
    ctx.strokeStyle = darken(spec.palette.shirt, 0.42);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(0, rig.torsoTop + 4);
    ctx.lineTo(0, rig.torsoTop + rig.torsoH - 2);
    ctx.stroke();
  }

  if (spec.outfit.jacket) {
    const jacketColor = darken(spec.palette.shirt, 0.28);
    if (spec.outfit.jacketStyle === 'cardigan') {
      const cardi = roundedRectPath(-rig.torsoW * 0.51, rig.torsoTop + 0.8, rig.torsoW * 1.02, rig.torsoH + 0.5, 5);
      fillAndStroke(ctx, cardi, jacketColor, spec.palette.outline, 1.05, darken(jacketColor, 0.22));
      const trim = roundedRectPath(-rig.torsoW * 0.08, rig.torsoTop + 1.8, rig.torsoW * 0.16, rig.torsoH - 2.2, 1.2);
      fillAndStroke(ctx, trim, darken(jacketColor, 0.22), darken(jacketColor, 0.4), 0.8);
    } else {
      const lapelL = new Path2D();
      lapelL.moveTo(-2, rig.torsoTop + 3);
      lapelL.lineTo(-rig.torsoW * 0.45, rig.torsoTop + 7);
      lapelL.lineTo(-8, rig.torsoTop + 14);
      lapelL.closePath();
      fillAndStroke(ctx, lapelL, darken(jacketColor, 0.05), spec.palette.outline, 1.05);

      const lapelR = new Path2D();
      lapelR.moveTo(2, rig.torsoTop + 3);
      lapelR.lineTo(rig.torsoW * 0.45, rig.torsoTop + 7);
      lapelR.lineTo(8, rig.torsoTop + 14);
      lapelR.closePath();
      fillAndStroke(ctx, lapelR, darken(jacketColor, 0.12), spec.palette.outline, 1.05);
    }
  }

  if (spec.outfit.suspenders && !spec.outfit.jacket) {
    const strapColor = darken(spec.palette.accent, 0.2);
    const left = capsulePath(-rig.torsoW * 0.23, rig.torsoTop + 1.8, -rig.torsoW * 0.15, rig.torsoTop + rig.torsoH - 1.6, 0.85);
    const right = capsulePath(rig.torsoW * 0.23, rig.torsoTop + 1.8, rig.torsoW * 0.15, rig.torsoTop + rig.torsoH - 1.6, 0.85);
    fillAndStroke(ctx, left, strapColor, darken(strapColor, 0.25), 0.65);
    fillAndStroke(ctx, right, strapColor, darken(strapColor, 0.25), 0.65);
  }

  if (spec.outfit.pocketSquare && spec.outfit.jacket) {
    const ps = roundedRectPath(rig.torsoW * 0.18, rig.torsoTop + 6.5, 3.4, 2.5, 0.7);
    fillAndStroke(ctx, ps, lighten(spec.palette.accent, 0.15), spec.palette.outline, 0.7);
  }
}

function drawTie(ctx, spec, rig) {
  const knot = roundedRectPath(-2.6, rig.torsoTop + 2.5, 5.2, 4, 1.2);
  fillAndStroke(ctx, knot, spec.palette.accent, spec.palette.outline, 1);
  paintLightPass(ctx, knot, { x: -2.6, y: rig.torsoTop + 2.5, w: 5.2, h: 4 }, { highlight: 0.2, shade: 0.18, specular: 0.14 });

  const body = new Path2D();
  body.moveTo(0, rig.torsoTop + 6.2);
  body.lineTo(4, rig.torsoTop + 11.8);
  body.lineTo(1.5, rig.torsoTop + 18.5);
  body.lineTo(-1.5, rig.torsoTop + 18.5);
  body.lineTo(-4, rig.torsoTop + 11.8);
  body.closePath();
  fillAndStroke(ctx, body, darken(spec.palette.accent, 0.12), spec.palette.outline, 1);
  paintLightPass(ctx, body, { x: -4, y: rig.torsoTop + 6.2, w: 8, h: 12.3 }, { highlight: 0.16, shade: 0.2, specular: 0.12 });
}

function drawBadge(ctx, spec, rig) {
  ctx.strokeStyle = darken(spec.palette.shirt, 0.38);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rig.torsoW * 0.16, rig.torsoTop + 3);
  ctx.lineTo(rig.torsoW * 0.28, rig.torsoTop + 8.5);
  ctx.stroke();

  const badge = roundedRectPath(rig.torsoW * 0.18, rig.torsoTop + 8.5, 6.2, 7.4, 1.4);
  fillAndStroke(ctx, badge, '#dbeafe', spec.palette.outline, 1);
}

function drawHead(ctx, spec, rig) {
  const tx = buildHeadTx(rig);

  // Build transformed head path for clip/light passes.
  const [ax, ay] = partAnchor('head', 'center');
  const headPath = getPartPath('head');
  const toWorld = (px, py) => ({
    x: tx.x + (px - ax) * tx.scaleX,
    y: tx.y + (py - ay) * tx.scaleY,
  });
  const headTL = toWorld(PART_BOUNDS.head.x, PART_BOUNDS.head.y);
  const headBR = toWorld(PART_BOUNDS.head.x + PART_BOUNDS.head.w, PART_BOUNDS.head.y + PART_BOUNDS.head.h);
  const head = new Path2D();
  head.addPath(headPath, new DOMMatrix([
    tx.scaleX, 0,
    0, tx.scaleY,
    tx.x - ax * tx.scaleX, tx.y - ay * tx.scaleY,
  ]));
  const earW = 2.8 * (spec.body?.earSize || 1);
  const earH = 3.9 * (spec.body?.earSize || 1);
  const earLAnchor = mapPartAnchor('head', 'center', 'earL', tx);
  const earRAnchor = mapPartAnchor('head', 'center', 'earR', tx);
  const earL = ellipsePath(earLAnchor.x, earLAnchor.y, earW * 0.72, earH * 0.62);
  const earR = ellipsePath(earRAnchor.x, earRAnchor.y, earW * 0.72, earH * 0.62);
  fillAndStroke(ctx, earL, darken(spec.palette.skin, 0.02), primaryOutline(), 1);
  fillAndStroke(ctx, earR, darken(spec.palette.skin, 0.02), primaryOutline(), 1);
  fillAndStroke(ctx, head, spec.palette.skin, primaryOutline(), 1.55, darken(spec.palette.skin, 0.14));
  paintLightPass(ctx, head, {
    x: headTL.x,
    y: headTL.y,
    w: headBR.x - headTL.x,
    h: headBR.y - headTL.y,
  }, { highlight: 0.12, shade: 0.1, specular: 0.08 });

  ctx.save();
  ctx.clip(head);
  const warm = ctx.createRadialGradient(
    -rig.headRX * 0.36,
    rig.headCenterY - rig.headRY * 0.38,
    0.8,
    0,
    rig.headCenterY,
    Math.max(rig.headRX, rig.headRY) * 1.15,
  );
  warm.addColorStop(0, rgba(lighten(spec.palette.skin, 0.28), 0.32));
  warm.addColorStop(1, rgba(darken(spec.palette.skin, 0.18), 0));
  ctx.fillStyle = warm;
  ctx.fillRect(-rig.headRX - 1, rig.headCenterY - rig.headRY - 1, rig.headRX * 2 + 2, rig.headRY * 2 + 2);

  const eyeLA = mapPartAnchor('head', 'center', 'eyeL', tx);
  const eyeRA = mapPartAnchor('head', 'center', 'eyeR', tx);
  const eyeY = (eyeLA.y + eyeRA.y) * 0.5;
  const face = spec.face || {};
  const eyeDX = (eyeRA.x - eyeLA.x) * 0.5;
  const mouthY = mapPartAnchor('head', 'center', 'mouth', tx).y;
  ctx.fillStyle = spec.palette.outline;
  if (face.eyes === 'wide') {
    ctx.beginPath();
    ctx.ellipse(-eyeDX, eyeY, rig.eyeR * 1.15, rig.eyeR * 0.82, 0, 0, Math.PI * 2);
    ctx.ellipse(eyeDX, eyeY, rig.eyeR * 1.15, rig.eyeR * 0.82, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
    ctx.strokeStyle = primaryOutline();
    ctx.lineWidth = 0.65;
    ctx.stroke();
    ctx.fillStyle = primaryOutline();
    ctx.beginPath();
    ctx.arc(-eyeDX + 0.18, eyeY + 0.02, rig.eyeR * 0.52, 0, Math.PI * 2);
    ctx.arc(eyeDX + 0.18, eyeY + 0.02, rig.eyeR * 0.52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffffc0';
    ctx.beginPath();
    ctx.arc(-eyeDX - 0.35, eyeY - 0.35, 0.34, 0, Math.PI * 2);
    ctx.arc(eyeDX - 0.35, eyeY - 0.35, 0.34, 0, Math.PI * 2);
    ctx.fill();
  } else if (face.eyes === 'sleepy') {
    ctx.strokeStyle = darken(spec.palette.outline, 0.05);
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(-eyeDX - 1.1, eyeY + 0.4);
    ctx.lineTo(-eyeDX + 1.1, eyeY + 0.6);
    ctx.moveTo(eyeDX - 1.1, eyeY + 0.6);
    ctx.lineTo(eyeDX + 1.1, eyeY + 0.4);
    ctx.stroke();
  } else if (face.eyes === 'half_lid') {
    const eyeW = Math.max(2, rig.eyeR * 2.3);
    const eyeH = Math.max(0.9, rig.eyeR * 1.4);
    const lidY = eyeY - eyeH * 0.2;
    const left = roundedRectPath(-eyeDX - eyeW * 0.5, eyeY - eyeH * 0.45, eyeW, eyeH, eyeH * 0.48);
    const right = roundedRectPath(eyeDX - eyeW * 0.5, eyeY - eyeH * 0.45, eyeW, eyeH, eyeH * 0.48);
    fillAndStroke(ctx, left, '#f8fafc', darken(spec.palette.outline, 0.1), 0.55);
    fillAndStroke(ctx, right, '#f8fafc', darken(spec.palette.outline, 0.1), 0.55);
    ctx.strokeStyle = darken(spec.palette.outline, 0.02);
    ctx.lineWidth = 1.05;
    ctx.beginPath();
    ctx.moveTo(-eyeDX - eyeW * 0.55, lidY);
    ctx.quadraticCurveTo(-eyeDX, lidY + 0.22, -eyeDX + eyeW * 0.55, lidY);
    ctx.moveTo(eyeDX - eyeW * 0.55, lidY);
    ctx.quadraticCurveTo(eyeDX, lidY + 0.22, eyeDX + eyeW * 0.55, lidY);
    ctx.stroke();
    ctx.fillStyle = darken(spec.palette.outline, 0.06);
    ctx.beginPath();
    ctx.arc(-eyeDX, eyeY + 0.15, 0.5, 0, Math.PI * 2);
    ctx.arc(eyeDX, eyeY + 0.15, 0.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (face.eyes === 'squint') {
    ctx.strokeStyle = darken(spec.palette.outline, 0.03);
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(-eyeDX - 1.2, eyeY);
    ctx.quadraticCurveTo(-eyeDX, eyeY - 0.42, -eyeDX + 1.2, eyeY);
    ctx.moveTo(eyeDX - 1.2, eyeY);
    ctx.quadraticCurveTo(eyeDX, eyeY - 0.42, eyeDX + 1.2, eyeY);
    ctx.stroke();
  } else if (face.eyes === 'wink') {
    ctx.beginPath();
    ctx.arc(-eyeDX, eyeY, rig.eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = darken(spec.palette.outline, 0.03);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(eyeDX - 1.2, eyeY + 0.2);
    ctx.quadraticCurveTo(eyeDX, eyeY - 0.35, eyeDX + 1.2, eyeY + 0.2);
    ctx.stroke();
  } else if (face.eyes === 'tired') {
    const eyeW = Math.max(2.2, rig.eyeR * 2.4);
    const eyeH = Math.max(0.8, rig.eyeR * 1.15);
    const left = roundedRectPath(-eyeDX - eyeW * 0.5, eyeY - eyeH * 0.26, eyeW, eyeH, eyeH * 0.44);
    const right = roundedRectPath(eyeDX - eyeW * 0.5, eyeY - eyeH * 0.26, eyeW, eyeH, eyeH * 0.44);
    fillAndStroke(ctx, left, '#f8fafc', darken(spec.palette.outline, 0.12), 0.45);
    fillAndStroke(ctx, right, '#f8fafc', darken(spec.palette.outline, 0.12), 0.45);
    ctx.fillStyle = darken(spec.palette.outline, 0.06);
    ctx.beginPath();
    ctx.ellipse(-eyeDX, eyeY + 0.06, 0.45, 0.34, 0, 0, Math.PI * 2);
    ctx.ellipse(eyeDX, eyeY + 0.06, 0.45, 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(darken(spec.palette.outline, 0.08), 0.42);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-eyeDX - eyeW * 0.45, eyeY + eyeH * 0.65);
    ctx.quadraticCurveTo(-eyeDX, eyeY + eyeH * 0.95, -eyeDX + eyeW * 0.45, eyeY + eyeH * 0.65);
    ctx.moveTo(eyeDX - eyeW * 0.45, eyeY + eyeH * 0.65);
    ctx.quadraticCurveTo(eyeDX, eyeY + eyeH * 0.95, eyeDX + eyeW * 0.45, eyeY + eyeH * 0.65);
    ctx.stroke();
  } else if (face.eyes === 'happy') {
    ctx.strokeStyle = darken(spec.palette.outline, 0.02);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(-eyeDX, eyeY, 1.2, 0.1, Math.PI - 0.1);
    ctx.arc(eyeDX, eyeY, 1.2, 0.1, Math.PI - 0.1);
    ctx.stroke();
  } else {
    // Default eye set now uses white sclera + pupil to match cleaner cartoon references.
    const scleraW = rig.eyeR * 2.2;
    const scleraH = rig.eyeR * 1.55;
    const leftEye = ellipsePath(-eyeDX, eyeY, scleraW * 0.5, scleraH * 0.5);
    const rightEye = ellipsePath(eyeDX, eyeY, scleraW * 0.5, scleraH * 0.5);
    fillAndStroke(ctx, leftEye, '#f8fafc', primaryOutline(), 0.55);
    fillAndStroke(ctx, rightEye, '#f8fafc', primaryOutline(), 0.55);
    ctx.fillStyle = primaryOutline();
    ctx.beginPath();
    ctx.arc(-eyeDX + 0.22, eyeY + 0.05, rig.eyeR * 0.58, 0, Math.PI * 2);
    ctx.arc(eyeDX + 0.22, eyeY + 0.05, rig.eyeR * 0.58, 0, Math.PI * 2);
    ctx.fill();
  }

  if (face.brows && face.brows !== 'none') {
    const browY = eyeY - 2;
    const browW = face.brows === 'thick' ? 2.7 : 2.2;
    const arch = face.brows === 'arched' ? 0.8 : 0.3;
    ctx.strokeStyle = darken(spec.palette.hair, 0.18);
    ctx.lineWidth = face.brows === 'thick' ? 1.15 : 0.85;
    ctx.beginPath();
    ctx.moveTo(-eyeDX - browW * 0.5, browY + arch);
    ctx.lineTo(-eyeDX + browW * 0.5, browY - arch);
    ctx.moveTo(eyeDX - browW * 0.5, browY - arch);
    ctx.lineTo(eyeDX + browW * 0.5, browY + arch);
    ctx.stroke();
  }

  if (face.nose === 'dot') {
    ctx.fillStyle = darken(spec.palette.skin, 0.3);
    ctx.beginPath();
    ctx.arc(0.2, rig.headCenterY + 1, 0.62, 0, Math.PI * 2);
    ctx.fill();
  } else if (face.nose === 'line') {
    ctx.strokeStyle = darken(spec.palette.skin, 0.38);
    ctx.lineWidth = 0.95;
    ctx.beginPath();
    ctx.moveTo(0.2, rig.headCenterY - 0.1);
    ctx.lineTo(0.5, rig.headCenterY + 2.2);
    ctx.stroke();
  }

  if (face.blush) {
    ctx.fillStyle = rgba('#f87171', 0.24);
    ctx.beginPath();
    ctx.ellipse(-eyeDX - 0.4, rig.headCenterY + 2.8, 1.7, 1, 0, 0, Math.PI * 2);
    ctx.ellipse(eyeDX + 0.4, rig.headCenterY + 2.8, 1.7, 1, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = darken(spec.palette.skin, 0.45);
  ctx.lineWidth = 1;
  if (face.mouth === 'smile') {
    ctx.beginPath();
    ctx.arc(0, mouthY, 2.4 * (spec.body?.mouthW || 1), 0.15, Math.PI - 0.15);
    ctx.stroke();
  } else if (face.mouth === 'smirk') {
    ctx.beginPath();
    ctx.moveTo(-1.6, mouthY + 0.2);
    ctx.quadraticCurveTo(0.6, mouthY - 0.9, 2.6, mouthY + 0.15);
    ctx.stroke();
  } else if (face.mouth === 'open') {
    const mouth = roundedRectPath(-1.8 * (spec.body?.mouthW || 1), mouthY - 0.8, 3.6 * (spec.body?.mouthW || 1), 1.9, 0.7);
    fillAndStroke(ctx, mouth, darken(spec.palette.skin, 0.52), darken(spec.palette.skin, 0.62), 0.45);
  } else {
    ctx.beginPath();
    ctx.moveTo(-2.1 * (spec.body?.mouthW || 1), mouthY);
    ctx.lineTo(2.1 * (spec.body?.mouthW || 1), mouthY);
    ctx.stroke();
  }

  if (face.facialHair && face.facialHair !== 'none') {
    const hairShade = darken(spec.palette.hair, 0.2);
    if (face.facialHair === 'stache') {
      const st = new Path2D();
      st.moveTo(-2.6, rig.headCenterY + 2.8);
      st.quadraticCurveTo(-1.3, rig.headCenterY + 1.9, -0.2, rig.headCenterY + 2.7);
      st.quadraticCurveTo(1.3, rig.headCenterY + 1.9, 2.6, rig.headCenterY + 2.8);
      st.lineTo(2.1, rig.headCenterY + 3.5);
      st.quadraticCurveTo(0, rig.headCenterY + 2.8, -2.1, rig.headCenterY + 3.5);
      st.closePath();
      fillAndStroke(ctx, st, hairShade, darken(hairShade, 0.2), 0.6);
    } else if (face.facialHair === 'goatee') {
      const g = roundedRectPath(-1.55, mouthY + 1.35, 3.1, 2.7, 0.95);
      fillAndStroke(ctx, g, hairShade, darken(hairShade, 0.2), 0.6);
    } else if (face.facialHair === 'beard') {
      const b = new Path2D();
      const topY = mouthY + 2.2;
      const chinY = rig.headCenterY + rig.headRY * 0.86;
      b.moveTo(-rig.headRX * 0.44, topY);
      b.quadraticCurveTo(0, chinY, rig.headRX * 0.44, topY);
      b.lineTo(rig.headRX * 0.3, mouthY + 0.95);
      b.quadraticCurveTo(0, rig.headCenterY + rig.headRY * 0.63, -rig.headRX * 0.3, mouthY + 0.95);
      b.closePath();
      fillAndStroke(ctx, b, hairShade, darken(hairShade, 0.25), 0.7);
    }
  }
  ctx.restore();
}

function drawHair(ctx, spec, rig, side) {
  const headAccessory = spec.outfit.headAccessory || 'none';
  if (headAccessory === 'cap' || headAccessory === 'beanie' || headAccessory === 'visor') return;
  if (spec.outfit.hairStyle === 'bald') return;

  ctx.fillStyle = spec.palette.hair;
  // Use hair-toned edging to avoid a doubled dark rim against the head outline.
  ctx.strokeStyle = darken(spec.palette.hair, 0.2);
  ctx.lineWidth = 1.1;
  const hrx = rig.headRX;
  const hry = rig.headRY;

  if (spec.outfit.hairStyle === 'short_round') {
    const p = new Path2D();
    p.ellipse(0, rig.headCenterY - 3.2, hrx * 0.9, hry * 0.82, 0, Math.PI, Math.PI * 2);
    p.lineTo(hrx * 0.5, rig.headCenterY - 2);
    p.closePath();
    ctx.fill(p);
    ctx.stroke(p);
    paintLightPass(ctx, p, {
      x: -hrx * 0.9,
      y: rig.headCenterY - hry * 0.9,
      w: hrx * 1.8,
      h: hry * 1.05,
    }, { highlight: 0.18, shade: 0.2, specular: 0.12 });
    return;
  }

  if (spec.outfit.hairStyle === 'side_part') {
    const p = new Path2D();
    p.moveTo(-hrx * 0.8, rig.headCenterY - hry * 0.46);
    p.quadraticCurveTo(0, rig.headCenterY - hry * 1.12, hrx * 0.9, rig.headCenterY - hry * 0.56);
    p.lineTo(hrx * 0.3, rig.headCenterY - hry * 0.5);
    p.quadraticCurveTo(-2, rig.headCenterY - hry * 0.82, -hrx * 0.82, rig.headCenterY - hry * 0.44);
    p.closePath();
    ctx.fill(p);
    ctx.stroke(p);
    paintLightPass(ctx, p, {
      x: -hrx * 0.9,
      y: rig.headCenterY - hry * 1.12,
      w: hrx * 1.9,
      h: hry * 0.75,
    }, { highlight: 0.15, shade: 0.22, specular: 0.1 });
    return;
  }

  if (spec.outfit.hairStyle === 'curly_top') {
    for (let i = -2; i <= 2; i += 1) {
      const x = i * hrx * 0.19;
      const y = rig.headCenterY - hry * 0.84 + Math.abs(i) * 0.4;
      ctx.beginPath();
      ctx.arc(x, y, 2.3 + (Math.abs(i) === 2 ? 0.2 : 0), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    return;
  }

  if (spec.outfit.hairStyle === 'bob_cut') {
    const p = new Path2D();
    p.moveTo(-hrx * 0.9, rig.headCenterY - hry * 0.74);
    p.quadraticCurveTo(0, rig.headCenterY - hry * 1.12, hrx * 0.9, rig.headCenterY - hry * 0.74);
    p.lineTo(hrx * 0.82, rig.headCenterY - hry * 0.1);
    p.quadraticCurveTo(0, rig.headCenterY + hry * 0.1, -hrx * 0.82, rig.headCenterY - hry * 0.1);
    p.closePath();
    fillAndStroke(ctx, p, spec.palette.hair, darken(spec.palette.hair, 0.24), 1.1, darken(spec.palette.hair, 0.1));
    paintLightPass(ctx, p, { x: -hrx * 0.9, y: rig.headCenterY - hry * 1.15, w: hrx * 1.8, h: hry * 1.25 }, { highlight: 0.14, shade: 0.23, specular: 0.1 });
    return;
  }

  if (spec.outfit.hairStyle === 'spiky') {
    const spikes = 7;
    const p = new Path2D();
    p.moveTo(-hrx * 0.82, rig.headCenterY - hry * 0.16);
    for (let i = 0; i <= spikes; i += 1) {
      const t = i / spikes;
      const x = -hrx * 0.82 + t * hrx * 1.64;
      const peakY = rig.headCenterY - hry * (0.92 + Math.sin(t * Math.PI) * 0.2);
      p.lineTo(x, peakY);
    }
    p.lineTo(hrx * 0.8, rig.headCenterY - hry * 0.16);
    p.quadraticCurveTo(0, rig.headCenterY - hry * 0.08, -hrx * 0.82, rig.headCenterY - hry * 0.16);
    p.closePath();
    fillAndStroke(ctx, p, spec.palette.hair, darken(spec.palette.hair, 0.25), 1.1, darken(spec.palette.hair, 0.12));
    return;
  }

  if (spec.outfit.hairStyle === 'afro') {
    for (let i = -2; i <= 2; i += 1) {
      for (let j = -1; j <= 1; j += 1) {
        const x = i * hrx * 0.22 + j * 0.3;
        const y = rig.headCenterY - hry * 0.74 + Math.abs(i) * 0.44 + j * -0.25;
        ctx.beginPath();
        ctx.arc(x, y, 2.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    return;
  }

  if (spec.outfit.hairStyle === 'pony_tail') {
    const tailSign = (side?.near || 'R') === 'L' ? -1 : 1;
    const crown = new Path2D();
    crown.ellipse(0, rig.headCenterY - 2.8, hrx * 0.82, hry * 0.78, 0, Math.PI, Math.PI * 2);
    crown.closePath();
    ctx.fill(crown);
    ctx.stroke(crown);
    paintLightPass(ctx, crown, {
      x: -hrx * 0.82,
      y: rig.headCenterY - hry * 0.82 - 2.8,
      w: hrx * 1.64,
      h: hry * 0.95,
    }, { highlight: 0.15, shade: 0.2, specular: 0.1 });

    const anchorX = tailSign * hrx * 0.72;
    const anchorY = rig.headCenterY - 3.1;
    const rootX = anchorX + tailSign * 1.6;
    const rootY = rig.headCenterY + 2.5;
    const tipX = rootX + tailSign * 1.8;
    const tipY = rootY + 9.8;

    // Back strand: draw beneath the head so it connects to the crown naturally.
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    const strand = capsulePath(anchorX, anchorY, rootX, rootY, 1.7);
    fillAndStroke(ctx, strand, darken(spec.palette.hair, 0.06), darken(spec.palette.hair, 0.3), 1, darken(spec.palette.hair, 0.18));
    paintLightPass(ctx, strand, {
      x: Math.min(anchorX, rootX) - 2.2,
      y: Math.min(anchorY, rootY) - 2.2,
      w: Math.abs(rootX - anchorX) + 4.4,
      h: Math.abs(rootY - anchorY) + 4.4,
    }, { highlight: 0.1, shade: 0.2, specular: 0.08 });

    const tail = new Path2D();
    tail.moveTo(rootX - tailSign * 2.1, rootY);
    tail.quadraticCurveTo(rootX + tailSign * 1.7, rootY + 2.5, tipX + tailSign * 0.9, tipY - 1.5);
    tail.quadraticCurveTo(tipX + tailSign * 0.2, tipY + 2.5, tipX - tailSign * 1.6, tipY + 0.8);
    tail.quadraticCurveTo(rootX - tailSign * 3.1, rootY + 4.2, rootX - tailSign * 2.1, rootY);
    tail.closePath();
    fillAndStroke(ctx, tail, spec.palette.hair, darken(spec.palette.hair, 0.3), 1.1, darken(spec.palette.hair, 0.14));
    paintLightPass(ctx, tail, {
      x: Math.min(rootX, tipX) - 3.5,
      y: rootY - 1,
      w: Math.abs(tipX - rootX) + 7,
      h: (tipY - rootY) + 4,
    }, { highlight: 0.12, shade: 0.24, specular: 0.08 });
    ctx.restore();

    // Hair tie + flyaway stay behind the head silhouette to avoid face artifacts.
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    const tie = roundedRectPath(rootX - tailSign * 1.8, rootY - 1.2, 2.6, 2.4, 0.9);
    fillAndStroke(ctx, tie, lighten(spec.palette.hair, 0.24), darken(spec.palette.hair, 0.34), 0.9);
    const flyaway = capsulePath(anchorX - tailSign * 0.3, anchorY + 0.05, anchorX + tailSign * 0.7, anchorY + 0.6, 0.35);
    fillAndStroke(ctx, flyaway, lighten(spec.palette.hair, 0.15), darken(spec.palette.hair, 0.24), 0.45);
    ctx.restore();
  }
}

function drawHeadAccessory(ctx, spec, rig, side) {
  const kind = spec.outfit.headAccessory || 'none';
  if (kind === 'none') return;
  const hrx = rig.headRX;
  const hry = rig.headRY;
  const topY = rig.headCenterY - hry * 0.8;
  const near = (side?.near || 'R') === 'L' ? -1 : 1;

  if (kind === 'headband') {
    const band = new Path2D();
    band.moveTo(-hrx * 0.83, rig.headCenterY - hry * 0.26);
    band.quadraticCurveTo(0, rig.headCenterY - hry * 0.42, hrx * 0.83, rig.headCenterY - hry * 0.26);
    band.lineTo(hrx * 0.78, rig.headCenterY - hry * 0.1);
    band.quadraticCurveTo(0, rig.headCenterY - hry * 0.27, -hrx * 0.78, rig.headCenterY - hry * 0.1);
    band.closePath();
    fillAndStroke(ctx, band, lighten(spec.palette.accent, 0.05), primaryOutline(), 0.85, darken(spec.palette.accent, 0.06));
    return;
  }

  if (kind === 'cap') {
    const crown = new Path2D();
    crown.moveTo(-hrx * 0.8, topY + 0.5);
    crown.quadraticCurveTo(0, topY - hry * 0.45, hrx * 0.82, topY + 0.5);
    crown.lineTo(hrx * 0.72, rig.headCenterY - hry * 0.1);
    crown.lineTo(-hrx * 0.7, rig.headCenterY - hry * 0.1);
    crown.closePath();
    fillAndStroke(ctx, crown, darken(spec.palette.shirt, 0.18), primaryOutline(), 0.95, darken(spec.palette.shirt, 0.28));
    const brim = ribbonPath(
      [
        { x: -hrx * 0.2, y: rig.headCenterY - hry * 0.12 },
        { x: near * hrx * 0.58, y: rig.headCenterY - hry * 0.06 },
      ],
      [1.5, 2.1],
    );
    fillAndStroke(ctx, brim, darken(spec.palette.shirt, 0.25), primaryOutline(), 0.78);
    return;
  }

  if (kind === 'beanie') {
    const beanie = new Path2D();
    beanie.moveTo(-hrx * 0.84, topY + 1.2);
    beanie.quadraticCurveTo(0, topY - hry * 0.55, hrx * 0.84, topY + 1.2);
    beanie.lineTo(hrx * 0.74, rig.headCenterY - hry * 0.2);
    beanie.quadraticCurveTo(0, rig.headCenterY - hry * 0.3, -hrx * 0.74, rig.headCenterY - hry * 0.2);
    beanie.closePath();
    fillAndStroke(ctx, beanie, darken(spec.palette.accent, 0.2), primaryOutline(), 0.88, darken(spec.palette.accent, 0.3));
    const knit = roundedRectPath(-hrx * 0.62, rig.headCenterY - hry * 0.28, hrx * 1.24, 2.2, 1.1);
    fillAndStroke(ctx, knit, darken(spec.palette.accent, 0.1), darken(spec.palette.accent, 0.28), 0.55);
    return;
  }

  if (kind === 'headset') {
    const band = capsulePath(-hrx * 0.46, topY + 1.2, hrx * 0.46, topY + 1.2, 1.35);
    fillAndStroke(ctx, band, darken(spec.palette.outline, 0.06), primaryOutline(), 0.55);
    const padL = roundedRectPath(-hrx * 0.98, rig.eyeY - 0.7, 2.5, 4.3, 1.1);
    const padR = roundedRectPath(hrx * 0.73, rig.eyeY - 0.7, 2.5, 4.3, 1.1);
    fillAndStroke(ctx, padL, '#374151', primaryOutline(), 0.65);
    fillAndStroke(ctx, padR, '#374151', primaryOutline(), 0.65);
    const mic = capsulePath(hrx * 0.85, rig.eyeY + 1.5, hrx * 0.45, rig.mouthY + 0.9, 0.55);
    fillAndStroke(ctx, mic, '#4b5563', primaryOutline(), 0.45);
    return;
  }

  if (kind === 'bandana') {
    const wrap = new Path2D();
    wrap.moveTo(-hrx * 0.82, rig.headCenterY - hry * 0.34);
    wrap.quadraticCurveTo(0, rig.headCenterY - hry * 0.78, hrx * 0.82, rig.headCenterY - hry * 0.34);
    wrap.lineTo(hrx * 0.66, rig.headCenterY - hry * 0.04);
    wrap.quadraticCurveTo(0, rig.headCenterY - hry * 0.28, -hrx * 0.66, rig.headCenterY - hry * 0.04);
    wrap.closePath();
    fillAndStroke(ctx, wrap, darken(spec.palette.accent, 0.08), primaryOutline(), 0.8, darken(spec.palette.accent, 0.16));
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    const knot = roundedRectPath(near * hrx * 0.62, rig.headCenterY - hry * 0.06, 1.8, 1.5, 0.5);
    fillAndStroke(ctx, knot, darken(spec.palette.accent, 0.13), primaryOutline(), 0.55);
    const tail = ribbonPath(
      [
        { x: near * hrx * 0.74, y: rig.headCenterY + hry * 0.06 },
        { x: near * hrx * 0.88, y: rig.headCenterY + hry * 0.45 },
      ],
      [0.65, 0.95],
    );
    fillAndStroke(ctx, tail, darken(spec.palette.accent, 0.18), primaryOutline(), 0.55);
    ctx.restore();
  }
}

function drawEyewear(ctx, spec, rig) {
  const style = spec.outfit.eyewear || (spec.outfit.glasses ? 'round' : 'none');
  if (style === 'none') return;
  ctx.strokeStyle = darken(spec.palette.outline, 0.05);
  ctx.lineWidth = 1;
  const eyeDX = rig.eyeGap;
  const eyeY = rig.eyeY;
  const lensR = Math.max(1.6, rig.eyeR * 2.2);

  if (style === 'square') {
    const l = roundedRectPath(-eyeDX - lensR, eyeY - lensR * 0.7, lensR * 1.9, lensR * 1.45, 0.7);
    const r = roundedRectPath(eyeDX - lensR * 0.9, eyeY - lensR * 0.7, lensR * 1.9, lensR * 1.45, 0.7);
    fillAndStroke(ctx, l, rgba('#dbeafe', 0.1), primaryOutline(), 0.7);
    fillAndStroke(ctx, r, rgba('#dbeafe', 0.1), primaryOutline(), 0.7);
  } else if (style === 'shades') {
    const left = roundedRectPath(-eyeDX - lensR * 0.95, eyeY - lensR * 0.72, lensR * 1.9, lensR * 1.35, 0.72);
    const right = roundedRectPath(eyeDX - lensR * 0.95, eyeY - lensR * 0.72, lensR * 1.9, lensR * 1.35, 0.72);
    fillAndStroke(ctx, left, rgba('#0b1220', 0.82), primaryOutline(), 0.65);
    fillAndStroke(ctx, right, rgba('#0b1220', 0.82), primaryOutline(), 0.65);
    ctx.strokeStyle = rgba('#ffffff', 0.22);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-eyeDX - lensR * 0.55, eyeY - lensR * 0.4);
    ctx.lineTo(-eyeDX + lensR * 0.4, eyeY - lensR * 0.12);
    ctx.moveTo(eyeDX - lensR * 0.55, eyeY - lensR * 0.4);
    ctx.lineTo(eyeDX + lensR * 0.4, eyeY - lensR * 0.12);
    ctx.stroke();
  } else if (style === 'monocle') {
    ctx.beginPath();
    ctx.arc(-eyeDX, eyeY, lensR * 1.05, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = rgba('#94a3b8', 0.8);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-eyeDX + lensR * 0.82, eyeY + lensR * 0.82);
    ctx.lineTo(-eyeDX + lensR * 1.65, rig.mouthY + 1.8);
    ctx.stroke();
    return;
  } else if (style === 'visor') {
    const visor = roundedRectPath(-rig.headRX * 0.72, eyeY - 2.1, rig.headRX * 1.44, 3.9, 1.2);
    fillAndStroke(ctx, visor, rgba('#93c5fd', 0.28), primaryOutline(), 0.6);
    ctx.strokeStyle = rgba('#ffffff', 0.24);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-rig.headRX * 0.55, eyeY - 1.25);
    ctx.lineTo(rig.headRX * 0.3, eyeY - 0.7);
    ctx.stroke();
    return;
  } else {
    ctx.beginPath();
    ctx.arc(-eyeDX, eyeY, lensR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(eyeDX, eyeY, lensR, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(-eyeDX + lensR, eyeY);
  ctx.lineTo(eyeDX - lensR, eyeY);
  ctx.stroke();
}

function drawHeldItem(ctx, spec, rig, hand) {
  const mug = roundedRectPath(hand.x - 3, hand.y - 5, 6, 6, 1.5);
  fillAndStroke(ctx, mug, '#fafafa', '#1f2937', 1.1, '#d4d4d8');
  paintLightPass(ctx, mug, { x: hand.x - 3, y: hand.y - 5, w: 6, h: 6 }, { highlight: 0.24, shade: 0.14, specular: 0.28 });

  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(hand.x + 3.5, hand.y - 2.2, 1.6, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();

  ctx.strokeStyle = '#ffffffb0';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(hand.x - 0.8, hand.y - 5.5);
  ctx.quadraticCurveTo(hand.x - 1.8, hand.y - 8.6, hand.x + 0.2, hand.y - 10.3);
  ctx.stroke();

  // Finger overlay improves mug/hand readability at high zoom scales.
  const grip = roundedRectPath(hand.x + 0.2, hand.y - 3.8, 2.3, 4.3, 1);
  fillAndStroke(ctx, grip, spec.palette.skin, '#1f2937', 0.8);
}

export function frameCountForAnim(anim) {
  if (anim === 'walk' || anim === 'carry_walk') return 6;
  return 2;
}

export function drawDudeFrame(ctx, spec, dir, anim, frame, frameCount) {
  // Phase 1: compute motion + rig + pose geometry.
  const m = computeMotion(anim, frame, frameCount);
  const rig = computeRig(spec, m, dir);
  const side = nearFarForDir(dir);
  const pose = {
    armFar: computeArmPose(rig, side.far, 'far', m),
    armNear: computeArmPose(rig, side.near, 'near', m),
    legFar: computeLegPose(rig, side.far, 'far', m),
    legNear: computeLegPose(rig, side.near, 'near', m),
  };
  pose.handFar = { x: pose.armFar.wristX, y: pose.armFar.wristY };
  pose.handNear = { x: pose.armNear.wristX, y: pose.armNear.wristY };

  if (frame === 0) runRigSanity(spec, rig, pose);

  // Phase 2: build a strict render-layer plan and execute sorted layers.
  const layers = buildLayerPlan(ctx, spec, rig, side, m, pose);
  for (const layer of layers) {
    layer.draw();
  }

  return {
    handNear: pose.handNear,
    handFar: pose.handFar,
    feet: { x: 0, y: 0 },
  };
}
