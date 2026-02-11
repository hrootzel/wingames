import { rngFromSeed } from './office_rng.js';

const HAIR = ['bald', 'side_part', 'short_round', 'curly_top', 'pony_tail', 'bob_cut', 'spiky', 'afro'];
const SHIRT = ['tee', 'button_down', 'sweater', 'hoodie', 'vest'];
const PANTS = ['slacks', 'jeans', 'chinos'];
const SHOES = ['oxford', 'sneaker', 'loafer', 'heel'];
const FACE_EYES = ['dot', 'wide', 'sleepy', 'happy', 'half_lid', 'squint', 'wink', 'tired'];
const FACE_MOUTH = ['line', 'smile', 'smirk', 'open'];
const FACE_BROWS = ['none', 'straight', 'arched', 'thick'];
const FACE_NOSE = ['none', 'dot', 'line'];
const FACIAL_HAIR = ['none', 'stache', 'goatee', 'beard'];
const EYEWEAR = ['none', 'round', 'square', 'shades', 'monocle', 'visor'];
const HEAD_ACCESSORY = ['none', 'headband', 'cap', 'beanie', 'headset', 'bandana'];
const PATTERN = ['solid', 'pinstripe', 'color_block'];
const JACKET_STYLE = ['none', 'blazer', 'cardigan'];

const SKIN = ['#f5d7c4', '#f0c3a3', '#dbab8b', '#c78d6d', '#9f6f53'];
const HAIR_COLORS = ['#1f2937', '#111827', '#3f2f23', '#7c3f20', '#6b7280'];
const SHIRT_COLORS = ['#2c6db4', '#3e8b65', '#8f4cbe', '#b44545', '#506081'];
const PANTS_COLORS = ['#30445d', '#1f3a5a', '#5a4632', '#3f3f46'];
const SHOE_COLORS = ['#252525', '#3f2f2f', '#1f2937'];
const ACCENT_COLORS = ['#fbbf24', '#ef4444', '#22c55e', '#60a5fa'];

const DEFAULTS = {
  scale: 1,
  headScale: 1,
  torsoWidth: 26,
  torsoHeight: 22,
  legLength: 12,
  armLength: 12,
  limbThickness: 1,
};

function deepMerge(base, extra) {
  if (!extra) return base;
  const out = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = deepMerge(base[key] || {}, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function makeDudeSpec(seed, overrides = null) {
  const rng = rngFromSeed(seed);
  const base = {
    seed: String(seed ?? ''),
    name: `Office Dude ${rng.int(100, 999)}`,
    scale: DEFAULTS.scale,
    headScale: 0.95 + rng.float() * 0.2,
    torsoWidth: DEFAULTS.torsoWidth + rng.int(-2, 2),
    torsoHeight: DEFAULTS.torsoHeight + rng.int(-2, 2),
    legLength: DEFAULTS.legLength + rng.int(-1, 2),
    armLength: DEFAULTS.armLength + rng.int(-1, 2),
    limbThickness: DEFAULTS.limbThickness + rng.float() * 0.45,
    body: {
      shoulderWidth: 0.95 + rng.float() * 0.24,
      neckHeight: 0.7 + rng.float() * 0.7,
      headW: 0.9 + rng.float() * 0.28,
      headH: 0.9 + rng.float() * 0.2,
      eyeGap: 0.9 + rng.float() * 0.45,
      eyeSize: 0.9 + rng.float() * 0.45,
      mouthW: 0.85 + rng.float() * 0.5,
      earSize: 0.8 + rng.float() * 0.6,
    },
    face: {
      eyes: rng.pick(FACE_EYES),
      mouth: rng.pick(FACE_MOUTH),
      brows: rng.pick(FACE_BROWS),
      nose: rng.pick(FACE_NOSE),
      blush: rng.float() < 0.24,
      facialHair: rng.pick(FACIAL_HAIR),
    },
    palette: {
      skin: rng.pick(SKIN),
      hair: rng.pick(HAIR_COLORS),
      shirt: rng.pick(SHIRT_COLORS),
      pants: rng.pick(PANTS_COLORS),
      shoes: rng.pick(SHOE_COLORS),
      accent: rng.pick(ACCENT_COLORS),
      outline: '#102031',
    },
    outfit: {
      glasses: rng.float() < 0.24,
      eyewear: rng.float() < 0.62 ? 'none' : rng.pick(EYEWEAR.slice(1)),
      tie: rng.float() < 0.44,
      badge: rng.float() < 0.35,
      jacket: rng.float() < 0.28,
      skirt: rng.float() < 0.16,
      sleevesRolled: rng.float() < 0.28,
      suspenders: rng.float() < 0.18,
      pocketSquare: rng.float() < 0.16,
      hairStyle: rng.pick(HAIR),
      shirtStyle: rng.pick(SHIRT),
      pantsStyle: rng.pick(PANTS),
      shoeStyle: rng.pick(SHOES),
      shirtPattern: rng.pick(PATTERN),
      jacketStyle: rng.pick(JACKET_STYLE),
      headAccessory: rng.float() < 0.58 ? 'none' : rng.pick(HEAD_ACCESSORY.slice(1)),
    },
  };

  const merged = deepMerge(base, overrides || {});
  if (!merged.outfit.eyewear) {
    merged.outfit.eyewear = merged.outfit.glasses ? 'round' : 'none';
  }
  merged.outfit.glasses = merged.outfit.eyewear !== 'none';
  if (!merged.outfit.jacket) {
    merged.outfit.jacketStyle = 'none';
  } else if (merged.outfit.jacketStyle === 'none') {
    merged.outfit.jacketStyle = 'blazer';
  }
  if (merged.outfit.shirtStyle === 'vest') {
    merged.outfit.tie = true;
  }
  if (merged.outfit.shirtStyle === 'hoodie') {
    merged.outfit.tie = false;
    merged.outfit.badge = merged.outfit.badge && merged.outfit.jacket;
  }
  if (merged.face.facialHair === 'beard') {
    merged.outfit.tie = merged.outfit.tie && merged.outfit.shirtStyle !== 'tee';
  }
  return merged;
}

export const OFFICE_STYLES = {
  hair: HAIR,
  shirt: SHIRT,
  pants: PANTS,
  shoes: SHOES,
  eyes: FACE_EYES,
  mouth: FACE_MOUTH,
  brows: FACE_BROWS,
  nose: FACE_NOSE,
  facialHair: FACIAL_HAIR,
  eyewear: EYEWEAR,
  headAccessory: HEAD_ACCESSORY,
  pattern: PATTERN,
  jacketStyle: JACKET_STYLE,
};
