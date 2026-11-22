/* ==================== STATE & STORAGE KEYS ==================== */
const STORAGE_KEYS = {
  IDENTITY: 'm12_elektronika_identity',
  ANGLE_LOG: 'm12_elektronika_angle_log',
  WAVE_LOG: 'm12_elektronika_wave_log'
};

let lastActiveMode = 'A';
let currentConvA = null;
let currentConvB = null;
let currentConvC = null;
let currentWaveState = null;

let angleLogs = [];
let waveLogs = [];

/* ==================== UTILITY FUNCTIONS ==================== */
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2800);
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === tabId);
  });
  if (tabId === 'tab-3') {
    requestAnimationFrame(() => updateWaveSimulator());
  }
}

function printCurrentTab(tabId) {
  document.body.setAttribute('data-print-tab', tabId);
  setTimeout(() => {
    window.print();
  }, 60);
}

window.addEventListener('afterprint', () => {
  document.body.removeAttribute('data-print-tab');
});

function fmtNum(num, decimals = 4) {
  if (!isFinite(num) || isNaN(num)) return '0';
  return num.toFixed(decimals).replace('.', ',');
}

function parseSmartNumber(str) {
  if (typeof str === 'number') return str;
  if (!str) return NaN;
  let clean = String(str).trim()
    .replace(/,/g, '.')
    .replace(/\s+/g, '')
    .replace(/[−–—]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/[÷:]/g, '/');

  // Normalize 'pi', 'π', or 'x' (common keyboard substitute for π) into 'π'
  clean = clean.replace(/pi/gi, 'π').replace(/x/gi, 'π');

  // Handle π or arithmetic fraction expressions safely
  if (/π|[+\-*/()]/.test(clean)) {
    // Insert implicit multiplication: 3π -> 3*π, )π -> )*π, π3 -> π*3, π( -> π*(, 2( -> 2*(
    clean = clean.replace(/(\d|\))π/g, '$1*π');
    clean = clean.replace(/π(\d|\()/g, 'π*$1');
    clean = clean.replace(/(\d)\(/g, '$1*(');
    clean = clean.replace(/\)(\d)/g, ')*$1');
    clean = clean.replace(/π/g, 'Math.PI');

    // Validate only safe math characters
    if (/^[0-9+\-*/().MathPI]+$/.test(clean)) {
      try {
        const val = Function('"use strict"; return (' + clean + ');')();
        return typeof val === 'number' && isFinite(val) ? val : NaN;
      } catch (e) {
        return NaN;
      }
    }
    return NaN;
  }
  const n = parseFloat(clean);
  return isFinite(n) ? n : NaN;
}

function gcd(a, b) {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

function formatPiRatio(radVal) {
  if (Math.abs(radVal) < 1e-12) return '0';
  const ratio = radVal / Math.PI;
  // Check simple fractions p/q with q <= 24
  for (let q = 1; q <= 24; q++) {
    const p = Math.round(ratio * q);
    if (Math.abs(ratio - p / q) < 1e-6) {
      if (p === 0) return '0';
      const d = gcd(p, q);
      const num = p / d;
      const den = q / d;
      const sign = num < 0 ? '−' : '';
      const absNum = Math.abs(num);
      const numStr = absNum === 1 ? 'π' : `${absNum}π`;
      return den === 1 ? `${sign}${numStr}` : `${sign}${numStr}/${den}`;
    }
  }
  return `${fmtNum(ratio, 4)}π`;
}

function degToDmsObject(degVal) {
  const sign = degVal < 0 ? -1 : 1;
  let absDeg = Math.abs(degVal);
  let d = Math.floor(absDeg + 1e-11);
  let remMin = (absDeg - d) * 60;
  let m = Math.floor(remMin + 1e-9);
  let s = (remMin - m) * 60;

  if (Math.abs(s - 60) < 1e-4) {
    s = 0;
    m += 1;
  }
  if (m >= 60) {
    m -= 60;
    d += 1;
  }
  const signedD = sign < 0 && d === 0 ? `-0` : `${sign < 0 ? '-' : ''}${d}`;
  const formatted = `${signedD}° ${m}' ${fmtNum(s, 2)}"`;
  return { d: sign * d, m, s, formatted };
}

/* ==================== TAB 2: ANGLE CONVERSIONS ==================== */
function convertModeA() {
  lastActiveMode = 'A';
  const raw = document.getElementById('inputModeA').value;
  const deg = parseSmartNumber(raw);
  if (isNaN(deg)) {
    currentConvA = null;
    document.getElementById('resA_deg').textContent = raw.trim() === '' ? '-' : 'Input tidak valid';
    document.getElementById('resA_rad').textContent = '-';
    document.getElementById('resA_pi').textContent = '-';
    document.getElementById('resA_dms').textContent = '-';
    return;
  }
  const rad = deg * Math.PI / 180;
  const piStr = formatPiRatio(rad);
  const dms = degToDmsObject(deg);

  document.getElementById('resA_deg').textContent = `${fmtNum(deg, 4)}°`;
  document.getElementById('resA_rad').textContent = `${fmtNum(rad, 4)} rad`;
  document.getElementById('resA_pi').textContent = `${piStr} rad`;
  document.getElementById('resA_dms').textContent = dms.formatted;

  currentConvA = {
    mode: 'A',
    input: `${raw.trim()}°`,
    degStr: `${fmtNum(deg, 4)}°`,
    radStr: fmtNum(rad, 4),
    piStr: piStr,
    dmsStr: dms.formatted
  };
}

function insertPiModeB() {
  const inp = document.getElementById('inputModeB');
  const start = inp.selectionStart ?? inp.value.length;
  const end = inp.selectionEnd ?? inp.value.length;
  inp.value = inp.value.slice(0, start) + 'π' + inp.value.slice(end);
  inp.focus();
  inp.setSelectionRange(start + 1, start + 1);
  convertModeB();
}

function setPresetB(expr) {
  document.getElementById('inputModeB').value = expr;
  convertModeB();
}

function convertModeB() {
  lastActiveMode = 'B';
  const raw = document.getElementById('inputModeB').value;
  const rad = parseSmartNumber(raw);
  if (isNaN(rad)) {
    currentConvB = null;
    document.getElementById('resB_rad').textContent = raw.trim() === '' ? '-' : 'Input tidak valid';
    document.getElementById('resB_pi').textContent = '-';
    document.getElementById('resB_deg').textContent = '-';
    document.getElementById('resB_dms').textContent = '-';
    return;
  }
  const deg = rad * 180 / Math.PI;
  const piStr = formatPiRatio(rad);
  const dms = degToDmsObject(deg);

  document.getElementById('resB_rad').textContent = `${fmtNum(rad, 4)} rad`;
  document.getElementById('resB_pi').textContent = `${piStr} rad`;
  document.getElementById('resB_deg').textContent = `${fmtNum(deg, 4)}°`;
  document.getElementById('resB_dms').textContent = dms.formatted;

  currentConvB = {
    mode: 'B',
    input: raw.trim(),
    degStr: `${fmtNum(deg, 4)}°`,
    radStr: fmtNum(rad, 4),
    piStr: piStr,
    dmsStr: dms.formatted
  };
}

function convertModeC() {
  lastActiveMode = 'C';
  const d = parseSmartNumber(document.getElementById('inputModeC_D').value) || 0;
  const m = parseSmartNumber(document.getElementById('inputModeC_M').value) || 0;
  const s = parseSmartNumber(document.getElementById('inputModeC_S').value) || 0;

  const sign = d < 0 ? -1 : 1;
  const deg = sign * (Math.abs(d) + Math.abs(m) / 60 + Math.abs(s) / 3600);
  const rad = deg * Math.PI / 180;
  const piStr = formatPiRatio(rad);
  const dmsFormatted = `${d}° ${m}' ${fmtNum(s, 2)}"`;

  document.getElementById('resC_deg').textContent = `${fmtNum(deg, 4)}°`;
  document.getElementById('resC_rad').textContent = `${fmtNum(rad, 4)} rad`;
  document.getElementById('resC_pi').textContent = `${piStr} rad`;
  document.getElementById('resC_dms').textContent = dmsFormatted;

  currentConvC = {
    mode: 'C',
    input: dmsFormatted,
    degStr: `${fmtNum(deg, 4)}°`,
    radStr: fmtNum(rad, 4),
    piStr: piStr,
    dmsStr: dmsFormatted
  };
}

function getTimestamp() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function saveAngleLog(mode) {
  if (mode === 'A') convertModeA();
  if (mode === 'B') convertModeB();
  if (mode === 'C') convertModeC();

  const data = mode === 'A' ? currentConvA : mode === 'B' ? currentConvB : currentConvC;
  if (!data) {
    showToast('Periksa kembali nilai input sebelum menyimpan!');
    return;
  }

  angleLogs.push({
    id: Date.now() + Math.random(),
    waktu: getTimestamp(),
    ...data
  });
  persistData();
  renderAngleLogs();
  showToast(`Hasil percobaan Mode ${mode} ditambahkan ke Log!`);
}

function deleteAngleLog(idx) {
  angleLogs.splice(idx, 1);
  persistData();
  renderAngleLogs();
  showToast('Baris log dihapus.');
}

function clearAngleLog() {
  if (angleLogs.length === 0) return;
  if (confirm('Hapus semua data pada Log Percobaan Konversi Sudut?')) {
    angleLogs = [];
    persistData();
    renderAngleLogs();
    showToast('Semua log konversi sudut telah dibersihkan.');
  }
}

function renderAngleLogs() {
  const tbody = document.getElementById('angleLogBody');
  const countA = angleLogs.filter(x => x.mode === 'A').length;
  const countB = angleLogs.filter(x => x.mode === 'B').length;
  const countC = angleLogs.filter(x => x.mode === 'C').length;
  const total = angleLogs.length;

  document.getElementById('countA').textContent = `${countA} / 4`;
  document.getElementById('countB').textContent = `${countB} / 4`;
  document.getElementById('countC').textContent = `${countC} / 4`;
  document.getElementById('countTotal').textContent = `${total} / 12`;

  document.getElementById('boxCountA').classList.toggle('done', countA >= 4);
  document.getElementById('boxCountB').classList.toggle('done', countB >= 4);
  document.getElementById('boxCountC').classList.toggle('done', countC >= 4);
  document.getElementById('boxCountTotal').classList.toggle('done', countA >= 4 && countB >= 4 && countC >= 4 && total >= 12);

  const updateCheck = (id, done, text) => {
    const el = document.getElementById(id);
    el.classList.toggle('completed', done);
    el.innerHTML = `${done ? '&#9745;' : '&#9744;'} ${text}`;
  };

  updateCheck('chkA', countA >= 4, 'Lakukan 4 percobaan pada Mode A (Degree Decimal).');
  updateCheck('chkB', countB >= 4, 'Lakukan 4 percobaan pada Mode B (Radian, termasuk notasi π).');
  updateCheck('chkC', countC >= 4, 'Lakukan 4 percobaan pada Mode C (DMS).');
  updateCheck('chkTotal', countA >= 4 && countB >= 4 && countC >= 4 && total >= 12, 'Total minimal 12 percobaan tersimpan di log.');

  const badge = document.getElementById('targetStatusBadge');
  if (countA >= 4 && countB >= 4 && countC >= 4 && total >= 12) {
    badge.textContent = 'TARGET TERCAPAI';
    badge.className = 'mode-badge badge-c';
  } else {
    badge.textContent = `${total}/12 SELESAI`;
    badge.className = 'mode-badge badge-b';
  }

  if (angleLogs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 18px;">
          Belum ada data percobaan. Silakan lakukan konversi pada Mode A, B, atau C lalu klik <strong>Save Hasil Percobaan</strong>.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = angleLogs.map((row, idx) => {
    const badgeCls = row.mode === 'A' ? 'badge-a' : row.mode === 'B' ? 'badge-b' : 'badge-c';
    return `
      <tr>
        <td>${idx + 1}</td>
        <td>${row.waktu}</td>
        <td><span class="mode-badge ${badgeCls}">Mode ${row.mode}</span></td>
        <td style="font-family: Consolas, monospace;">${row.input}</td>
        <td style="font-family: Consolas, monospace;">${row.degStr}</td>
        <td style="font-family: Consolas, monospace;">${row.radStr}</td>
        <td style="font-family: Consolas, monospace; color: var(--cyan);">${row.piStr}</td>
        <td style="font-family: Consolas, monospace;">${row.dmsStr}</td>
        <td class="col-aksi"><button class="del-btn" onclick="deleteAngleLog(${idx})" title="Hapus baris">Hapus</button></td>
      </tr>`;
  }).join('');
}

/* ==================== TAB 3: SINUSOIDAL SIMULATOR ==================== */
function loadSampleP12() {
  switchTab('tab-3');
  applyWavePreset(340, '50π', '0.541', 'lag');
  showToast('Sampel Soal Latihan (P12) dimuat ke Simulator!');
}

function applyWavePreset(amp, omegaStr, phaseStr, sign) {
  document.getElementById('waveQuantity').value = 'v';
  document.getElementById('waveFunc').value = 'sin';
  document.getElementById('waveAmp').value = String(amp);
  document.getElementById('waveOmega').value = omegaStr;
  document.getElementById('wavePhaseVal').value = phaseStr;
  document.getElementById('wavePhaseSign').value = sign;
  updateWaveSimulator();
}

function updateWaveSimulator() {
  const qty = document.getElementById('waveQuantity').value; // 'v' or 'i'
  const funcType = document.getElementById('waveFunc').value; // 'sin' or 'cos'
  const unit = qty === 'v' ? 'V' : 'A';
  const unitFull = qty === 'v' ? 'Volt' : 'Ampere';

  document.getElementById('ampUnitLabel').textContent = unitFull;

  const A = Math.abs(parseSmartNumber(document.getElementById('waveAmp').value)) || 5;
  const omegaRaw = document.getElementById('waveOmega').value.trim() || '100π';
  const omega = parseSmartNumber(omegaRaw);
  const validOmega = (!isNaN(omega) && omega > 0) ? omega : (100 * Math.PI);

  document.getElementById('omegaHint').textContent = `${omegaRaw} rad/s ≈ ${fmtNum(validOmega, 2)} rad/s`;

  const phaseRaw = document.getElementById('wavePhaseVal').value.trim();
  let phaseMag = Math.abs(parseSmartNumber(phaseRaw));
  if (isNaN(phaseMag)) phaseMag = 0;

  const signMode = document.getElementById('wavePhaseSign').value;
  let phi = 0;
  if (signMode === 'lead') phi = phaseMag;
  else if (signMode === 'lag') phi = -phaseMag;
  else phi = 0;

  const phiDeg = phi * 180 / Math.PI;
  const absPhiDeg = Math.abs(phiDeg);

  // Build Equation String
  let phaseTerm = '';
  const dispPhase = phaseRaw && !isNaN(parseSmartNumber(phaseRaw)) && phaseMag !== 0
    ? (/pi|π/i.test(phaseRaw) ? phaseRaw.replace(/pi/gi, 'π') : fmtNum(phaseMag, 3))
    : '';

  if (signMode === 'lead' && phaseMag > 0) phaseTerm = ` + ${dispPhase}`;
  else if (signMode === 'lag' && phaseMag > 0) phaseTerm = ` − ${dispPhase}`;

  const dispOmega = /pi|π/i.test(omegaRaw) ? omegaRaw.replace(/pi/gi, 'π') : fmtNum(validOmega, 2);
  const eqStr = `${qty}(t) = ${fmtNum(A, A % 1 === 0 ? 0 : 2)} ${funcType}(${dispOmega}t${phaseTerm})`;
  document.getElementById('waveEqDisplay').textContent = eqStr;

  // Fundamental parameters
  const T = (2 * Math.PI) / validOmega; // seconds
  const T_ms = T * 1000;
  const f = 1 / T;

  // Status banner
  const banner = document.getElementById('phaseStatusBanner');
  const statusTitle = document.getElementById('phaseStatusTitle');
  const statusDetail = document.getElementById('phaseStatusDetail');
  let phaseTypeLabel = 'In Phase';

  if (Math.abs(phi) < 1e-9) {
    banner.className = 'status-banner status-in';
    statusTitle.textContent = 'STATUS: IN PHASE (SEFASE)';
    statusDetail.textContent = 'Gelombang sefase dengan acuan (0,00° / 0,0000 rad).';
    phaseTypeLabel = 'In Phase';
  } else if (phi > 0) {
    banner.className = 'status-banner status-lead';
    statusTitle.textContent = 'STATUS: LEADING (MENDAHULUI)';
    statusDetail.textContent = `Gelombang mendahului sebesar ${fmtNum(absPhiDeg, 2)}° (${fmtNum(phi, 4)} rad).`;
    phaseTypeLabel = 'Leading (+)';
  } else {
    banner.className = 'status-banner status-lag';
    statusTitle.textContent = 'STATUS: LAGGING (TERTINGGAL)';
    statusDetail.textContent = `Gelombang tertinggal sebesar ${fmtNum(absPhiDeg, 2)}° (${fmtNum(Math.abs(phi), 4)} rad).`;
    phaseTypeLabel = 'Lagging (−)';
  }

  // Helper eval function
  const evalWave = (tSec) => {
    const arg = validOmega * tSec + phi;
    return funcType === 'sin' ? A * Math.sin(arg) : A * Math.cos(arg);
  };

  // (a) Parameter Dasar
  document.getElementById('ansA_main').textContent =
    `A = ${fmtNum(A, A % 1 === 0 ? 0 : 2)} ${unit} | T = ${fmtNum(T, 4)} s (${fmtNum(T_ms, 2)} ms) | f = ${fmtNum(f, 2)} Hz`;
  document.getElementById('ansA_sub').textContent =
    `Kecepatan Sudut ω = ${fmtNum(validOmega, 2)} rad/s | Phase Angle = ${fmtNum(phiDeg, 2)}° (${phaseTypeLabel})`;

  // (b) t = 0
  const valAt0 = evalWave(0);
  document.getElementById('ansB_val').textContent = `${fmtNum(valAt0, 2)} ${unit}`;
  document.getElementById('ansB_sub').textContent = `${qty}(0) = ${fmtNum(A, 0)} ${funcType}(${fmtNum(phi, 4)})`;

  // (c) t = 10 ms = 0.01 s
  const valAt10ms = evalWave(0.01);
  document.getElementById('ansC_val').textContent = `${fmtNum(valAt10ms, 2)} ${unit}`;
  document.getElementById('ansC_sub').textContent = `${qty}(0,01 s) pada t = 10 ms`;

  // (d) First positive t >= 0 where y(t) = 200 (Acuan Soal P12)
  const targetVal = 200;
  document.getElementById('ansD_title').textContent =
    `(d) Waktu t saat ${qty} = ${targetVal} ${unit} pertama`;

  if (targetVal > A) {
    document.getElementById('ansD_val').textContent = `Tidak tercapai (${targetVal} ${unit} > A)`;
    document.getElementById('ansD_sub').textContent = `Tercapai jika Amplitudo A ≥ ${targetVal} ${unit}`;
  } else {
    // Solve sin(theta) = targetVal/A or cos(theta) = targetVal/A
    let theta1, theta2;
    if (funcType === 'sin') {
      theta1 = Math.asin(targetVal / A);
      theta2 = Math.PI - theta1;
    } else {
      theta1 = Math.acos(targetVal / A);
      theta2 = -theta1;
    }
    const candidates = [];
    [theta1, theta2].forEach(th => {
      for (let k = -2; k <= 3; k++) {
        const tCand = (th + 2 * Math.PI * k - phi) / validOmega;
        if (tCand >= -1e-9) {
          candidates.push(Math.max(0, tCand));
        }
      }
    });
    const tFirstMs = Math.min(...candidates) * 1000;
    document.getElementById('ansD_val').textContent = `${fmtNum(tFirstMs, 2)} ms`;
    document.getElementById('ansD_sub').textContent = `t = ${fmtNum(tFirstMs / 1000, 5)} sekon (gelombang pertama)`;
  }

  // (e) First positive t >= 0 at Maximum (+A)
  const peakTheta = funcType === 'sin' ? (Math.PI / 2) : 0;
  let tMax = (peakTheta - phi) / validOmega;
  while (tMax < -1e-9) {
    tMax += T;
  }
  tMax = Math.max(0, tMax);
  document.getElementById('ansE_val').textContent = `${fmtNum(tMax * 1000, 2)} ms`;
  document.getElementById('ansE_sub').textContent = `t_maks = ${fmtNum(tMax, 5)} s (Nilai Puncak = +${fmtNum(A, 2)} ${unit})`;

  currentWaveState = {
    ampStr: `${fmtNum(A, A % 1 === 0 ? 0 : 2)} ${unit}`,
    omegaStr: dispOmega,
    phiStr: `${phi === 0 ? '0' : (phi > 0 ? dispPhase : '−' + dispPhase)} (${fmtNum(phiDeg, 2)}°)`,
    eqStr: eqStr,
    phaseType: phaseTypeLabel
  };

  drawWaveformCanvas(A, validOmega, phi, T_ms, funcType, qty, unit);
}

function drawWaveformCanvas(A, omega, phi, T_ms, funcType, qty, unit) {
  const canvas = document.getElementById('waveCanvas');
  const ctx = canvas.getContext('2d');

  // High-DPI scaling
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || 800;
  const height = 330;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  // Clear background
  ctx.fillStyle = '#010712';
  ctx.fillRect(0, 0, width, height);

  const padLeft = 58;
  const padRight = 24;
  const padTop = 24;
  const padBottom = 42;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  // Display 1.1 cycles so full cycle + transition is clearly visible like the reference screenshot
  const maxTimeMs = T_ms * 1.1;
  const yMax = A * 1.15;

  const xToPx = (tMs) => padLeft + (tMs / maxTimeMs) * plotW;
  const yToPx = (val) => padTop + plotH / 2 - (val / yMax) * (plotH / 2);

  // Grid lines
  ctx.strokeStyle = 'rgba(24, 54, 99, 0.45)';
  ctx.lineWidth = 1;

  // Horizontal grid (6 divisions)
  const ySteps = 6;
  ctx.font = '11px Consolas, monospace';
  ctx.fillStyle = '#8aa4cc';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  for (let i = -ySteps; i <= ySteps; i++) {
    const val = (A * i) / ySteps;
    const py = yToPx(val);
    ctx.beginPath();
    ctx.moveTo(padLeft, py);
    ctx.lineTo(padLeft + plotW, py);
    ctx.stroke();

    if (i % 2 === 0 || i === ySteps || i === -ySteps) {
      const labelTxt = Math.abs(val) < 1e-6 ? '0' : (A >= 10 ? val.toFixed(0) : val.toFixed(1));
      ctx.fillText(labelTxt, padLeft - 8, py);
    }
  }

  // Vertical grid (5 divisions)
  const xSteps = 5;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = 0; i <= xSteps; i++) {
    const tVal = (maxTimeMs * i) / xSteps;
    const px = xToPx(tVal);
    ctx.beginPath();
    ctx.moveTo(px, padTop);
    ctx.lineTo(px, padTop + plotH);
    ctx.stroke();

    const tLabel = maxTimeMs >= 10 ? tVal.toFixed(1) : tVal.toFixed(2);
    ctx.fillText(tLabel, px, padTop + plotH + 8);
  }

  // Zero Axis Highlight
  const zeroY = yToPx(0);
  ctx.strokeStyle = 'rgba(155, 180, 216, 0.5)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(padLeft, zeroY);
  ctx.lineTo(padLeft + plotW, zeroY);
  ctx.stroke();

  // Axis Titles
  ctx.fillStyle = '#00e5ff';
  ctx.font = 'bold 12px Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Waktu t (ms)', padLeft + plotW / 2, height - 14);

  ctx.save();
  ctx.translate(15, padTop + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`${qty === 'v' ? 'Tegangan v(t)' : 'Arus i(t)'} (${unit})`, 0, 0);
  ctx.restore();

  // 1. Reference Wave (phi = 0) - Dashed Thin White/Gray
  ctx.save();
  ctx.strokeStyle = 'rgba(220, 232, 250, 0.65)';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  const samples = 400;
  for (let s = 0; s <= samples; s++) {
    const tMs = (maxTimeMs * s) / samples;
    const tSec = tMs / 1000;
    const yRef = funcType === 'sin' ? A * Math.sin(omega * tSec) : A * Math.cos(omega * tSec);
    const px = xToPx(tMs);
    const py = yToPx(yRef);
    if (s === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();

  // 2. Main Shifted Wave - Glowing Electric Cyan
  ctx.save();
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 3.2;
  ctx.shadowColor = 'rgba(0, 229, 255, 0.55)';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  for (let s = 0; s <= samples; s++) {
    const tMs = (maxTimeMs * s) / samples;
    const tSec = tMs / 1000;
    const yMain = funcType === 'sin'
      ? A * Math.sin(omega * tSec + phi)
      : A * Math.cos(omega * tSec + phi);
    const px = xToPx(tMs);
    const py = yToPx(yMain);
    if (s === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();

  // Store geometry for mouse hover readout
  canvas._simMeta = { padLeft, plotW, maxTimeMs, A, omega, phi, funcType, qty, unit };
}

document.getElementById('waveCanvas').addEventListener('mousemove', function(e) {
  const meta = this._simMeta;
  if (!meta) return;
  const rect = this.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const relX = Math.max(0, Math.min(meta.plotW, mouseX - meta.padLeft));
  const tMs = (relX / meta.plotW) * meta.maxTimeMs;
  const tSec = tMs / 1000;
  const yVal = meta.funcType === 'sin'
    ? meta.A * Math.sin(meta.omega * tSec + meta.phi)
    : meta.A * Math.cos(meta.omega * tSec + meta.phi);

  document.getElementById('canvasReadout').textContent =
    `t = ${fmtNum(tMs, 2)} ms  |  ${meta.qty}(t) = ${fmtNum(yVal, 2)} ${meta.unit}`;
});

function saveWaveLog() {
  if (!currentWaveState) updateWaveSimulator();
  waveLogs.push({
    id: Date.now() + Math.random(),
    ...currentWaveState
  });
  persistData();
  renderWaveLogs();
  showToast('Data percobaan gelombang sinusoidal disimpan ke Log!');
}

function deleteWaveLog(idx) {
  waveLogs.splice(idx, 1);
  persistData();
  renderWaveLogs();
  showToast('Baris log gelombang dihapus.');
}

function clearWaveLog() {
  if (waveLogs.length === 0) return;
  if (confirm('Hapus semua data pada Log Percobaan Gelombang Sinusoidal?')) {
    waveLogs = [];
    persistData();
    renderWaveLogs();
    showToast('Log gelombang sinusoidal dibersihkan.');
  }
}

function renderWaveLogs() {
  const tbody = document.getElementById('waveLogBody');
  if (waveLogs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 18px;">
          Belum ada data log gelombang. Klik <strong>Save Hasil Percobaan</strong> untuk menyimpan hasil simulasi.
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = waveLogs.map((row, idx) => {
    let badgeCls = 'badge-a';
    if (row.phaseType.includes('Leading')) badgeCls = 'badge-c';
    else if (row.phaseType.includes('Lagging')) badgeCls = 'badge-b';
    return `
      <tr>
        <td>${idx + 1}</td>
        <td style="font-family: Consolas, monospace;">${row.ampStr}</td>
        <td style="font-family: Consolas, monospace;">${row.omegaStr}</td>
        <td style="font-family: Consolas, monospace;">${row.phiStr}</td>
        <td style="font-family: Consolas, monospace; color: var(--cyan); font-weight: 700;">${row.eqStr}</td>
        <td><span class="mode-badge ${badgeCls}">${row.phaseType}</span></td>
        <td class="col-aksi"><button class="del-btn" onclick="deleteWaveLog(${idx})">Hapus</button></td>
      </tr>`;
  }).join('');
}

/* ==================== PERSISTENCE (LOCAL STORAGE) ==================== */
function saveIdentity() {
  const identity = {
    nama: document.getElementById('mhsNama').value,
    nim: document.getElementById('mhsNim').value,
    kelas: document.getElementById('mhsKelas').value
  };
  localStorage.setItem(STORAGE_KEYS.IDENTITY, JSON.stringify(identity));
}

function persistData() {
  saveIdentity();
  localStorage.setItem(STORAGE_KEYS.ANGLE_LOG, JSON.stringify(angleLogs));
  localStorage.setItem(STORAGE_KEYS.WAVE_LOG, JSON.stringify(waveLogs));
}

function manualSaveAll() {
  persistData();
  showToast('Seluruh identitas & log percobaan berhasil disimpan ke Browser (Local Storage)!');
}

function loadSavedData() {
  try {
    const idRaw = localStorage.getItem(STORAGE_KEYS.IDENTITY);
    if (idRaw) {
      const idObj = JSON.parse(idRaw);
      document.getElementById('mhsNama').value = idObj.nama || '';
      document.getElementById('mhsNim').value = idObj.nim || '';
      document.getElementById('mhsKelas').value = idObj.kelas || '';
    }

    const angleRaw = localStorage.getItem(STORAGE_KEYS.ANGLE_LOG);
    if (angleRaw) angleLogs = JSON.parse(angleRaw) || [];

    const waveRaw = localStorage.getItem(STORAGE_KEYS.WAVE_LOG);
    if (waveRaw) waveLogs = JSON.parse(waveRaw) || [];
  } catch (e) {
    console.warn('Gagal memuat localStorage:', e);
  }
}

/* ==================== INITIALIZATION ==================== */
window.addEventListener('DOMContentLoaded', () => {
  loadSavedData();
  convertModeA();
  convertModeB();
  convertModeC();
  renderAngleLogs();
  renderWaveLogs();
  updateWaveSimulator();
});

window.addEventListener('resize', () => {
  if (document.getElementById('tab-3').classList.contains('active')) {
    updateWaveSimulator();
  }
});
