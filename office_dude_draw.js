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
  return '#091521';
}

const LAYER_Z = {
  farArm: 10,
  farLeg: 20,
  torso: 30,
  tie: 34,
  badge: 36,
  head: 40,
  hair: 44,
  glasses: 46,
  nearLeg: 60,
  nearArm: 70,
  heldItem: 80,
};

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
  const thighT = rig.limbT * (spec.outfit.pantsStyle === 'slacks' ? 1.04 : 0.93);
  const calfT = thighT * 0.84;

  // Backing silhouette prevents any see-through gaps between segmented leg parts.
  const legBack = capsulePath(x, hipY - 0.75, footX, footY - 3.5, thighT * 0.88);
  fillAndStroke(ctx, legBack, darken(spec.palette.pants, 0.02), primaryOutline(), 1.05, darken(spec.palette.pants, 0.2));

  const thigh = capsulePath(x, hipY - 0.6, kneeX, kneeY, thighT);
  fillOnly(ctx, thigh, spec.palette.pants, darken(spec.palette.pants, 0.14));
  paintLightPass(ctx, thigh, {
    x: Math.min(x, kneeX) - thighT - 1,
    y: hipY - thighT - 1,
    w: Math.abs(kneeX - x) + thighT * 2 + 2,
    h: (kneeY - hipY) + thighT * 2 + 2,
  }, { highlight: 0.13, shade: 0.2, specular: 0.08 });

  const calf = capsulePath(kneeX, kneeY, footX, footY - 3.5, calfT);
  fillOnly(ctx, calf, darken(spec.palette.pants, 0.03), darken(spec.palette.pants, 0.16));
  paintLightPass(ctx, calf, {
    x: Math.min(kneeX, footX) - calfT - 1,
    y: kneeY - calfT - 1,
    w: Math.abs(footX - kneeX) + calfT * 2 + 2,
    h: (footY - 3.5 - kneeY) + calfT * 2 + 2,
  }, { highlight: 0.14, shade: 0.22, specular: 0.1 });

  // Segment seam for cleaner upper/lower leg separation.
  ctx.strokeStyle = darken(spec.palette.pants, 0.26);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(kneeX - 1.4, kneeY - 0.35);
  ctx.lineTo(kneeX + 1.4, kneeY - 0.35);
  ctx.stroke();

  const shoeW = spec.outfit.shoeStyle === 'loafer' ? 8.2 : 9.1;
  const shoeH = spec.outfit.shoeStyle === 'heel' ? 4.2 : 5.2;
  const shoe = roundedRectPath(footX - shoeW * 0.5, footY - shoeH, shoeW, shoeH, 2.2);
  fillAndStroke(ctx, shoe, spec.palette.shoes, primaryOutline(), 1.05, darken(spec.palette.shoes, 0.2));
  paintLightPass(ctx, shoe, {
    x: footX - shoeW * 0.5,
    y: footY - shoeH,
    w: shoeW,
    h: shoeH,
  }, { highlight: 0.2, shade: 0.28, specular: 0.2 });

  ctx.strokeStyle = darken(spec.palette.shoes, 0.35);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(footX - 3.5, footY - 1.2);
  ctx.lineTo(footX + 4, footY - 1.2);
  ctx.stroke();

  if (spec.outfit.shoeStyle === 'sneaker') {
    ctx.strokeStyle = lighten(spec.palette.shoes, 0.42);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(footX - 2.8, footY - 2.8);
    ctx.lineTo(footX + 2.9, footY - 2.8);
    ctx.stroke();
  } else if (spec.outfit.shoeStyle === 'heel') {
    const heel = roundedRectPath(footX + 2.3, footY - 2.2, 1.5, 2.2, 0.5);
    fillAndStroke(ctx, heel, darken(spec.palette.shoes, 0.1), primaryOutline(), 0.8);
  } else if (spec.outfit.shoeStyle === 'oxford') {
    ctx.fillStyle = darken(spec.palette.shoes, 0.4);
    ctx.beginPath();
    ctx.arc(footX + 2.4, footY - 3.2, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  if (spec.outfit.pantsStyle === 'jeans') {
    ctx.strokeStyle = lighten(spec.palette.pants, 0.2);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(x, hipY + 1.7);
    ctx.lineTo(kneeX + 0.2, kneeY + 0.1);
    ctx.lineTo(footX - 0.25, footY - 4.6);
    ctx.stroke();
  }
  if (spec.outfit.pantsStyle === 'chinos') {
    const cuff = roundedRectPath(footX - 2.4, footY - 5.2, 4.8, 1.8, 0.7);
    fillAndStroke(ctx, cuff, darken(spec.palette.pants, 0.12), spec.palette.outline, 0.75);
  }

  if (spec.outfit.skirt && depth === 'far' && !isLeft) {
    const skirt = roundedRectPath(-rig.torsoW * 0.45, hipY - 2, rig.torsoW * 0.9, 8.5, 3.4);
    fillAndStroke(ctx, skirt, darken(spec.palette.shirt, 0.06), spec.palette.outline, 1.2, darken(spec.palette.shirt, 0.2));
  }

  return { kneeY, footX, footY };
}

function drawArm(ctx, spec, rig, pose) {
  const { elbowX, elbowY, shoulderX, shoulderY, wristX, wristY } = pose;
  const upperT = rig.limbT * 0.96;
  const foreT = rig.limbT * 0.82;

  // Backing silhouette avoids small transparent seams around elbow/wrist joints.
  const armBack = capsulePath(shoulderX, shoulderY, wristX, wristY, upperT * 0.84);
  const armBackColor = darken(spec.palette.shirt, 0.02);
  fillAndStroke(ctx, armBack, armBackColor, primaryOutline(), 0.95, darken(armBackColor, 0.2));

  const sleeve = capsulePath(shoulderX, shoulderY, elbowX, elbowY, upperT);
  fillOnly(ctx, sleeve, darken(spec.palette.shirt, 0.01), darken(spec.palette.shirt, 0.12));
  paintLightPass(ctx, sleeve, {
    x: Math.min(shoulderX, elbowX) - upperT - 1,
    y: Math.min(shoulderY, elbowY) - upperT - 1,
    w: Math.abs(elbowX - shoulderX) + upperT * 2 + 2,
    h: Math.abs(elbowY - shoulderY) + upperT * 2 + 2,
  }, { highlight: 0.16, shade: 0.2, specular: 0.1 });

  const forearm = capsulePath(elbowX, elbowY, wristX, wristY, foreT);
  fillOnly(ctx, forearm, darken(spec.palette.shirt, 0.03), darken(spec.palette.shirt, 0.12));
  paintLightPass(ctx, forearm, {
    x: Math.min(elbowX, wristX) - foreT - 1,
    y: Math.min(elbowY, wristY) - foreT - 1,
    w: Math.abs(wristX - elbowX) + foreT * 2 + 2,
    h: Math.abs(wristY - elbowY) + foreT * 2 + 2,
  }, { highlight: 0.16, shade: 0.2, specular: 0.1 });

  if (spec.outfit.sleevesRolled) {
    const rolled = roundedRectPath(elbowX - 2.2, elbowY - 1.6, 4.4, 2.8, 1.1);
    fillOnly(ctx, rolled, darken(spec.palette.shirt, 0.09));
  }
  // Segment seam line to emphasize articulation without chunky overlap.
  ctx.strokeStyle = darken(spec.palette.shirt, 0.24);
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.moveTo(elbowX - 1.25, elbowY);
  ctx.lineTo(elbowX + 1.25, elbowY);
  ctx.stroke();
  const cuff = roundedRectPath(wristX - 2.2, wristY - 2.05, 4.4, 1.9, 0.7);
  fillOnly(ctx, cuff, darken(spec.palette.shirt, 0.08));
  const hand = roundedRectPath(wristX - 2.3, wristY - 1.05, 4.6, 2.55, 0.95);
  fillOnly(ctx, hand, spec.palette.skin);
  const armContour = capsulePath(shoulderX, shoulderY, wristX, wristY, upperT * 0.82);
  ctx.strokeStyle = primaryOutline();
  ctx.lineWidth = 0.95;
  ctx.stroke(armContour);

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
    { name: 'hair', z: LAYER_Z.hair, draw: () => drawHair(ctx, spec, rig, side) },
  );

  if (spec.outfit.glasses) layers.push({ name: 'glasses', z: LAYER_Z.glasses, draw: () => drawGlasses(ctx, spec, rig) });

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
  const neck = roundedRectPath(-rig.neckW * 0.5, rig.neckTopY, rig.neckW, neckH, 1.6);
  fillAndStroke(ctx, neck, darken(spec.palette.skin, 0.03), primaryOutline(), 1, darken(spec.palette.skin, 0.14));

  const shoulderW = rig.torsoW * 0.6;
  const waistW = rig.torsoW * 0.48;
  const hemW = rig.torsoW * 0.56;
  const topY = rig.torsoTop + 0.7;
  const botY = rig.hipY + 0.65;
  const body = new Path2D();
  body.moveTo(-shoulderW, topY);
  body.quadraticCurveTo(0, rig.torsoTop - 1.2, shoulderW, topY);
  body.quadraticCurveTo(hemW, rig.torsoTop + rig.torsoH * 0.56, hemW, botY - 1.1);
  body.quadraticCurveTo(waistW, botY + 1.3, 0, botY + 1.1);
  body.quadraticCurveTo(-waistW, botY + 1.3, -hemW, botY - 1.1);
  body.quadraticCurveTo(-hemW, rig.torsoTop + rig.torsoH * 0.56, -shoulderW, topY);
  body.closePath();
  fillAndStroke(ctx, body, shirtBase, primaryOutline(), 1.45, darken(spec.palette.shirt, 0.14));
  paintLightPass(ctx, body, {
    x: -shoulderW,
    y: rig.torsoTop - 1,
    w: rig.torsoW,
    h: rig.torsoH + 3,
  }, { highlight: 0.14, shade: 0.12, specular: 0.08 });

  const pelvis = roundedRectPath(-rig.torsoW * 0.37, rig.hipY - 3.1, rig.torsoW * 0.74, 5.1, 2);
  fillOnly(ctx, pelvis, darken(spec.palette.pants, 0.04), darken(spec.palette.pants, 0.12));
  paintLightPass(ctx, pelvis, {
    x: -rig.torsoW * 0.33,
    y: rig.hipY - 2.9,
    w: rig.torsoW * 0.66,
    h: 4.8,
  }, { highlight: 0.12, shade: 0.22, specular: 0.06 });

  const hipL = ellipsePath(-rig.hipDX, rig.hipY - 1, 2.1, 1.7);
  const hipR = ellipsePath(rig.hipDX, rig.hipY - 1, 2.1, 1.7);
  fillOnly(ctx, hipL, darken(spec.palette.pants, 0.08));
  fillOnly(ctx, hipR, darken(spec.palette.pants, 0.08));

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
  const head = roundedRectPath(-rig.headRX * 0.92, rig.headCenterY - rig.headRY * 0.88, rig.headRX * 1.84, rig.headRY * 1.76, rig.headRY * 0.56);
  fillAndStroke(ctx, head, spec.palette.skin, primaryOutline(), 1.55, darken(spec.palette.skin, 0.14));
  paintLightPass(ctx, head, {
    x: -rig.headRX,
    y: rig.headCenterY - rig.headRY,
    w: rig.headRX * 2,
    h: rig.headRY * 2,
  }, { highlight: 0.12, shade: 0.1, specular: 0.08 });

  const earW = 2.8 * (spec.body?.earSize || 1);
  const earH = 3.9 * (spec.body?.earSize || 1);
  const earL = ellipsePath(-rig.headRX * 0.99, rig.headCenterY + 0.15, earW * 0.72, earH * 0.62);
  const earR = ellipsePath(rig.headRX * 0.99, rig.headCenterY + 0.15, earW * 0.72, earH * 0.62);
  fillAndStroke(ctx, earL, darken(spec.palette.skin, 0.02), primaryOutline(), 0.8);
  fillAndStroke(ctx, earR, darken(spec.palette.skin, 0.02), primaryOutline(), 0.8);

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

  const eyeY = rig.eyeY;
  const face = spec.face || {};
  const eyeDX = rig.eyeGap;
  ctx.fillStyle = spec.palette.outline;
  if (face.eyes === 'wide') {
    ctx.beginPath();
    ctx.ellipse(-eyeDX, eyeY, rig.eyeR * 1.15, rig.eyeR * 0.82, 0, 0, Math.PI * 2);
    ctx.ellipse(eyeDX, eyeY, rig.eyeR * 1.15, rig.eyeR * 0.82, 0, 0, Math.PI * 2);
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
  } else if (face.eyes === 'happy') {
    ctx.strokeStyle = darken(spec.palette.outline, 0.02);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(-eyeDX, eyeY, 1.2, 0.1, Math.PI - 0.1);
    ctx.arc(eyeDX, eyeY, 1.2, 0.1, Math.PI - 0.1);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(-eyeDX, eyeY, rig.eyeR, 0, Math.PI * 2);
    ctx.arc(eyeDX, eyeY, rig.eyeR, 0, Math.PI * 2);
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
    ctx.arc(0, rig.mouthY, 2.4 * (spec.body?.mouthW || 1), 0.15, Math.PI - 0.15);
    ctx.stroke();
  } else if (face.mouth === 'smirk') {
    ctx.beginPath();
    ctx.moveTo(-1.6, rig.mouthY + 0.2);
    ctx.quadraticCurveTo(0.6, rig.mouthY - 0.9, 2.6, rig.mouthY + 0.15);
    ctx.stroke();
  } else if (face.mouth === 'open') {
    const mouth = roundedRectPath(-1.8 * (spec.body?.mouthW || 1), rig.mouthY - 0.8, 3.6 * (spec.body?.mouthW || 1), 1.9, 0.7);
    fillAndStroke(ctx, mouth, darken(spec.palette.skin, 0.52), darken(spec.palette.skin, 0.62), 0.45);
  } else {
    ctx.beginPath();
    ctx.moveTo(-2.1 * (spec.body?.mouthW || 1), rig.mouthY);
    ctx.lineTo(2.1 * (spec.body?.mouthW || 1), rig.mouthY);
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
      const mouthY = rig.mouthY;
      const g = roundedRectPath(-1.55, mouthY + 1.35, 3.1, 2.7, 0.95);
      fillAndStroke(ctx, g, hairShade, darken(hairShade, 0.2), 0.6);
    } else if (face.facialHair === 'beard') {
      const b = new Path2D();
      const mouthY = rig.mouthY;
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

function drawGlasses(ctx, spec, rig) {
  ctx.strokeStyle = darken(spec.palette.outline, 0.05);
  ctx.lineWidth = 1.1;
  const eyeDX = rig.eyeGap;
  const eyeY = rig.eyeY;
  const lensR = Math.max(1.7, rig.eyeR * 2.4);
  ctx.beginPath();
  ctx.arc(-eyeDX, eyeY, lensR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(eyeDX, eyeY, lensR, 0, Math.PI * 2);
  ctx.stroke();

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
