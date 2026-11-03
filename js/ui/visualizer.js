// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import { DRIVER_ROLES } from '../model/speaker.js';

const F_MIN = 20;
const F_MAX = 20000;

function kHz(f) {
  return f >= 1000 ? `${+(f / 1000).toFixed(1)}k` : `${Math.round(f)}`;
}

/**
 * Visualizer component for crossover frequency bands and polar directivity patterns
 */
export function createVisualizer({ container }) {
  const root = document.createElement('div');
  root.className = 'visualizer-panel';
  container.appendChild(root);

  function render(speaker) {
    root.innerHTML = '';

    const bandsCard = document.createElement('div');
    bandsCard.className = 'viz-card';
    bandsCard.innerHTML = `<div class="viz-header"><span>Frequency Bands & Crossovers</span><span class="mono">${speaker.specs.fLow} Hz – ${kHz(speaker.specs.fHigh)} Hz</span></div>`;

    const bandsSvg = renderBandsSvg(speaker);
    bandsCard.appendChild(bandsSvg);

    const polarsCard = document.createElement('div');
    polarsCard.className = 'viz-card';
    polarsCard.innerHTML = `<div class="viz-header"><span>Directivity Polars</span><span class="mono">${speaker.directivity.hCov}° H × ${speaker.directivity.vCov}° V</span></div>`;

    const polarsContainer = document.createElement('div');
    polarsContainer.className = 'viz-polars-row';
    polarsContainer.appendChild(renderPolarSvg(speaker.directivity.hCov, 'Horizontal (from above)', '#38bdf8'));
    polarsContainer.appendChild(renderPolarSvg(speaker.directivity.vCov, 'Vertical (from side)', '#f472b6'));
    polarsCard.appendChild(polarsContainer);

    root.append(bandsCard, polarsCard);
  }

  function renderBandsSvg(speaker) {
    const W = 560;
    const rowH = 18;
    const activeDrivers = speaker.drivers.filter((d) => d.role !== 'port');
    const crossovers = speaker.crossovers || [];
    const H = Math.max(50, activeDrivers.length * rowH + 26);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'bands-svg');

    const logX = (f) => {
      const clamped = Math.max(F_MIN, Math.min(F_MAX, f));
      return (Math.log10(clamped / F_MIN) / Math.log10(F_MAX / F_MIN)) * (W - 40) + 20;
    };

    let inner = '';
    // Decade grid lines
    for (const f of [100, 1000, 10000]) {
      const x = logX(f);
      inner += `<line x1="${x}" y1="0" x2="${x}" y2="${H - 18}" stroke="#334155" stroke-dasharray="3 3"/>`;
      inner += `<text x="${x}" y="${H - 4}" fill="#64748b" font-size="10" font-family="ui-monospace, monospace" text-anchor="middle">${kHz(f)}Hz</text>`;
    }

    // Driver bands
    activeDrivers.forEach((d, i) => {
      const y = i * rowH + 6;
      const x1 = logX(d.fLow || speaker.specs.fLow || 40);
      const x2 = logX(d.fHigh || speaker.specs.fHigh || 20000);
      const roleCfg = DRIVER_ROLES[d.role] || DRIVER_ROLES.woofer;
      const color = roleCfg.color;

      inner += `<rect x="${x1}" y="${y}" width="${Math.max(4, x2 - x1)}" height="${rowH - 5}" rx="3" fill="${color}" opacity="0.8"/>`;
      inner += `<text x="${x1 + 6}" y="${y + rowH - 9}" fill="#0f172a" font-size="9.5" font-weight="600">${d.name || roleCfg.name}</text>`;
    });

    // Crossover lines
    for (const xo of crossovers) {
      const x = logX(xo.f);
      inner += `<line x1="${x}" y1="0" x2="${x}" y2="${H - 18}" stroke="#f59e0b" stroke-width="2"/>`;
      inner += `<text x="${x}" y="8" fill="#f59e0b" font-size="9" font-family="ui-monospace, monospace" text-anchor="middle">XO ${kHz(xo.f)}</text>`;
    }

    svg.innerHTML = inner;
    return svg;
  }

  function renderPolarSvg(covDeg = 90, label = '', color = '#38bdf8') {
    const R = 64;
    const size = 160;
    const cx = size / 2;
    const cy = size / 2;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('class', 'polar-svg');

    let inner = '';
    // Concentric dB rings (0, -6, -12, -18 dB)
    for (const r of [R, R * 0.75, R * 0.5, R * 0.25]) {
      inner += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#334155" stroke-width="1"/>`;
    }
    // Axes
    inner += `<line x1="${cx - R}" y1="${cy}" x2="${cx + R}" y2="${cy}" stroke="#334155" stroke-dasharray="2 2"/>`;
    inner += `<line x1="${cx}" y1="${cy - R}" x2="${cx}" y2="${cy + R}" stroke="#334155" stroke-dasharray="2 2"/>`;

    // Coverage sector lines (-6 dB beamwidth)
    const rad = (covDeg / 2) * (Math.PI / 180);
    const x1 = cx - R * Math.sin(rad);
    const y1 = cy - R * Math.cos(rad);
    const x2 = cx + R * Math.sin(rad);
    const y2 = cy - R * Math.cos(rad);

    inner += `<line x1="${cx}" y1="${cy}" x2="${x1}" y2="${y1}" stroke="${color}" stroke-width="1.5"/>`;
    inner += `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.5"/>`;

    // Sector arc
    const largeArc = covDeg > 180 ? 1 : 0;
    inner += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${color}" fill-opacity="0.18"/>`;

    // Labels
    inner += `<text x="${cx}" y="${size - 6}" fill="#94a3b8" font-size="10" text-anchor="middle">${label}</text>`;
    inner += `<text x="${cx}" y="${cy - R + 14}" fill="${color}" font-size="11" font-weight="600" text-anchor="middle">${covDeg}°</text>`;

    svg.innerHTML = inner;
    return svg;
  }

  return {
    render,
  };
}
