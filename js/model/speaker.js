// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

/**
 * SPEAKER CAD & DATASHEET MODEL
 *
 * Defines loudspeaker enclosures, placed drivers/transducers on the front baffle,
 * crossover assignments, and electroacoustic datasheet specifications.
 * Interoperable with Acoustic.Like.audio (devices.js & transducer.js).
 */

export const DRIVER_ROLES = {
  woofer: { name: 'Woofer', color: '#60a5fa', defaultDia: 200, minDia: 100, maxDia: 460 },
  mid: { name: 'Midrange', color: '#4ade80', defaultDia: 100, minDia: 60, maxDia: 200 },
  tweeter: { name: 'Tweeter (Dome)', color: '#f472b6', defaultDia: 28, minDia: 19, maxDia: 50 },
  horn: { name: 'Compression Horn', color: '#f59e0b', defaultW: 180, defaultH: 90, minDia: 60, maxDia: 400 },
  coax: { name: 'Coaxial / Dual Concentric', color: '#f59e0b', defaultDia: 250, minDia: 120, maxDia: 380 },
  port: { name: 'Reflex Port (Bass Vent)', color: '#94a3b8', defaultDia: 70, minDia: 30, maxDia: 150 },
};

/** Compute net internal volume in litres from outer dimensions (mm) and wall thickness (mm). */
export function computeVolumeLitres({ w, h, d, wallThickness = 19 }) {
  const t = Math.max(0, wallThickness);
  const iw = Math.max(0, w - 2 * t);
  const ih = Math.max(0, h - 2 * t);
  const id = Math.max(0, d - 2 * t);
  const mm3 = iw * ih * id;
  return +(mm3 / 1000000).toFixed(2);
}

/** Compute approximate baffle-step transition frequency (Hz) where radiation transitions from 4pi to 2pi. */
export function computeBaffleStepHz(widthMm) {
  if (!widthMm || widthMm <= 0) return 300;
  // f3 ≈ 115 / width_in_metres
  const wMetres = widthMm / 1000;
  return +(115 / wMetres).toFixed(1);
}

/** Compute theoretical max SPL at 1 m from 1W sensitivity (dB) and RMS power handling (W). */
export function computeMaxSpl(sensitivity = 90, watts = 100) {
  if (!watts || watts <= 0) return sensitivity;
  return Math.round(sensitivity + 10 * Math.log10(watts));
}

/** Check for boundary overrun or overlap collisions between drivers on the baffle. */
export function validateDriverPlacement(cabinet, drivers) {
  const issues = [];
  const halfW = cabinet.w / 2;
  const H = cabinet.h;

  for (let i = 0; i < drivers.length; i++) {
    const d = drivers[i];
    const rW = (d.role === 'horn' ? (d.mouthWidth || d.diameter) : d.diameter) / 2;
    const rH = (d.role === 'horn' ? (d.mouthHeight || d.diameter) : d.diameter) / 2;

    // Check bounds: horizontal (centered around x = 0, [-halfW, +halfW])
    if (d.x - rW < -halfW || d.x + rW > halfW) {
      issues.push({
        driverId: d.id,
        type: 'out-of-bounds',
        message: `${d.name || d.role} extends outside the baffle width (${cabinet.w} mm).`,
      });
    }

    // Check bounds: vertical (from bottom y = 0 to y = H)
    if (d.y - rH < 0 || d.y + rH > H) {
      issues.push({
        driverId: d.id,
        type: 'out-of-bounds',
        message: `${d.name || d.role} extends outside the baffle height (${cabinet.h} mm).`,
      });
    }

    // Check overlaps with other drivers
    for (let j = i + 1; j < drivers.length; j++) {
      const d2 = drivers[j];
      const rW2 = (d2.role === 'horn' ? (d2.mouthWidth || d2.diameter) : d2.diameter) / 2;
      const rH2 = (d2.role === 'horn' ? (d2.mouthHeight || d2.diameter) : d2.diameter) / 2;

      // Approximate clearance as elliptical or circular distance
      const dx = d.x - d2.x;
      const dy = d.y - d2.y;
      const dist = Math.hypot(dx, dy);
      const reqDist = Math.max(rW + rW2, rH + rH2) * 0.96; // 4% grace margin for flush bevels

      if (dist < reqDist) {
        issues.push({
          driverId: d.id,
          otherDriverId: d2.id,
          type: 'overlap',
          message: `${d.name || d.role} overlaps with ${d2.name || d2.role} (center distance ${Math.round(dist)} mm vs required ${Math.round(reqDist)} mm).`,
        });
      }
    }
  }

  return issues;
}

/** Formats the speaker into the schema consumed by Acoustic.Like.audio (devices.js and transducer.js). */
export function exportToAcousticPreset(speaker) {
  const ways = speaker.drivers.filter((d) => d.role !== 'port').length;
  const litres = speaker.cabinet.volumeLitres || computeVolumeLitres(speaker.cabinet);
  const primaryDriver = speaker.drivers.find((d) => d.role === 'woofer' || d.role === 'coax') || speaker.drivers[0];
  const driverInches = primaryDriver?.diameter ? Math.round(primaryDriver.diameter / 25.4) : 8;

  let driverDesc = `${driverInches}"`;
  if (primaryDriver?.role === 'coax') driverDesc = `coaxial ${driverInches}"`;
  else if (ways === 2) driverDesc = `2-way ${driverInches}"`;
  else if (ways === 3) driverDesc = `3-way ${driverInches}"`;

  return {
    label: `${speaker.maker || 'Custom'} ${speaker.name || 'Speaker'} · ${driverDesc} · ${litres} L`,
    maker: speaker.maker || 'Custom',
    model: speaker.name || 'Speaker',
    driver: driverDesc,
    litres,
    typical: false,
    pattern: speaker.directivity.pattern || 'horn',
    hCov: speaker.directivity.hCov || 90,
    vCov: speaker.directivity.vCov || 60,
    sensitivity: speaker.specs.sensitivity || 88,
    watts: speaker.specs.watts || 100,
    maxSpl: speaker.specs.maxSpl || computeMaxSpl(speaker.specs.sensitivity, speaker.specs.watts),
    fLow: speaker.specs.fLow || 45,
    fHigh: speaker.specs.fHigh || 20000,
    omniBelow: speaker.directivity.omniBelow || computeBaffleStepHz(speaker.cabinet.w),
    fCross: speaker.crossovers[0]?.f || 2000,
    lowpass: speaker.kind === 'sub' ? speaker.specs.fHigh || 120 : 0,
    color: speaker.cabinet.baffleColor || '#38bdf8',
    // Detailed geometry for CAD
    geometry: {
      w: speaker.cabinet.w / 1000,
      h: speaker.cabinet.h / 1000,
      d: speaker.cabinet.d / 1000,
      drivers: speaker.drivers.map((d) => ({
        role: d.role,
        x: d.x / 1000,
        y: d.y / 1000,
        diameter: (d.diameter || 100) / 1000,
        mouthWidth: (d.mouthWidth || d.diameter || 100) / 1000,
        mouthHeight: (d.mouthHeight || d.diameter || 100) / 1000,
      })),
    },
  };
}

/** Pre-configured reference loudspeaker templates */
export const SPEAKER_TEMPLATES = {
  nearfield2way: {
    id: 'nearfield2way',
    name: 'Reference 82 Nearfield',
    maker: 'APK Audio',
    kind: 'monitor',
    cabinet: {
      w: 240,
      h: 380,
      d: 280,
      wallThickness: 19,
      type: 'ported',
      volumeLitres: 15.8,
      baffleColor: '#1e1e24',
    },
    drivers: [
      { id: 'd-1', role: 'woofer', name: '8" Polypropylene Woofer', x: 0, y: 130, diameter: 200, fLow: 42, fHigh: 2100, sensitivity: 88, watts: 100, impedance: 8 },
      { id: 'd-2', role: 'tweeter', name: '1" Silk Soft-Dome Tweeter', x: 0, y: 285, diameter: 45, fLow: 2100, fHigh: 22000, sensitivity: 90, watts: 50, impedance: 6 },
      { id: 'p-1', role: 'port', name: 'Bass Reflex Port', x: 0, y: 350, diameter: 40, fLow: 45, fHigh: 120 },
    ],
    crossovers: [{ f: 2100, slope: 24, type: 'Linkwitz-Riley' }],
    specs: {
      sensitivity: 88,
      watts: 120,
      maxSpl: 109,
      fLow: 42,
      fHigh: 22000,
      nominalImpedance: 8,
    },
    directivity: {
      pattern: 'horn',
      hCov: 90,
      vCov: 60,
      omniBelow: 480,
    },
  },

  midfield3way: {
    id: 'midfield3way',
    name: 'Mastering 310 Midfield',
    maker: 'APK Audio',
    kind: 'monitor',
    cabinet: {
      w: 360,
      h: 640,
      d: 380,
      wallThickness: 25,
      type: 'ported',
      volumeLitres: 53.4,
      baffleColor: '#252528',
    },
    drivers: [
      { id: 'd-1', role: 'woofer', name: '10" Carbon Fiber Woofer', x: 0, y: 170, diameter: 260, fLow: 32, fHigh: 450, sensitivity: 89, watts: 250, impedance: 8 },
      { id: 'd-2', role: 'mid', name: '3" Soft-Dome Midrange', x: 0, y: 390, diameter: 140, fLow: 450, fHigh: 3500, sensitivity: 91, watts: 100, impedance: 8 },
      { id: 'd-3', role: 'tweeter', name: '1" Beryllium Dome Tweeter', x: 0, y: 520, diameter: 50, fLow: 3500, fHigh: 30000, sensitivity: 92, watts: 60, impedance: 6 },
    ],
    crossovers: [
      { f: 450, slope: 24, type: 'Linkwitz-Riley' },
      { f: 3500, slope: 24, type: 'Linkwitz-Riley' },
    ],
    specs: {
      sensitivity: 90,
      watts: 350,
      maxSpl: 115,
      fLow: 32,
      fHigh: 30000,
      nominalImpedance: 8,
    },
    directivity: {
      pattern: 'horn',
      hCov: 100,
      vCov: 70,
      omniBelow: 320,
    },
  },

  coaxial12: {
    id: 'coaxial12',
    name: 'Dual Concentric 12',
    maker: 'APK Audio',
    kind: 'monitor',
    cabinet: {
      w: 420,
      h: 580,
      d: 360,
      wallThickness: 22,
      type: 'ported',
      volumeLitres: 56.2,
      baffleColor: '#1c1c1f',
    },
    drivers: [
      { id: 'd-1', role: 'coax', name: '12" Dual Concentric Transducer', x: 0, y: 320, diameter: 310, fLow: 38, fHigh: 20000, sensitivity: 93, watts: 200, impedance: 8 },
      { id: 'p-1', role: 'port', name: 'Left Reflex Port', x: -110, y: 90, diameter: 65 },
      { id: 'p-2', role: 'port', name: 'Right Reflex Port', x: 110, y: 90, diameter: 65 },
    ],
    crossovers: [{ f: 1200, slope: 18, type: 'Butterworth' }],
    specs: {
      sensitivity: 93,
      watts: 200,
      maxSpl: 116,
      fLow: 38,
      fHigh: 20000,
      nominalImpedance: 8,
    },
    directivity: {
      pattern: 'horn',
      hCov: 90,
      vCov: 90,
      omniBelow: 275,
    },
  },

  mainHorn: {
    id: 'mainHorn',
    name: 'Studio Main 215 Horn',
    maker: 'APK Audio',
    kind: 'main',
    cabinet: {
      w: 780,
      h: 960,
      d: 520,
      wallThickness: 30,
      type: 'ported',
      volumeLitres: 245.0,
      baffleColor: '#18181b',
    },
    drivers: [
      { id: 'd-1', role: 'woofer', name: 'Left 15" Bass Driver', x: -190, y: 300, diameter: 385, fLow: 28, fHigh: 650, sensitivity: 97, watts: 600, impedance: 8 },
      { id: 'd-2', role: 'woofer', name: 'Right 15" Bass Driver', x: 190, y: 300, diameter: 385, fLow: 28, fHigh: 650, sensitivity: 97, watts: 600, impedance: 8 },
      { id: 'd-3', role: 'horn', name: '2" Constant Directivity Horn', x: 0, y: 730, diameter: 320, mouthWidth: 520, mouthHeight: 220, fLow: 650, fHigh: 18000, sensitivity: 108, watts: 150, impedance: 16 },
    ],
    crossovers: [{ f: 650, slope: 24, type: 'Linkwitz-Riley' }],
    specs: {
      sensitivity: 100,
      watts: 1200,
      maxSpl: 131,
      fLow: 28,
      fHigh: 18000,
      nominalImpedance: 4,
    },
    directivity: {
      pattern: 'horn',
      hCov: 90,
      vCov: 40,
      omniBelow: 150,
    },
  },

  subwoofer15: {
    id: 'subwoofer15',
    name: 'Sub Reflex 15',
    maker: 'APK Audio',
    kind: 'sub',
    cabinet: {
      w: 520,
      h: 580,
      d: 520,
      wallThickness: 25,
      type: 'ported',
      volumeLitres: 98.5,
      baffleColor: '#151518',
    },
    drivers: [
      { id: 'd-1', role: 'woofer', name: '15" High-Excursion Sub Driver', x: 0, y: 310, diameter: 390, fLow: 20, fHigh: 150, sensitivity: 90, watts: 800, impedance: 4 },
      { id: 'p-1', role: 'port', name: 'Left Port', x: -130, y: 80, diameter: 80 },
      { id: 'p-2', role: 'port', name: 'Right Port', x: 130, y: 80, diameter: 80 },
    ],
    crossovers: [{ f: 120, slope: 24, type: 'Linkwitz-Riley' }],
    specs: {
      sensitivity: 90,
      watts: 800,
      maxSpl: 119,
      fLow: 20,
      fHigh: 150,
      nominalImpedance: 4,
    },
    directivity: {
      pattern: 'omni',
      hCov: 360,
      vCov: 360,
      omniBelow: 120,
    },
  },
};

/** Create a fresh speaker from default template */
export function createDefaultSpeaker(templateKey = 'nearfield2way') {
  const base = SPEAKER_TEMPLATES[templateKey] || SPEAKER_TEMPLATES.nearfield2way;
  return JSON.parse(JSON.stringify(base));
}

/** Import and validate a .speaker.json file payload */
export function importSpeakerJson(jsonStr) {
  const obj = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
  if (!obj.cabinet || !obj.drivers) {
    throw new Error('Invalid speaker file: missing cabinet or drivers configuration');
  }
  return obj;
}
