// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* speakerIfc.js — THE SPEAKER'S .IFC TWIN (ROAD-3583). Save File writes the native .speaker.json AND this
   IFC4X3_ADD2 file through APKSoftapp.saveModel; Open File reads either back to the same speaker. Written
   with the contracts STEP codec (vendor/apk-contracts/apk-ifc.js, scripts/vendor-ifc.mjs), no IfcOpenShell
   in the page. Byte-deterministic: the same speaker writes the same file.

   The file is shaped like a DATABASE.server.BIM loudspeaker PART (bim/ifc.py): a type library, so the box
   drops into the library or the Acoustic room as a type.

     IfcProject ─IfcRelDeclares─ IfcProjectLibrary ─IfcRelDeclares─ IfcAudioVisualApplianceType SPEAKER
         Tag = the speaker id, Name = maker + model; units mm, W, Hz, ohm
       RepresentationMaps    the Body box, cabinet w x d x h (mm), as a part's
       Pset_ManufacturerTypeInformation   Manufacturer, ModelReference, ModelLabel
       Pset_AudioVisualApplianceTypeSpeaker.SpeakerType   COAXIAL (a coax driver) / WOOFER (a sub) / FULLRANGE
       APK_LoudspeakerType   sensitivity, max SPL, power handling, impedance, range, crossover, omni-below,
                             coverage (degree, on the property), pattern, driver words, enclosure (litre, on
                             the property) and its type
       APK_SpeakerBuild      what only this editor knows: kind, wall thickness, baffle colour, the drivers on
                             the baffle (ids, roles, names, x / y mm as lists; each driver's own figures as
                             tables keyed by its id, only what it states), the crossovers
   Everything is ISO 16739 or an APK_ set declared in DATABASE.server.BIM SRC/tools/ifc
   (apk_psets_acoustic.py APK_LoudspeakerType, apk_psets_editors.py APK_SpeakerBuild). */

import { entitiesByType, enumv, ifcGuid, isRef, parseStep, real, ref, typed, unwrap, writeStep } from '../../vendor/apk-contracts/apk-ifc.js';

export const SPEAKER_IFC_SCHEMA = 'IFC4X3_ADD2';
const STAMP = '1970-01-01T00:00:00';   // fixed: the file is a function of the speaker, never of the clock
const DEGREE_IN_RADIAN = 0.017453292519943295;

const str = (v) => (v == null ? '' : String(v));
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const pos = (v) => { const n = num(v); return n != null && n > 0 ? n : null; };
const label = (s) => typed('IFCLABEL', String(s));
const ident = (s) => typed('IFCIDENTIFIER', String(s));
const m = (type, x) => typed(type, real(Object.is(x, -0) ? 0 : x));

class Writer {
  constructor() { this.entities = []; }
  add(type, ...args) {
    const id = this.entities.length + 1;
    this.entities.push({ id, type, args });
    return ref(id);
  }
}

/** The file stem Save File uses: the name, lower-case, [a-z0-9_-]. */
export function speakerStem(speaker) {
  return String(speaker?.name || 'speaker').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
}

/** Pset_AudioVisualApplianceTypeSpeaker.SpeakerType for the box. */
export function speakerTypeOf(speaker) {
  const drivers = Array.isArray(speaker?.drivers) ? speaker.drivers : [];
  if (drivers.some((d) => d.role === 'coax')) return 'COAXIAL';
  if (speaker?.kind === 'sub') return 'WOOFER';
  return 'FULLRANGE';
}

/** The driver words Acoustic shows (exportToAcousticPreset's): coaxial 12", 2-way 8" ... */
function driverWords(speaker) {
  const drivers = speaker.drivers || [];
  const ways = drivers.filter((d) => d.role !== 'port').length;
  const primary = drivers.find((d) => d.role === 'woofer' || d.role === 'coax') || drivers[0];
  if (!primary || !pos(primary.diameter)) return null;
  const inches = Math.round(primary.diameter / 25.4);
  if (primary.role === 'coax') return `coaxial ${inches}"`;
  if (ways === 2) return `2-way ${inches}"`;
  if (ways === 3) return `3-way ${inches}"`;
  return `${inches}"`;
}

/** The speaker (the editor's model, js/model/speaker.js) as IFC4X3_ADD2 STEP text. */
export function speakerToIfc(speaker, { name } = {}) {
  const s = speaker || {};
  const cab = s.cabinet || {};
  const specs = s.specs || {};
  const dir = s.directivity || {};
  const drivers = Array.isArray(s.drivers) ? s.drivers : [];
  const crossovers = (Array.isArray(s.crossovers) ? s.crossovers : []).filter((x) => pos(x?.f) != null);
  const stem = String(name || speakerStem(s)).replace(/\.(ifc|json)$/i, '');
  const key = str(s.id) || stem;
  const maker = str(s.maker) || 'Custom';
  const model = str(s.name) || 'Speaker';
  const W = new Writer();
  const P = ifcGuid('speaker', key);

  // ---- owner, units, contexts
  const person = W.add('IFCPERSON', null, 'APK.audio', null, null, null, null, null, null);
  const org = W.add('IFCORGANIZATION', null, 'APK.audio', 'Speaker.Like.audio', null, null);
  const po = W.add('IFCPERSONANDORGANIZATION', person, org, null);
  const app = W.add('IFCAPPLICATION', org, '1', 'Speaker.Like.audio', 'EDITORS.Speaker.Like.audio');
  const oh = W.add('IFCOWNERHISTORY', po, app, null, null, null, null, null, 0);
  const si = (kind, prefix, unit) => W.add('IFCSIUNIT', { kind: 'derived' }, enumv(kind), prefix ? enumv(prefix) : null, enumv(unit));
  const units = W.add('IFCUNITASSIGNMENT', [si('LENGTHUNIT', 'MILLI', 'METRE'), si('POWERUNIT', null, 'WATT'),
    si('FREQUENCYUNIT', null, 'HERTZ'), si('ELECTRICRESISTANCEUNIT', null, 'OHM')]);
  const axis = W.add('IFCAXIS2PLACEMENT3D', W.add('IFCCARTESIANPOINT', [real(0), real(0), real(0)]), null, null);
  const ctx = W.add('IFCGEOMETRICREPRESENTATIONCONTEXT', null, 'Model', 3, real(1e-5), axis, null);
  const body = W.add('IFCGEOMETRICREPRESENTATIONSUBCONTEXT', 'Body', 'Model', { kind: 'derived' }, { kind: 'derived' }, { kind: 'derived' }, { kind: 'derived' }, ctx, null, enumv('MODEL_VIEW'), null);
  const project = W.add('IFCPROJECT', ifcGuid('speaker', key, 'project'), oh, 'Speaker.Like.audio', 'One loudspeaker, as an IFC type', null, null, null, [ctx], units);
  const library = W.add('IFCPROJECTLIBRARY', ifcGuid('speaker', key, 'library'), oh, `${maker} ${model}`, `Speaker.Like.audio box ${key}`, null, null, null, null, null);
  W.add('IFCRELDECLARES', ifcGuid('rel', 'declares', P, 'project'), oh, null, null, project, [library]);

  // the conversion-based units a part file does not assign (apk_psets_acoustic.py PROPERTY_UNITS), once each
  const conv = new Map();
  const unitOf = (unitName) => {
    if (conv.has(unitName)) return conv.get(unitName);
    const deg = unitName === 'degree';
    const dims = W.add('IFCDIMENSIONALEXPONENTS', deg ? 0 : 3, 0, 0, 0, 0, 0, 0);
    const base = si(deg ? 'PLANEANGLEUNIT' : 'VOLUMEUNIT', null, deg ? 'RADIAN' : 'CUBIC_METRE');
    const factor = W.add('IFCMEASUREWITHUNIT', deg ? m('IFCPLANEANGLEMEASURE', DEGREE_IN_RADIAN) : m('IFCVOLUMEMEASURE', 0.001), base);
    const u = W.add('IFCCONVERSIONBASEDUNIT', dims, enumv(deg ? 'PLANEANGLEUNIT' : 'VOLUMEUNIT'), unitName, factor);
    conv.set(unitName, u);
    return u;
  };

  const sets = [];
  const one = (n, v, unit = null) => (v == null ? null : W.add('IFCPROPERTYSINGLEVALUE', n, null, v, unit));
  const list = (n, vs) => (vs.length ? W.add('IFCPROPERTYLISTVALUE', n, null, vs, null) : null);
  const table = (n, measure, pick) => {
    const rows = drivers.map((d) => [str(d.id), pick(d)]).filter(([id, v]) => id && v != null);
    return rows.length ? W.add('IFCPROPERTYTABLEVALUE', n, null, rows.map(([id]) => ident(id)), rows.map(([, v]) => m(measure, v)), null, null, null, null) : null;
  };
  const pset = (setName, props) => {
    const items = props.filter(Boolean);
    if (items.length) sets.push(W.add('IFCPROPERTYSET', ifcGuid('rel', 'pset', P, setName), oh, setName, null, items));
  };

  pset('Pset_ManufacturerTypeInformation', [one('Manufacturer', label(maker)), one('ModelReference', label(model)), one('ModelLabel', label(`${maker} ${model}`))]);
  pset('Pset_AudioVisualApplianceTypeSpeaker', [W.add('IFCPROPERTYENUMERATEDVALUE', 'SpeakerType', null, [label(speakerTypeOf(s))], null)]);
  const sens = num(specs.sensitivity);
  const hCov = pos(dir.hCov);
  const vCov = pos(dir.vCov);
  const litres = pos(cab.volumeLitres);
  const words = driverWords(s);
  pset('APK_LoudspeakerType', [
    sens != null ? one('Sensitivity', m('IFCSOUNDPRESSURELEVELMEASURE', sens)) : null,
    num(specs.maxSpl) != null ? one('MaxSpl', m('IFCSOUNDPRESSURELEVELMEASURE', num(specs.maxSpl))) : null,
    pos(specs.watts) != null ? one('PowerHandling', m('IFCPOWERMEASURE', pos(specs.watts))) : null,
    pos(specs.nominalImpedance) != null ? one('NominalImpedance', m('IFCELECTRICRESISTANCEMEASURE', pos(specs.nominalImpedance))) : null,
    pos(specs.fLow) != null ? one('FrequencyLow', m('IFCFREQUENCYMEASURE', pos(specs.fLow))) : null,
    pos(specs.fHigh) != null ? one('FrequencyHigh', m('IFCFREQUENCYMEASURE', pos(specs.fHigh))) : null,
    crossovers.length ? one('CrossoverFrequency', m('IFCFREQUENCYMEASURE', pos(crossovers[0].f))) : null,
    pos(dir.omniBelow) != null ? one('OmniBelow', m('IFCFREQUENCYMEASURE', pos(dir.omniBelow))) : null,
    hCov != null ? one('CoverageHorizontal', m('IFCPLANEANGLEMEASURE', hCov), unitOf('degree')) : null,
    vCov != null ? one('CoverageVertical', m('IFCPLANEANGLEMEASURE', vCov), unitOf('degree')) : null,
    dir.pattern ? one('Pattern', label(dir.pattern)) : null,
    words ? one('Driver', label(words)) : null,
    litres != null ? one('EnclosureVolume', m('IFCVOLUMEMEASURE', litres), unitOf('litre')) : null,
    cab.type ? one('EnclosureType', label(cab.type)) : null,
  ]);
  const placed = drivers.filter((d) => str(d.id));
  pset('APK_SpeakerBuild', [
    s.kind ? one('Kind', label(s.kind)) : null,
    s.id ? one('TemplateId', ident(s.id)) : null,
    pos(cab.wallThickness) != null ? one('WallThickness', m('IFCPOSITIVELENGTHMEASURE', pos(cab.wallThickness))) : null,
    cab.baffleColor ? one('BaffleColour', label(cab.baffleColor)) : null,
    list('DriverIds', placed.map((d) => ident(d.id))),
    list('DriverRoles', placed.map((d) => label(d.role || ''))),
    list('DriverNames', placed.map((d) => label(d.name || ''))),
    list('DriverX', placed.map((d) => m('IFCLENGTHMEASURE', num(d.x) ?? 0))),
    list('DriverY', placed.map((d) => m('IFCLENGTHMEASURE', num(d.y) ?? 0))),
    table('DriverDiameter', 'IFCPOSITIVELENGTHMEASURE', (d) => pos(d.diameter)),
    table('DriverMouthWidth', 'IFCPOSITIVELENGTHMEASURE', (d) => pos(d.mouthWidth)),
    table('DriverMouthHeight', 'IFCPOSITIVELENGTHMEASURE', (d) => pos(d.mouthHeight)),
    table('DriverFrequencyLow', 'IFCFREQUENCYMEASURE', (d) => pos(d.fLow)),
    table('DriverFrequencyHigh', 'IFCFREQUENCYMEASURE', (d) => pos(d.fHigh)),
    table('DriverSensitivity', 'IFCSOUNDPRESSURELEVELMEASURE', (d) => num(d.sensitivity)),
    table('DriverPowerHandling', 'IFCPOWERMEASURE', (d) => pos(d.watts)),
    table('DriverImpedance', 'IFCELECTRICRESISTANCEMEASURE', (d) => pos(d.impedance)),
    list('CrossoverFrequencies', crossovers.map((x) => m('IFCFREQUENCYMEASURE', pos(x.f)))),
    crossovers.every((x) => num(x.slope) != null) ? list('CrossoverSlopes', crossovers.map((x) => typed('IFCREAL', real(num(x.slope))))) : null,
    crossovers.every((x) => x.type) ? list('CrossoverTypes', crossovers.map((x) => label(x.type))) : null,
  ]);

  // ---- the Body box (w x d x h, mm), as a BIM part draws it
  let maps = null;
  const w = pos(cab.w), h = pos(cab.h), d = pos(cab.d);
  if (w != null && h != null && d != null) {
    const a2 = W.add('IFCAXIS2PLACEMENT2D', W.add('IFCCARTESIANPOINT', [real(w / 2), real(d / 2)]), null);
    const prof = W.add('IFCRECTANGLEPROFILEDEF', enumv('AREA'), 'Envelope', a2, real(w), real(d));
    const solid = W.add('IFCEXTRUDEDAREASOLID', prof, axis, W.add('IFCDIRECTION', [real(0), real(0), real(1)]), real(h));
    const shape = W.add('IFCSHAPEREPRESENTATION', body, 'Body', 'SweptSolid', [solid]);
    maps = [W.add('IFCREPRESENTATIONMAP', axis, shape)];
  }
  const type = W.add('IFCAUDIOVISUALAPPLIANCETYPE', P, oh, `${maker} ${model}`, null, null, sets.length ? sets : null, maps, key, null, enumv('SPEAKER'));
  W.add('IFCRELDECLARES', ifcGuid('rel', 'declares', P, 'library'), oh, null, null, library, [type]);

  return writeStep({
    header: [
      { type: 'FILE_DESCRIPTION', args: [['ViewDefinition [ReferenceView]'], '2;1'] },
      { type: 'FILE_NAME', args: [`${stem}.ifc`, STAMP, ['APK.audio'], ['APK.audio'], 'Speaker.Like.audio', 'EDITORS.Speaker.Like.audio', ''] },
      { type: 'FILE_SCHEMA', args: [[SPEAKER_IFC_SCHEMA]] },
    ],
    entities: W.entities,
  });
}

/* ───────────────────────── reading it back ───────────────────────── */

const val = (v) => {
  const u = unwrap(v);
  return u && typeof u === 'object' && !Array.isArray(u) && 'value' in u ? u.value : u;
};

/**
 * An IFC model → the speaker. The box is the first IfcAudioVisualApplianceType SPEAKER (a BIM loudspeaker
 * part reads too: what it does not state stays out). Throws a sentence when the file holds none.
 */
export function speakerFromIfc(text) {
  const file = parseStep(String(text));
  const get = (v) => (isRef(v) ? file.byId.get(v.id) : undefined);
  const type = entitiesByType(file, 'IFCAUDIOVISUALAPPLIANCETYPE').find((e) => val(e.args[9]) === 'SPEAKER');
  if (!type) throw new TypeError('no loudspeaker in this IFC: it has no IfcAudioVisualApplianceType SPEAKER');
  const props = {};
  for (const psRef of type.args[5] || []) {
    const ps = get(psRef);
    if (!ps || typeof ps.args[2] !== 'string') continue;
    const into = (props[ps.args[2]] ||= {});
    for (const pr of ps.args[4] || []) {
      const p = get(pr);
      if (p && typeof p.args[0] === 'string') into[p.args[0]] = p;
    }
  }
  const single = (set, n) => { const p = props[set]?.[n]; return p ? val(p.args[2]) : null; };
  const listOf = (set, n) => { const p = props[set]?.[n]; return p && Array.isArray(p.args[2]) ? p.args[2].map(val) : []; };
  const tableOf = (set, n) => {
    const p = props[set]?.[n];
    const out = new Map();
    if (p && p.type === 'IFCPROPERTYTABLEVALUE') (p.args[2] || []).forEach((k, i) => out.set(String(val(k)), val((p.args[3] || [])[i])));
    return out;
  };
  const LT = 'APK_LoudspeakerType';
  const SB = 'APK_SpeakerBuild';
  const maker = str(single('Pset_ManufacturerTypeInformation', 'Manufacturer'));
  const model = str(single('Pset_ManufacturerTypeInformation', 'ModelReference')) || str(type.args[2]);

  // the Body box: profile XDim x YDim, extruded Depth
  const cabinet = {};
  const rmap = get((type.args[6] || [])[0]);
  const shape = rmap && get(rmap.args[1]);
  const solid = shape && get((shape.args[3] || [])[0]);
  const prof = solid && get(solid.args[0]);
  if (prof && prof.type === 'IFCRECTANGLEPROFILEDEF') {
    cabinet.w = val(prof.args[3]);
    cabinet.h = val(solid.args[3]);
    cabinet.d = val(prof.args[4]);
  }
  const put = (o, k, v) => { if (v != null && v !== '') o[k] = v; };
  put(cabinet, 'wallThickness', single(SB, 'WallThickness'));
  put(cabinet, 'type', single(LT, 'EnclosureType'));
  put(cabinet, 'volumeLitres', single(LT, 'EnclosureVolume'));
  put(cabinet, 'baffleColor', single(SB, 'BaffleColour'));

  const ids = listOf(SB, 'DriverIds').map(String);
  const roles = listOf(SB, 'DriverRoles');
  const names = listOf(SB, 'DriverNames');
  const xs = listOf(SB, 'DriverX');
  const ys = listOf(SB, 'DriverY');
  const t = Object.fromEntries(['DriverDiameter', 'DriverMouthWidth', 'DriverMouthHeight', 'DriverFrequencyLow', 'DriverFrequencyHigh',
    'DriverSensitivity', 'DriverPowerHandling', 'DriverImpedance'].map((n) => [n, tableOf(SB, n)]));
  const drivers = ids.map((id, i) => {
    const d = { id, role: str(roles[i]), name: str(names[i]), x: num(xs[i]) ?? 0, y: num(ys[i]) ?? 0 };
    put(d, 'diameter', t.DriverDiameter.get(id));
    put(d, 'mouthWidth', t.DriverMouthWidth.get(id));
    put(d, 'mouthHeight', t.DriverMouthHeight.get(id));
    put(d, 'fLow', t.DriverFrequencyLow.get(id));
    put(d, 'fHigh', t.DriverFrequencyHigh.get(id));
    put(d, 'sensitivity', t.DriverSensitivity.get(id));
    put(d, 'watts', t.DriverPowerHandling.get(id));
    put(d, 'impedance', t.DriverImpedance.get(id));
    return d;
  });
  const fs = listOf(SB, 'CrossoverFrequencies');
  const slopes = listOf(SB, 'CrossoverSlopes');
  const kinds = listOf(SB, 'CrossoverTypes');
  const crossovers = fs.length ? fs.map((f, i) => {
    const x = { f };
    put(x, 'slope', slopes[i]);
    put(x, 'type', kinds[i]);
    return x;
  }) : (single(LT, 'CrossoverFrequency') != null ? [{ f: single(LT, 'CrossoverFrequency') }] : []);
  const specs = {};
  put(specs, 'sensitivity', single(LT, 'Sensitivity'));
  put(specs, 'watts', single(LT, 'PowerHandling'));
  put(specs, 'maxSpl', single(LT, 'MaxSpl'));
  put(specs, 'fLow', single(LT, 'FrequencyLow'));
  put(specs, 'fHigh', single(LT, 'FrequencyHigh'));
  put(specs, 'nominalImpedance', single(LT, 'NominalImpedance'));
  const directivity = {};
  put(directivity, 'pattern', single(LT, 'Pattern'));
  put(directivity, 'hCov', single(LT, 'CoverageHorizontal'));
  put(directivity, 'vCov', single(LT, 'CoverageVertical'));
  put(directivity, 'omniBelow', single(LT, 'OmniBelow'));
  const speaker = { id: str(single(SB, 'TemplateId')) || str(type.args[7]), name: model, maker };
  put(speaker, 'kind', single(SB, 'Kind'));
  return { ...speaker, cabinet, drivers, crossovers, specs, directivity };
}
