// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import { DRIVER_ROLES, validateDriverPlacement } from '../model/speaker.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function createSvgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/**
 * Interactive SVG Front Baffle CAD Canvas
 */
export function createBaffleCanvas({ container, onSelectDriver, onMoveDriver }) {
  const root = document.createElement('div');
  root.className = 'cad-baffle-container';

  const svg = createSvgEl('svg', { class: 'baffle-svg' });
  root.appendChild(svg);
  container.appendChild(root);

  let currentSpeaker = null;
  let selectedDriverId = null;
  let dragState = null;

  function render(speaker, selectedId = null) {
    currentSpeaker = speaker;
    selectedDriverId = selectedId;
    svg.innerHTML = '';

    const { cabinet, drivers } = speaker;
    const W = cabinet.w;
    const H = cabinet.h;
    const t = cabinet.wallThickness || 19;
    const pad = Math.max(W, H) * 0.18 + 40;

    // ViewBox: origin (0, 0) at horizontal center, bottom of baffle
    const viewBoxX = -W / 2 - pad;
    const viewBoxY = -H - pad * 0.5;
    const viewBoxW = W + 2 * pad;
    const viewBoxH = H + pad * 1.6;
    svg.setAttribute('viewBox', `${viewBoxX} ${viewBoxY} ${viewBoxW} ${viewBoxH}`);

    const issues = validateDriverPlacement(cabinet, drivers);
    const issueDriverIds = new Set(issues.map((i) => i.driverId).concat(issues.map((i) => i.otherDriverId).filter(Boolean)));

    // Defs: shadows & patterns
    const defs = createSvgEl('defs');
    defs.innerHTML = `
      <filter id="sel-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#38bdf8" flood-opacity="0.9"/>
      </filter>
      <filter id="err-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#ef4444" flood-opacity="0.95"/>
      </filter>
      <pattern id="grid-dots" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="10" cy="10" r="0.8" fill="#475569" opacity="0.3"/>
      </pattern>
    `;
    svg.appendChild(defs);

    // 1. Grid background
    const bgGrid = createSvgEl('rect', {
      x: viewBoxX,
      y: viewBoxY,
      width: viewBoxW,
      height: viewBoxH,
      fill: 'url(#grid-dots)',
    });
    svg.appendChild(bgGrid);

    // 2. Outer Cabinet Box
    const cabOuter = createSvgEl('rect', {
      x: -W / 2,
      y: -H,
      width: W,
      height: H,
      rx: Math.min(W, H) * 0.03,
      class: 'baffle-cabinet-outer',
      fill: cabinet.baffleColor || '#1c1c1f',
      stroke: '#475569',
      'stroke-width': '2',
    });
    svg.appendChild(cabOuter);

    // 3. Inner Baffle Margin (Wall Thickness Inset)
    const iw = Math.max(0, W - 2 * t);
    const ih = Math.max(0, H - 2 * t);
    const cabInner = createSvgEl('rect', {
      x: -iw / 2,
      y: -H + t,
      width: iw,
      height: ih,
      fill: 'none',
      stroke: '#334155',
      'stroke-width': '1',
      'stroke-dasharray': '4 4',
      opacity: '0.6',
    });
    svg.appendChild(cabInner);

    // 4. Center Guidelines
    const centerLineV = createSvgEl('line', {
      x1: 0,
      y1: -H - 15,
      x2: 0,
      y2: 15,
      stroke: '#38bdf8',
      'stroke-width': '1',
      'stroke-dasharray': '5 3',
      opacity: '0.45',
    });
    svg.appendChild(centerLineV);

    // 5. Render Placed Drivers
    for (const d of drivers) {
      const g = createSvgEl('g', {
        class: `cad-driver ${d.id === selectedDriverId ? 'selected' : ''}`,
        'data-id': d.id,
      });

      const cx = d.x;
      const cy = -d.y;
      const dia = d.diameter || 100;
      const r = dia / 2;
      const roleCfg = DRIVER_ROLES[d.role] || DRIVER_ROLES.woofer;
      const color = roleCfg.color;
      const isErr = issueDriverIds.has(d.id);

      if (d.id === selectedDriverId) {
        g.setAttribute('filter', isErr ? 'url(#err-glow)' : 'url(#sel-glow)');
      } else if (isErr) {
        g.setAttribute('filter', 'url(#err-glow)');
      }

      if (d.role === 'horn') {
        const mw = d.mouthWidth || dia;
        const mh = d.mouthHeight || (dia / 2);
        // Outer horn flare
        const flare = createSvgEl('rect', {
          x: cx - mw / 2,
          y: cy - mh / 2,
          width: mw,
          height: mh,
          rx: Math.min(mw, mh) * 0.15,
          fill: '#0f172a',
          stroke: color,
          'stroke-width': '2.5',
        });
        // Throat
        const throat = createSvgEl('rect', {
          x: cx - mw * 0.18,
          y: cy - mh * 0.18,
          width: mw * 0.36,
          height: mh * 0.36,
          rx: '2',
          fill: color,
          opacity: '0.8',
        });
        g.appendChild(flare);
        g.appendChild(throat);
      } else if (d.role === 'port') {
        // Bass reflex tube
        const portRim = createSvgEl('circle', {
          cx,
          cy,
          r,
          fill: '#090d16',
          stroke: '#94a3b8',
          'stroke-width': '3',
        });
        const portInner = createSvgEl('circle', {
          cx,
          cy,
          r: r * 0.82,
          fill: '#020617',
          stroke: '#475569',
          'stroke-width': '1',
        });
        g.appendChild(portRim);
        g.appendChild(portInner);
      } else if (d.role === 'tweeter') {
        // Faceplate
        const plate = createSvgEl('circle', {
          cx,
          cy,
          r: r * 1.8,
          fill: '#1e293b',
          stroke: '#475569',
          'stroke-width': '1.5',
        });
        // Mounting screws
        for (let a = 0; a < 4; a++) {
          const ang = (a * Math.PI) / 2;
          const sx = cx + r * 1.4 * Math.cos(ang);
          const sy = cy + r * 1.4 * Math.sin(ang);
          g.appendChild(createSvgEl('circle', { cx: sx, cy: sy, r: '2.5', fill: '#0f172a', stroke: '#64748b' }));
        }
        // Dome
        const dome = createSvgEl('circle', {
          cx,
          cy,
          r,
          fill: '#0f172a',
          stroke: color,
          'stroke-width': '2',
        });
        g.appendChild(plate);
        g.appendChild(dome);
      } else if (d.role === 'coax') {
        // Coaxial outer cone + inner horn
        const surround = createSvgEl('circle', { cx, cy, r, fill: '#1e293b', stroke: color, 'stroke-width': '3' });
        const cone = createSvgEl('circle', { cx, cy, r: r * 0.85, fill: '#0f172a', stroke: '#334155', 'stroke-width': '1' });
        const throat = createSvgEl('circle', { cx, cy, r: r * 0.32, fill: '#1e293b', stroke: color, 'stroke-width': '2' });
        const dome = createSvgEl('circle', { cx, cy, r: r * 0.14, fill: color });
        g.appendChild(surround);
        g.appendChild(cone);
        g.appendChild(throat);
        g.appendChild(dome);
      } else {
        // Standard Woofer / Midrange cone
        const surround = createSvgEl('circle', { cx, cy, r, fill: '#1e293b', stroke: color, 'stroke-width': '3' });
        const cone = createSvgEl('circle', { cx, cy, r: r * 0.84, fill: '#090d16', stroke: '#334155', 'stroke-width': '1' });
        const dustcap = createSvgEl('circle', { cx, cy, r: r * 0.28, fill: '#1e293b', stroke: color, 'stroke-width': '1.5' });
        g.appendChild(surround);
        g.appendChild(cone);
        g.appendChild(dustcap);
      }

      // Center crosshair
      const ch1 = createSvgEl('line', { cx: cx, cy: cy - 4, x1: cx, y1: cy - 4, x2: cx, y2: cy + 4, stroke: '#94a3b8', 'stroke-width': '1' });
      const ch2 = createSvgEl('line', { cx: cx - 4, cy: cy, x1: cx - 4, y1: cy, x2: cx + 4, y2: cy, stroke: '#94a3b8', 'stroke-width': '1' });
      g.appendChild(ch1);
      g.appendChild(ch2);

      // Label text
      const txt = createSvgEl('text', {
        x: cx,
        y: cy + ((d.role === 'horn' ? (d.mouthHeight || dia) / 2 : r) + 14),
        'text-anchor': 'middle',
        class: 'driver-label-text',
        fill: '#94a3b8',
      });
      txt.textContent = `${d.name || roleCfg.name} (⌀${dia} mm)`;
      g.appendChild(txt);

      // Drag interaction listeners
      g.addEventListener('pointerdown', (e) => onPointerDown(e, d));
      svg.appendChild(g);
    }

    // 6. Dimension annotations
    renderDimensions(W, H, pad);

    // 7. Collision warning indicator if any
    if (issues.length > 0) {
      const warnBox = createSvgEl('g', { class: 'cad-warning-tag' });
      const rect = createSvgEl('rect', {
        x: -W / 2,
        y: 18,
        width: W,
        height: 28,
        rx: 4,
        fill: '#ef4444',
        opacity: '0.9',
      });
      const txt = createSvgEl('text', {
        x: 0,
        y: 36,
        'text-anchor': 'middle',
        fill: '#ffffff',
        'font-weight': '600',
        'font-size': '12px',
      });
      txt.textContent = `⚠ ${issues.length} placement warning(s): ${issues[0].message}`;
      warnBox.appendChild(rect);
      warnBox.appendChild(txt);
      svg.appendChild(warnBox);
    }
  }

  function renderDimensions(W, H, pad) {
    // Width dimension line (bottom)
    const dimY = 12;
    const wLine = createSvgEl('line', { x1: -W / 2, y1: dimY, x2: W / 2, y2: dimY, stroke: '#64748b', 'stroke-width': '1' });
    const wTick1 = createSvgEl('line', { x1: -W / 2, y1: dimY - 4, x2: -W / 2, y2: dimY + 4, stroke: '#64748b', 'stroke-width': '1' });
    const wTick2 = createSvgEl('line', { x1: W / 2, y1: dimY - 4, x2: W / 2, y2: dimY + 4, stroke: '#64748b', 'stroke-width': '1' });
    const wText = createSvgEl('text', { x: 0, y: dimY + 14, 'text-anchor': 'middle', fill: '#cbd5e1', 'font-size': '11px', 'font-family': 'ui-monospace, monospace' });
    wText.textContent = `${W} mm`;
    svg.append(wLine, wTick1, wTick2, wText);

    // Height dimension line (right side)
    const dimX = W / 2 + 14;
    const hLine = createSvgEl('line', { x1: dimX, y1: 0, x2: dimX, y2: -H, stroke: '#64748b', 'stroke-width': '1' });
    const hTick1 = createSvgEl('line', { x1: dimX - 4, y1: 0, x2: dimX + 4, y2: 0, stroke: '#64748b', 'stroke-width': '1' });
    const hTick2 = createSvgEl('line', { x1: dimX - 4, y1: -H, x2: dimX + 4, y2: -H, stroke: '#64748b', 'stroke-width': '1' });
    const hText = createSvgEl('text', {
      x: dimX + 16,
      y: -H / 2,
      'text-anchor': 'middle',
      fill: '#cbd5e1',
      'font-size': '11px',
      'font-family': 'ui-monospace, monospace',
      transform: `rotate(90 ${dimX + 16} ${-H / 2})`,
    });
    hText.textContent = `${H} mm`;
    svg.append(hLine, hTick1, hTick2, hText);
  }

  function getSvgPoint(e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  function onPointerDown(e, driver) {
    e.stopPropagation();
    onSelectDriver(driver.id);
    const startPt = getSvgPoint(e);
    dragState = {
      driverId: driver.id,
      startX: driver.x,
      startY: driver.y,
      pointerStartX: startPt.x,
      pointerStartY: startPt.y,
    };
    svg.setPointerCapture(e.pointerId);
  }

  svg.addEventListener('pointermove', (e) => {
    if (!dragState) return;
    const pt = getSvgPoint(e);
    const dx = pt.x - dragState.pointerStartX;
    const dy = pt.y - dragState.pointerStartY;
    // Round to whole millimeter
    let newX = Math.round(dragState.startX + dx);
    let newY = Math.round(dragState.startY - dy); // Invert Y back to mm from bottom

    // Magnetic snap to center line within 5 mm
    if (Math.abs(newX) <= 5) newX = 0;

    onMoveDriver(dragState.driverId, newX, newY);
  });

  const endDrag = (e) => {
    if (!dragState) return;
    try {
      svg.releasePointerCapture(e.pointerId);
    } catch (_) {}
    dragState = null;
  };

  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
  svg.addEventListener('click', () => onSelectDriver(null));

  return {
    render,
  };
}
