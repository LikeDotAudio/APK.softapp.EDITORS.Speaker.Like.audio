// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import {
  createDefaultSpeaker,
  exportToAcousticPreset,
  importSpeakerJson,
  SPEAKER_TEMPLATES,
} from './model/speaker.js';
import { speakerToIfc, speakerFromIfc, speakerStem } from './model/speakerIfc.js';
import { createBaffleCanvas } from './ui/baffleCanvas.js';
import { createDatasheetPanel } from './ui/datasheetPanel.js';
import { createVisualizer } from './ui/visualizer.js';

const S = window.APKSoftapp;   // vendor/apk-softapp: help panel and problem cards (absent: the editor still works)
if (S) S.describe({
  name: 'Speaker.Like.audio',
  does: 'Builds a loudspeaker: cabinet, drivers placed on the baffle (mm), and its datasheet; hands the result to Acoustic.Like.audio as a preset.',
  inputs: [
    { name: 'Template', from: 'the built-in reference loudspeakers in the Template list', kind: 'control' },
    { name: 'Speaker file', from: 'a .speaker.json or its .speaker.ifc twin (or any IFC with a loudspeaker type, e.g. a BIM part) picked with Open File', kind: 'file' },
  ],
  outputs: [
    { name: 'Speaker file', to: '<name>.speaker.json AND its <name>.speaker.ifc twin (Save File, Save Model): the box as an IFC4X3_ADD2 IfcAudioVisualApplianceType SPEAKER, shaped like a BIM loudspeaker part', kind: 'file' },
    { name: 'Acoustic preset', to: 'the clipboard (Copy Preset), to paste into Acoustic.Like.audio', kind: 'clipboard' },
  ],
  controls: [
    { name: 'Template', how: 'Pick one in the Template list (replaces the current speaker)' },
    { name: 'Place a driver', how: 'Drag it on the baffle (snaps to the centre line within 5 mm); click to select, click empty baffle to deselect' },
    { name: 'Cabinet / Components / Datasheet', how: 'Tabs in the right-hand panel: edit cabinet size, add / remove / edit components, fill the datasheet' },
    { name: 'Save File / Open File / Copy Preset', how: 'Top-bar buttons' },
  ],
  problems: ['file_unreadable', 'bad_json', 'bad_input', 'permission_denied', 'save_failed'],
});

let speaker = createDefaultSpeaker('nearfield2way');
let selectedDriverId = null;

const toast = document.getElementById('toast');
function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2400);
  // The notice's twin on the bus, for UTILITY.Log (ROAD-3695); a problem goes through S.showProblem.
  if (S && typeof S.log === 'function') S.log('info', msg);
}

// 1. Initialize Baffle CAD Canvas
const baffleMount = document.getElementById('baffle-mount');
const baffleCanvas = createBaffleCanvas({
  container: baffleMount,
  onSelectDriver: (id) => {
    selectedDriverId = id;
    renderAll();
  },
  onMoveDriver: (id, x, y) => {
    const d = speaker.drivers.find((item) => item.id === id);
    if (d) {
      d.x = x;
      d.y = y;
      renderAll();
    }
  },
});

// 2. Initialize Datasheet Panel
const inspectorMount = document.getElementById('inspector-mount');
const datasheetPanel = createDatasheetPanel({
  container: inspectorMount,
  onUpdateSpeaker: (updated) => {
    speaker = updated;
    renderAll();
  },
  onSelectDriver: (id) => {
    selectedDriverId = id;
    renderAll();
  },
});

// 3. Initialize Visualizer
const visualizerMount = document.getElementById('visualizer-mount');
const visualizer = createVisualizer({
  container: visualizerMount,
});

function renderAll() {
  baffleCanvas.render(speaker, selectedDriverId);
  datasheetPanel.render(speaker, selectedDriverId);
  visualizer.render(speaker);
}

// Initial render
renderAll();

// Template selector
const templateSelect = document.getElementById('template-select');
if (templateSelect) {
  templateSelect.addEventListener('change', (e) => {
    const key = e.target.value;
    if (SPEAKER_TEMPLATES[key]) {
      speaker = createDefaultSpeaker(key);
      selectedDriverId = null;
      renderAll();
      showToast(`Loaded ${speaker.name}`);
    }
  });
}

// Save File: the .speaker.json AND its .speaker.ifc twin, both or neither (APKSoftapp.saveModel)
const exportBtn = document.getElementById('export-json-btn');
async function saveSpeaker() {
  const stem = `${speakerStem(speaker)}.speaker`;
  if (!S || typeof S.saveModel !== 'function') {   // no shared client: the .json alone, as before
    const a = document.createElement('a');
    a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(speaker, null, 2));
    a.download = `${stem}.json`;
    a.click();
    showToast('Downloaded .speaker.json file');
    return;
  }
  const r = await S.saveModel(speaker, { name: stem, toIfc: (spk) => speakerToIfc(spk, { name: stem }) });
  if (r.ok) showToast(`Saved ${r.files.join(' + ')}`);
  else if (!r.cancelled) S.showProblem(r.problem || 'save_failed', { onRetry: saveSpeaker });
}
if (exportBtn) exportBtn.addEventListener('click', () => { saveSpeaker(); });

// Open File: a .speaker.json or an .ifc (its twin, or any IFC with a loudspeaker type)
const importFile = document.getElementById('import-json-file');
function loaded(next, name) {
  speaker = next;
  selectedDriverId = null;
  renderAll();
  showToast(`Imported ${speaker.name}${name ? ` (${name})` : ''}`);
}
if (importFile) {
  importFile.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const again = () => importFile.click();
    if (S && typeof S.openModel === 'function') {
      const r = await S.openModel({ file, fromIfc: (text) => speakerFromIfc(text), fromJson: (data) => importSpeakerJson(data) });
      if (r.ok) loaded(r.model, r.name);
      else if (!r.cancelled) S.showProblem(r.problem, {
        fix: ['Open a .speaker.json or .speaker.ifc written by Save File: the .json has a "cabinet" and a "drivers" list, the .ifc an IfcAudioVisualApplianceType SPEAKER.'],
        onRetry: again,
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      let next;
      try {
        next = importSpeakerJson(evt.target.result);
      } catch (err) {
        alert('Could not parse speaker file: ' + err.message);
        return;
      }
      loaded(next, file.name);
    };
    reader.readAsText(file);
  });
}

// Copy Acoustic.Like.audio preset definition
const copyPresetBtn = document.getElementById('copy-acoustic-btn');
if (copyPresetBtn) {
  copyPresetBtn.addEventListener('click', async () => {
    const preset = exportToAcousticPreset(speaker);
    const code = JSON.stringify(preset, null, 2);
    try {
      await navigator.clipboard.writeText(code);
      showToast('Copied Acoustic preset to clipboard!');
    } catch (err) {
      console.log('Preset JSON:', code);
      showToast('Preset logged to console');
      if (S) S.showProblem('permission_denied', {
        subject: 'Clipboard',
        detail: err && err.message,
        fix: ['Click Copy Preset again: the browser only lets a page write the clipboard right after a click on it.',
          'Or take the preset from the browser console (F12 → Console), where it was printed as "Preset JSON".'],
        onRetry: () => copyPresetBtn.click(),
      });
    }
  });
}
