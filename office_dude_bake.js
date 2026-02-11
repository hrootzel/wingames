import { drawDudeFrame, frameCountForAnim } from './office_dude_draw.js';

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

async function maybeImageBitmap(canvas, useImageBitmap) {
  if (!useImageBitmap || typeof createImageBitmap !== 'function') {
    return canvas;
  }
  try {
    return await createImageBitmap(canvas);
  } catch {
    return canvas;
  }
}

export async function bakeDudeAtlas(spec, options = {}) {
  const dirs = options.dirs || ['NE', 'NW', 'SE', 'SW'];
  const anims = options.anims || ['idle', 'walk', 'carry_idle', 'carry_walk'];
  const frameW = options.frameSize || 96;
  const frameH = options.frameSize || 96;
  const bakeScale = options.bakeScale || 2;
  const useImageBitmap = options.useImageBitmap !== false;
  const origin = options.origin || { x: 48, y: 78 };

  const images = new Map();
  const meta = new Map();
  const frameCounts = {};

  for (const anim of anims) {
    frameCounts[anim] = frameCountForAnim(anim);
  }

  for (const dir of dirs) {
    for (const anim of anims) {
      const frames = frameCounts[anim];
      for (let frame = 0; frame < frames; frame += 1) {
        const canvas = makeCanvas(frameW * bakeScale, frameH * bakeScale);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.scale(bakeScale, bakeScale);
        ctx.translate(origin.x, origin.y);
        const frameMeta = drawDudeFrame(ctx, spec, dir, anim, frame, frames);
        ctx.restore();

        const key = `${dir}:${anim}:${frame}`;
        images.set(key, await maybeImageBitmap(canvas, useImageBitmap));
        meta.set(key, {
          originX: origin.x,
          originY: origin.y,
          handNearX: origin.x + (frameMeta?.handNear?.x || 0),
          handNearY: origin.y + (frameMeta?.handNear?.y || 0),
        });
      }
    }
  }

  return {
    frameW,
    frameH,
    bakeScale,
    images,
    meta,
    frameCounts,
    dirs,
    anims,
  };
}
