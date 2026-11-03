// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultSpeaker,
  computeVolumeLitres,
  computeBaffleStepHz,
  computeMaxSpl,
  validateDriverPlacement,
  exportToAcousticPreset,
  importSpeakerJson,
  SPEAKER_TEMPLATES,
} from '../js/model/speaker.js';

test('createDefaultSpeaker initializes valid cabinet and driver layout', () => {
  const spk = createDefaultSpeaker();
  assert.ok(spk.cabinet.w > 0);
  assert.ok(spk.cabinet.h > 0);
  assert.ok(spk.cabinet.d > 0);
  assert.ok(spk.drivers.length >= 2, 'Default monitor should have at least 2 drivers (2-way)');
  assert.ok(spk.crossovers.length >= 1, 'Default 2-way has at least one crossover point');
});

test('computeVolumeLitres correctly computes net internal litres from dimensions and wall thickness', () => {
  // 300 x 500 x 400 mm with 20 mm wall thickness
  // internal: 260 x 460 x 360 mm = 43,056,000 mm^3 = 43.056 L
  const cab = { w: 300, h: 500, d: 400, wallThickness: 20 };
  const litres = computeVolumeLitres(cab);
  assert.strictEqual(litres, 43.06);
});

test('computeBaffleStepHz approximates f3 baffle-step wrap frequency', () => {
  // Baffle 240 mm wide (0.24 m): 115 / 0.24 ~ 479 Hz
  const f = computeBaffleStepHz(240);
  assert.strictEqual(Math.round(f), 479);
});

test('computeMaxSpl matches sensitivity + 10 * log10(watts)', () => {
  // 90 dB @ 1W, 100W -> 90 + 20 = 110 dB
  assert.strictEqual(computeMaxSpl(90, 100), 110);
  // 93 dB @ 1W, 200W -> 93 + 23.01 = 116 dB
  assert.strictEqual(computeMaxSpl(93, 200), 116);
});

test('validateDriverPlacement flags drivers exceeding baffle bounds', () => {
  const cab = { w: 200, h: 300 };
  const drivers = [
    { id: 'd1', role: 'woofer', x: 0, y: 100, diameter: 160 }, // fits inside
    { id: 'd2', role: 'tweeter', x: 120, y: 250, diameter: 50 }, // exceeds width (+120 + 25 = 145 > 100)
  ];
  const issues = validateDriverPlacement(cab, drivers);
  assert.ok(issues.some((i) => i.driverId === 'd2' && i.type === 'out-of-bounds'));
});

test('validateDriverPlacement flags overlapping drivers', () => {
  const cab = { w: 300, h: 500 };
  const drivers = [
    { id: 'd1', role: 'woofer', x: 0, y: 150, diameter: 200 },
    { id: 'd2', role: 'mid', x: 0, y: 220, diameter: 120 }, // dist 70 mm, sum of radii = 100 + 60 = 160 mm -> overlap!
  ];
  const issues = validateDriverPlacement(cab, drivers);
  assert.ok(issues.some((i) => i.type === 'overlap'));
});

test('exportToAcousticPreset exports schema compatible with Acoustic.Like.audio', () => {
  const spk = createDefaultSpeaker();
  const preset = exportToAcousticPreset(spk);
  assert.ok(preset.label);
  assert.ok(preset.maker);
  assert.ok(typeof preset.litres === 'number');
  assert.ok(preset.sensitivity > 0);
  assert.ok(preset.watts > 0);
  assert.ok(preset.maxSpl > 0);
  assert.ok(preset.fLow > 0);
  assert.ok(preset.fHigh > preset.fLow);
  assert.ok(typeof preset.hCov === 'number');
  assert.ok(typeof preset.vCov === 'number');
  assert.ok(preset.omniBelow > 0);
});

test('SPEAKER_TEMPLATES provides valid reference configurations', () => {
  const templates = Object.keys(SPEAKER_TEMPLATES);
  assert.ok(templates.length >= 4);
  for (const key of templates) {
    const t = SPEAKER_TEMPLATES[key];
    assert.ok(t.name);
    assert.ok(t.cabinet.w > 0);
    assert.ok(t.drivers.length >= 1);
    const issues = validateDriverPlacement(t.cabinet, t.drivers);
    assert.strictEqual(issues.length, 0, `Template ${key} should have no placement collisions`);
  }
});

test('importSpeakerJson handles roundtrip export and import safely', () => {
  const original = createDefaultSpeaker();
  original.name = 'Custom Monitor X8';
  original.cabinet.w = 260;
  original.cabinet.h = 420;

  const jsonStr = JSON.stringify(original);
  const parsed = importSpeakerJson(jsonStr);
  assert.strictEqual(parsed.name, 'Custom Monitor X8');
  assert.strictEqual(parsed.cabinet.w, 260);
  assert.strictEqual(parsed.cabinet.h, 420);
});
