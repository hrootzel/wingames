function hashSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return seed >>> 0;
  }
  const text = String(seed ?? 'office-dude');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rngFromSeed(seed) {
  let state = hashSeed(seed) || 0x6d2b79f5;
  return {
    next() {
      state += 0x6d2b79f5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return (t ^ (t >>> 14)) >>> 0;
    },
    float() {
      return this.next() / 4294967296;
    },
    int(min, max) {
      if (max < min) return min;
      return min + Math.floor(this.float() * (max - min + 1));
    },
    pick(items) {
      return items[this.int(0, items.length - 1)];
    },
  };
}

