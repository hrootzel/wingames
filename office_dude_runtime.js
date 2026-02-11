const ANIM_FPS = {
  idle: 2,
  walk: 10,
  carry_idle: 2,
  carry_walk: 10,
};

export function getAnimFrame(atlas, anim, t) {
  const frames = atlas.frameCounts[anim] || 1;
  const fps = ANIM_FPS[anim] || 2;
  const phase = (Math.max(0, t) * fps) % frames;
  return Math.floor(phase);
}

export function drawDude(ctx, atlas, state) {
  if (!atlas) return null;
  const dir = state.dir || 'SE';
  const anim = state.anim || 'idle';
  const scale = Math.max(0.1, state.scale || 1);
  const frame = getAnimFrame(atlas, anim, state.t || 0);
  const key = `${dir}:${anim}:${frame}`;
  const image = atlas.images.get(key);
  const meta = atlas.meta.get(key) || { originX: atlas.frameW / 2, originY: atlas.frameH * 0.8 };
  if (!image) return { key, frame };

  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(
    image,
    Math.round(state.x - meta.originX * scale),
    Math.round(state.y - meta.originY * scale),
    Math.round(atlas.frameW * scale),
    Math.round(atlas.frameH * scale),
  );

  return { key, frame, dir, anim };
}
