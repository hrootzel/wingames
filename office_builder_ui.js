import { OFFICE_STYLES } from './office_dude_spec.js';

function fillSelect(select, values) {
  select.innerHTML = '';
  for (const value of values) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    select.appendChild(opt);
  }
}

export function initBuilderUI(options) {
  const {
    root = document,
    onChange,
    onRandomize,
    onRebake,
  } = options || {};

  const controls = {
    seed: root.getElementById('office-seed'),
    randomize: root.getElementById('office-randomize'),
    rebake: root.getElementById('office-rebake'),
    hairStyle: root.getElementById('office-hair-style'),
    shirtStyle: root.getElementById('office-shirt-style'),
    pantsStyle: root.getElementById('office-pants-style'),
    shoeStyle: root.getElementById('office-shoe-style'),
    faceEyes: root.getElementById('office-face-eyes'),
    faceMouth: root.getElementById('office-face-mouth'),
    faceBrows: root.getElementById('office-face-brows'),
    faceNose: root.getElementById('office-face-nose'),
    faceFacialHair: root.getElementById('office-face-facial-hair'),
    faceBlush: root.getElementById('office-face-blush'),
    eyewear: root.getElementById('office-eyewear'),
    headAccessory: root.getElementById('office-head-accessory'),
    tie: root.getElementById('office-tie'),
    badge: root.getElementById('office-badge'),
    jacket: root.getElementById('office-jacket'),
    skirt: root.getElementById('office-skirt'),
    carry: root.getElementById('office-carry'),
    skin: root.getElementById('office-skin-color'),
    hair: root.getElementById('office-hair-color'),
    shirt: root.getElementById('office-shirt-color'),
    pants: root.getElementById('office-pants-color'),
  };

  fillSelect(controls.hairStyle, OFFICE_STYLES.hair);
  fillSelect(controls.shirtStyle, OFFICE_STYLES.shirt);
  fillSelect(controls.pantsStyle, OFFICE_STYLES.pants);
  fillSelect(controls.shoeStyle, OFFICE_STYLES.shoes);
  fillSelect(controls.faceEyes, OFFICE_STYLES.eyes);
  fillSelect(controls.faceMouth, OFFICE_STYLES.mouth);
  fillSelect(controls.faceBrows, OFFICE_STYLES.brows);
  fillSelect(controls.faceNose, OFFICE_STYLES.nose);
  fillSelect(controls.faceFacialHair, OFFICE_STYLES.facialHair);
  fillSelect(controls.eyewear, OFFICE_STYLES.eyewear);
  fillSelect(controls.headAccessory, OFFICE_STYLES.headAccessory);

  const read = () => ({
    seed: controls.seed.value,
    carry: controls.carry.checked,
    overrides: {
      palette: {
        skin: controls.skin.value,
        hair: controls.hair.value,
        shirt: controls.shirt.value,
        pants: controls.pants.value,
      },
      outfit: {
        hairStyle: controls.hairStyle.value,
        shirtStyle: controls.shirtStyle.value,
        pantsStyle: controls.pantsStyle.value,
        shoeStyle: controls.shoeStyle.value,
        eyewear: controls.eyewear.value,
        glasses: controls.eyewear.value !== 'none',
        headAccessory: controls.headAccessory.value,
        tie: controls.tie.checked,
        badge: controls.badge.checked,
        jacket: controls.jacket.checked,
        skirt: controls.skirt.checked,
      },
      face: {
        eyes: controls.faceEyes.value,
        mouth: controls.faceMouth.value,
        brows: controls.faceBrows.value,
        nose: controls.faceNose.value,
        facialHair: controls.faceFacialHair.value,
        blush: controls.faceBlush.checked,
      },
    },
  });

  const sync = (spec, carryOn = false) => {
    const face = spec.face || {};
    controls.seed.value = String(spec.seed ?? '');
    controls.hairStyle.value = spec.outfit.hairStyle;
    controls.shirtStyle.value = spec.outfit.shirtStyle;
    controls.pantsStyle.value = spec.outfit.pantsStyle;
    controls.shoeStyle.value = spec.outfit.shoeStyle;
    controls.faceEyes.value = face.eyes || OFFICE_STYLES.eyes[0];
    controls.faceMouth.value = face.mouth || OFFICE_STYLES.mouth[0];
    controls.faceBrows.value = face.brows || OFFICE_STYLES.brows[0];
    controls.faceNose.value = face.nose || OFFICE_STYLES.nose[0];
    controls.faceFacialHair.value = face.facialHair || OFFICE_STYLES.facialHair[0];
    controls.faceBlush.checked = !!face.blush;
    controls.eyewear.value = spec.outfit.eyewear || (spec.outfit.glasses ? 'round' : OFFICE_STYLES.eyewear[0]);
    controls.headAccessory.value = spec.outfit.headAccessory || OFFICE_STYLES.headAccessory[0];
    controls.tie.checked = !!spec.outfit.tie;
    controls.badge.checked = !!spec.outfit.badge;
    controls.jacket.checked = !!spec.outfit.jacket;
    controls.skirt.checked = !!spec.outfit.skirt;
    controls.carry.checked = !!carryOn;
    controls.skin.value = spec.palette.skin;
    controls.hair.value = spec.palette.hair;
    controls.shirt.value = spec.palette.shirt;
    controls.pants.value = spec.palette.pants;
  };

  const changeTargets = [
    controls.seed,
    controls.hairStyle,
    controls.shirtStyle,
    controls.pantsStyle,
    controls.shoeStyle,
    controls.faceEyes,
    controls.faceMouth,
    controls.faceBrows,
    controls.faceNose,
    controls.faceFacialHair,
    controls.faceBlush,
    controls.eyewear,
    controls.headAccessory,
    controls.tie,
    controls.badge,
    controls.jacket,
    controls.skirt,
    controls.carry,
    controls.skin,
    controls.hair,
    controls.shirt,
    controls.pants,
  ];

  for (const el of changeTargets) {
    el.addEventListener('input', () => {
      if (onChange) onChange(read());
    });
    el.addEventListener('change', () => {
      if (onChange) onChange(read());
    });
  }

  controls.randomize.addEventListener('click', () => {
    if (onRandomize) onRandomize();
  });

  controls.rebake.addEventListener('click', () => {
    if (onRebake) onRebake(read());
  });

  return {
    controls,
    read,
    sync,
  };
}
