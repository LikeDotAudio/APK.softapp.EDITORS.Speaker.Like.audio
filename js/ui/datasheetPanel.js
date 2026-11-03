// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import { DRIVER_ROLES, computeVolumeLitres, computeBaffleStepHz, computeMaxSpl } from '../model/speaker.js';

/**
 * Datasheet & Parameter Inspector Panel
 */
export function createDatasheetPanel({ container, onUpdateSpeaker, onSelectDriver }) {
  const root = document.createElement('div');
  root.className = 'datasheet-panel-root';
  container.appendChild(root);

  let activeTab = 'cabinet';
  let currentSpeaker = null;
  let selectedDriverId = null;

  function render(speaker, selectedId = null) {
    currentSpeaker = speaker;
    selectedDriverId = selectedId;
    root.innerHTML = '';

    // Tab Navigation
    const tabs = document.createElement('div');
    tabs.className = 'ds-tabs';
    tabs.innerHTML = `
      <button class="ds-tab ${activeTab === 'cabinet' ? 'active' : ''}" data-tab="cabinet">📦 Cabinet</button>
      <button class="ds-tab ${activeTab === 'components' ? 'active' : ''}" data-tab="components">🎛 Components (${speaker.drivers.length})</button>
      <button class="ds-tab ${activeTab === 'specs' ? 'active' : ''}" data-tab="specs">📋 Datasheet</button>
    `;
    tabs.querySelectorAll('.ds-tab').forEach((b) => {
      b.onclick = () => {
        activeTab = b.dataset.tab;
        render(currentSpeaker, selectedDriverId);
      };
    });
    root.appendChild(tabs);

    const body = document.createElement('div');
    body.className = 'ds-body';

    if (activeTab === 'cabinet') renderCabinetTab(body, speaker);
    else if (activeTab === 'components') renderComponentsTab(body, speaker);
    else if (activeTab === 'specs') renderSpecsTab(body, speaker);

    root.appendChild(body);
  }

  function renderCabinetTab(body, speaker) {
    const cab = speaker.cabinet;
    const vol = computeVolumeLitres(cab);
    const baffleStep = computeBaffleStepHz(cab.w);

    body.innerHTML = `
      <div class="ds-section">
        <div class="ds-section-title">Enclosure Geometry (mm)</div>
        <div class="ds-row">
          <label>Width (W)
            <input type="number" id="cab-w" value="${cab.w}" min="100" max="2000" step="10">
          </label>
          <label>Height (H)
            <input type="number" id="cab-h" value="${cab.h}" min="100" max="3000" step="10">
          </label>
        </div>
        <div class="ds-row">
          <label>Depth (D)
            <input type="number" id="cab-d" value="${cab.d}" min="100" max="2000" step="10">
          </label>
          <label>Wall Thickness
            <input type="number" id="cab-t" value="${cab.wallThickness || 19}" min="6" max="60" step="1">
          </label>
        </div>
      </div>

      <div class="ds-section">
        <div class="ds-section-title">Acoustic Properties</div>
        <div class="ds-row">
          <label>Enclosure Type
            <select id="cab-type">
              <option value="ported" ${cab.type === 'ported' ? 'selected' : ''}>Bass Reflex (Ported)</option>
              <option value="sealed" ${cab.type === 'sealed' ? 'selected' : ''}>Acoustic Suspension (Sealed)</option>
              <option value="passive-radiator" ${cab.type === 'passive-radiator' ? 'selected' : ''}>Passive Radiator</option>
              <option value="open-baffle" ${cab.type === 'open-baffle' ? 'selected' : ''}>Open Baffle / Dipole</option>
            </select>
          </label>
          <label>Baffle Finish
            <input type="color" id="cab-color" value="${cab.baffleColor || '#1c1c1f'}">
          </label>
        </div>
        <div class="ds-stats-callout">
          <div class="stat-item"><span class="label">Net Internal Volume</span><span class="val highlight">${vol} Litres</span></div>
          <div class="stat-item"><span class="label">Baffle Step Wrap (4π → 2π)</span><span class="val">${baffleStep} Hz</span></div>
        </div>
      </div>
    `;

    const triggerUpdate = () => {
      cab.w = parseInt(body.querySelector('#cab-w').value, 10) || 240;
      cab.h = parseInt(body.querySelector('#cab-h').value, 10) || 380;
      cab.d = parseInt(body.querySelector('#cab-d').value, 10) || 280;
      cab.wallThickness = parseInt(body.querySelector('#cab-t').value, 10) || 19;
      cab.type = body.querySelector('#cab-type').value;
      cab.baffleColor = body.querySelector('#cab-color').value;
      cab.volumeLitres = computeVolumeLitres(cab);
      speaker.directivity.omniBelow = computeBaffleStepHz(cab.w);
      onUpdateSpeaker(speaker);
    };

    body.querySelectorAll('input, select').forEach((el) => {
      el.addEventListener('input', triggerUpdate);
    });
  }

  function renderComponentsTab(body, speaker) {
    const drivers = speaker.drivers;
    const selected = drivers.find((d) => d.id === selectedDriverId) || drivers[0];

    const listContainer = document.createElement('div');
    listContainer.className = 'ds-driver-list';

    drivers.forEach((d) => {
      const item = document.createElement('div');
      item.className = `ds-driver-card ${d.id === selected?.id ? 'selected' : ''}`;
      const roleCfg = DRIVER_ROLES[d.role] || DRIVER_ROLES.woofer;

      item.innerHTML = `
        <div class="driver-dot" style="background:${roleCfg.color}"></div>
        <div class="driver-info">
          <div class="driver-name">${d.name || roleCfg.name}</div>
          <div class="driver-sub">${d.role.toUpperCase()} · ⌀${d.diameter || d.mouthWidth || 100} mm · (${d.x}, ${d.y} mm)</div>
        </div>
        <button class="driver-del-btn" title="Remove component">✕</button>
      `;

      item.onclick = (e) => {
        if (e.target.classList.contains('driver-del-btn')) {
          e.stopPropagation();
          speaker.drivers = speaker.drivers.filter((x) => x.id !== d.id);
          onSelectDriver(null);
          onUpdateSpeaker(speaker);
          return;
        }
        onSelectDriver(d.id);
      };

      listContainer.appendChild(item);
    });

    const addBar = document.createElement('div');
    addBar.className = 'ds-add-driver-bar';
    addBar.innerHTML = `
      <select id="new-driver-role">
        <option value="woofer">＋ Woofer</option>
        <option value="mid">＋ Midrange</option>
        <option value="tweeter">＋ Tweeter</option>
        <option value="horn">＋ Horn</option>
        <option value="coax">＋ Coaxial</option>
        <option value="port">＋ Reflex Port</option>
      </select>
      <button id="add-driver-btn" class="primary-btn">Add Component</button>
    `;
    addBar.querySelector('#add-driver-btn').onclick = () => {
      const role = addBar.querySelector('#new-driver-role').value;
      const roleCfg = DRIVER_ROLES[role];
      const newId = `d-${Date.now().toString(36)}`;
      const newDriver = {
        id: newId,
        role,
        name: `${roleCfg.name}`,
        x: 0,
        y: Math.round(speaker.cabinet.h * 0.5),
        diameter: roleCfg.defaultDia || 100,
        fLow: role === 'tweeter' ? 2500 : 40,
        fHigh: role === 'woofer' ? 2500 : 20000,
        sensitivity: role === 'horn' ? 104 : 89,
        watts: 100,
        impedance: 8,
      };
      if (role === 'horn') {
        newDriver.mouthWidth = roleCfg.defaultW || 180;
        newDriver.mouthHeight = roleCfg.defaultH || 90;
      }
      speaker.drivers.push(newDriver);
      onSelectDriver(newId);
      onUpdateSpeaker(speaker);
    };

    body.appendChild(listContainer);
    body.appendChild(addBar);

    // Inspector for selected driver
    if (selected) {
      const editBox = document.createElement('div');
      editBox.className = 'ds-section driver-editor';
      editBox.innerHTML = `
        <div class="ds-section-title">Edit Selected: ${selected.name}</div>
        <div class="ds-row">
          <label>Label
            <input type="text" id="ed-name" value="${selected.name || ''}">
          </label>
          <label>Diameter / Mouth (mm)
            <input type="number" id="ed-dia" value="${selected.diameter || selected.mouthWidth || 100}" min="10" max="600" step="5">
          </label>
        </div>
        <div class="ds-row">
          <label>X Position (mm off center)
            <input type="number" id="ed-x" value="${selected.x}" min="${-speaker.cabinet.w / 2}" max="${speaker.cabinet.w / 2}" step="1">
          </label>
          <label>Y Position (mm from bottom)
            <input type="number" id="ed-y" value="${selected.y}" min="0" max="${speaker.cabinet.h}" step="1">
          </label>
        </div>
        <div class="ds-row">
          <label>Freq Low (Hz)
            <input type="number" id="ed-flow" value="${selected.fLow || 20}" min="10" max="20000" step="10">
          </label>
          <label>Freq High (Hz)
            <input type="number" id="ed-fhigh" value="${selected.fHigh || 20000}" min="50" max="40000" step="50">
          </label>
        </div>
        <div class="ds-row">
          <label>Sensitivity (dB @ 1W/1m)
            <input type="number" id="ed-sens" value="${selected.sensitivity || 89}" min="70" max="120" step="0.5">
          </label>
          <label>Power Handling (Watts)
            <input type="number" id="ed-watts" value="${selected.watts || 100}" min="1" max="5000" step="10">
          </label>
        </div>
      `;

      const onDriverPropChange = () => {
        selected.name = editBox.querySelector('#ed-name').value;
        const dia = parseInt(editBox.querySelector('#ed-dia').value, 10) || 100;
        selected.diameter = dia;
        if (selected.role === 'horn') selected.mouthWidth = dia;
        selected.x = parseInt(editBox.querySelector('#ed-x').value, 10) || 0;
        selected.y = parseInt(editBox.querySelector('#ed-y').value, 10) || 0;
        selected.fLow = parseInt(editBox.querySelector('#ed-flow').value, 10) || 20;
        selected.fHigh = parseInt(editBox.querySelector('#ed-fhigh').value, 10) || 20000;
        selected.sensitivity = parseFloat(editBox.querySelector('#ed-sens').value) || 89;
        selected.watts = parseInt(editBox.querySelector('#ed-watts').value, 10) || 100;
        onUpdateSpeaker(speaker);
      };

      editBox.querySelectorAll('input').forEach((el) => el.addEventListener('input', onDriverPropChange));
      body.appendChild(editBox);
    }
  }

  function renderSpecsTab(body, speaker) {
    const sp = speaker.specs;
    const dir = speaker.directivity;
    const maxSpl = computeMaxSpl(sp.sensitivity, sp.watts);

    body.innerHTML = `
      <div class="ds-section">
        <div class="ds-section-title">System Identification</div>
        <div class="ds-row">
          <label>Manufacturer / Brand
            <input type="text" id="sp-maker" value="${speaker.maker || ''}">
          </label>
          <label>Model Name
            <input type="text" id="sp-name" value="${speaker.name || ''}">
          </label>
        </div>
        <div class="ds-row">
          <label>Loudspeaker Class
            <select id="sp-kind">
              <option value="monitor" ${speaker.kind === 'monitor' ? 'selected' : ''}>Studio Monitor</option>
              <option value="main" ${speaker.kind === 'main' ? 'selected' : ''}>Main Stage / PA</option>
              <option value="sub" ${speaker.kind === 'sub' ? 'selected' : ''}>Subwoofer</option>
              <option value="surround" ${speaker.kind === 'surround' ? 'selected' : ''}>Surround / Immersive</option>
            </select>
          </label>
          <label>Nominal Impedance (Ω)
            <input type="number" id="sp-imp" value="${sp.nominalImpedance || 8}" min="2" max="32" step="2">
          </label>
        </div>
      </div>

      <div class="ds-section">
        <div class="ds-section-title">Sensitivity & Output Power</div>
        <div class="ds-row">
          <label>Sensitivity (dB SPL @ 1W/1m)
            <input type="number" id="sp-sens" value="${sp.sensitivity || 89}" min="70" max="120" step="0.5">
          </label>
          <label>Continuous RMS Power (W)
            <input type="number" id="sp-watts" value="${sp.watts || 100}" min="5" max="10000" step="25">
          </label>
        </div>
        <div class="ds-stats-callout">
          <div class="stat-item"><span class="label">Calculated Max SPL @ 1m</span><span class="val highlight">${maxSpl} dB SPL</span></div>
        </div>
      </div>

      <div class="ds-section">
        <div class="ds-section-title">Directivity & Dispersion</div>
        <div class="ds-row">
          <label>Horizontal Coverage (°)
            <input type="number" id="dir-h" value="${dir.hCov || 90}" min="20" max="360" step="5">
          </label>
          <label>Vertical Coverage (°)
            <input type="number" id="dir-v" value="${dir.vCov || 60}" min="20" max="360" step="5">
          </label>
        </div>
        <div class="ds-row">
          <label>Directivity Pattern
            <select id="dir-pattern">
              <option value="horn" ${dir.pattern === 'horn' ? 'selected' : ''}>Constant Directivity / Horn</option>
              <option value="cardioid" ${dir.pattern === 'cardioid' ? 'selected' : ''}>Cardioid Dispersion</option>
              <option value="omni" ${dir.pattern === 'omni' ? 'selected' : ''}>Omnidirectional</option>
            </select>
          </label>
        </div>
      </div>
    `;

    const onSpecChange = () => {
      speaker.maker = body.querySelector('#sp-maker').value;
      speaker.name = body.querySelector('#sp-name').value;
      speaker.kind = body.querySelector('#sp-kind').value;
      sp.nominalImpedance = parseInt(body.querySelector('#sp-imp').value, 10) || 8;
      sp.sensitivity = parseFloat(body.querySelector('#sp-sens').value) || 89;
      sp.watts = parseInt(body.querySelector('#sp-watts').value, 10) || 100;
      sp.maxSpl = computeMaxSpl(sp.sensitivity, sp.watts);
      dir.hCov = parseInt(body.querySelector('#dir-h').value, 10) || 90;
      dir.vCov = parseInt(body.querySelector('#dir-v').value, 10) || 60;
      dir.pattern = body.querySelector('#dir-pattern').value;
      onUpdateSpeaker(speaker);
    };

    body.querySelectorAll('input, select').forEach((el) => el.addEventListener('input', onSpecChange));
  }

  return {
    render,
  };
}
