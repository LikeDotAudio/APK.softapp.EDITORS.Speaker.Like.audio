// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import {
  createDefaultSpeaker,
  exportToAcousticPreset,
  importSpeakerJson,
  SPEAKER_TEMPLATES,
} from './model/speaker.js';
import { createBaffleCanvas } from './ui/baffleCanvas.js';
import { createDatasheetPanel } from './ui/datasheetPanel.js';
import { createVisualizer } from './ui/visualizer.js';

let speaker = createDefaultSpeaker('nearfield2way');
let selectedDriverId = null;

const toast = document.getElementById('toast');
function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2400);
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

// Export JSON file
const exportBtn = document.getElementById('export-json-btn');
if (exportBtn) {
  exportBtn.addEventListener('click', () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(speaker, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    const safeName = (speaker.name || 'speaker').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    a.download = `${safeName}.speaker.json`;
    a.click();
    showToast('Downloaded .speaker.json file');
  });
}

// Import JSON file
const importFile = document.getElementById('import-json-file');
if (importFile) {
  importFile.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const loaded = importSpeakerJson(evt.target.result);
        speaker = loaded;
        selectedDriverId = null;
        renderAll();
        showToast(`Imported ${speaker.name}`);
      } catch (err) {
        alert('Could not parse speaker file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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
    } catch (_) {
      console.log('Preset JSON:', code);
      showToast('Preset logged to console');
    }
  });
}
