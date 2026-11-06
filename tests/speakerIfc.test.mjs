// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// ROAD-3583: the speaker's .ifc twin (js/model/speakerIfc.js) — written byte-deterministically, read back to
// the same speaker, saved beside the .speaker.json by the shared Save Model. IFC_OUT=<dir> npm test also
// writes the files there, for IfcOpenShell validate + the BIM oracle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SPEAKER_TEMPLATES, createDefaultSpeaker } from '../js/model/speaker.js';
import { speakerToIfc, speakerFromIfc, speakerTypeOf, speakerStem } from '../js/model/speakerIfc.js';
import { world } from './softappWorld.mjs';

function out(name, text) {
  if (!process.env.IFC_OUT) return;
  mkdirSync(process.env.IFC_OUT, { recursive: true });
  writeFileSync(join(process.env.IFC_OUT, name), text);
}

for (const key of Object.keys(SPEAKER_TEMPLATES)) {
  test(`${key}: the same box writes the same bytes and reads back to the same speaker`, () => {
    const spk = createDefaultSpeaker(key);
    const a = speakerToIfc(spk);
    assert.match(a, /^ISO-10303-21;/);
    assert.equal(a, speakerToIfc(createDefaultSpeaker(key)));
    assert.match(a, /IFCAUDIOVISUALAPPLIANCETYPE\('[^']+',#\d+,'APK Audio [^']+',\$,\$,\([^)]*\),\(#\d+\),'[^']+',\$,\.SPEAKER\.\);/);
    out(`speaker-${key}.ifc`, a);
    assert.deepEqual(speakerFromIfc(a), spk);
    assert.equal(speakerToIfc(speakerFromIfc(a)), a, 'read and written again: the same file');
  });
}

test('the box words: coaxial, a sub, else full range; coverage in degrees and the enclosure in litres carry their unit', () => {
  assert.equal(speakerTypeOf(createDefaultSpeaker('coaxial12')), 'COAXIAL');
  assert.equal(speakerTypeOf(createDefaultSpeaker('subwoofer15')), 'WOOFER');
  assert.equal(speakerTypeOf(createDefaultSpeaker('nearfield2way')), 'FULLRANGE');
  const a = speakerToIfc(createDefaultSpeaker('nearfield2way'));
  assert.match(a, /IFCCONVERSIONBASEDUNIT\(#\d+,\.PLANEANGLEUNIT\.,'degree',#\d+\)/);
  assert.match(a, /'CoverageHorizontal',\$,IFCPLANEANGLEMEASURE\(90\.\),#\d+\)/);
  assert.match(a, /'EnclosureVolume',\$,IFCVOLUMEMEASURE\(15\.8\),#\d+\)/);
  assert.match(a, /'DriverSensitivity',\$,\(IFCIDENTIFIER\('d-1'\),IFCIDENTIFIER\('d-2'\)\)/, 'the port states no sensitivity, so it has no row');
});

test('a BIM loudspeaker part reads as a speaker: what it does not state stays out', () => {
  const part = speakerToIfc({ id: 'genelec/8030c', name: '8030C', maker: 'Genelec', cabinet: { w: 189, h: 299, d: 178 }, drivers: [], specs: { sensitivity: 104 } });
  const spk = speakerFromIfc(part);
  assert.equal(spk.maker, 'Genelec');
  assert.equal(spk.specs.sensitivity, 104);
  assert.deepEqual(spk.cabinet, { w: 189, h: 299, d: 178 });
  assert.deepEqual(spk.drivers, []);
  assert.throws(() => speakerFromIfc(part.replace('.SPEAKER.', '.AMPLIFIER.')), /no loudspeaker in this IFC/);
});

test('Save File is Save Model: <name>.speaker.ifc first, then <name>.speaker.json, both or neither', async () => {
  const w = world({ framed: false });
  const spk = createDefaultSpeaker('mainHorn');
  const stem = `${speakerStem(spk)}.speaker`;
  const r = await w.S.saveModel(spk, { name: stem, toIfc: (s) => speakerToIfc(s, { name: stem }) });
  assert.equal(r.ok, true);
  assert.deepEqual(w.downloads.map((d) => d.name), ['studio_main_215_horn.speaker.ifc', 'studio_main_215_horn.speaker.json']);
  assert.equal(w.downloads[0].text, speakerToIfc(spk, { name: stem }));
  assert.deepEqual(JSON.parse(w.downloads[1].text), spk);
  const o = await w.S.openModel({ file: { name: 'x.speaker.ifc', text: () => w.downloads[0].text }, fromIfc: (t) => speakerFromIfc(t) });
  assert.equal(o.kind, 'ifc');
  assert.deepEqual(o.model, spk);
});
