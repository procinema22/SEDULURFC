/* script.js — FINAL TERPADU (fix lingkaran + preview margin-only + semua fitur sebelumnya)
   Ringkasan change:
   - Fix circle diameter scaling for preview vs PDF.
   - Add preview + PDF flow for "Cetak Margin Saja" when no photos uploaded.
   - Hide name & price automatically for that margin-only mode.
   - Keep overlay adjust, laprak, harga, perfoto, multi-batch etc.
*/

const upload = document.getElementById('upload');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const sizeSelect = document.getElementById('sizeSelect');
const customSize = document.getElementById('customSize');
const customW = document.getElementById('customW');
const customH = document.getElementById('customH');
const gapInput = document.getElementById('gap');
const priceDisplay = document.getElementById('priceDisplay');
const userName = document.getElementById('userName');
const previewBtn = document.getElementById('previewBtn');
const generateBtn = document.getElementById('generateBtn');
const downloadPdf = document.getElementById('downloadPdf');
const resetBtn = document.getElementById('reset');
const batchList = document.getElementById('batchList');
const modeSelect = document.getElementById('modeSelect');
const hargaPerFotoBox = document.getElementById('hargaPerFotoBox');
const hargaPerFotoInput = document.getElementById('hargaPerFoto');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageIndicator = document.getElementById('pageIndicator');
const pageNav = document.getElementById('pageNav');
const darkSwitch = document.getElementById('darkSwitch');

// Mode Laprak & manual/hide elements (existing)
const laprakMode = document.getElementById('laprakMode');
const laprakControls = document.getElementById('laprakControls');
const laprakName = document.getElementById('laprakName');
const laprakPrice = document.getElementById('laprakPrice');
const manualHargaCheckbox = document.getElementById('manualHargaCheckbox');
const manualHargaBox = document.getElementById('manualHargaBox');
const manualHargaInput = document.getElementById('manualHargaInput');
const hideInfo = document.getElementById('hideInfo');

let batches = []; // each batch: { files: [{file, adjustments}], size: '2x3'|'custom', customW, customH, copy }
let pagesCache = [];
let currentPageIndex = 0;

const PREVIEW_SCALE = 0.25;

/* ---------- DYNAMIC UI: inject Circle Mode, Border Only, Margin Grid ---------- */
(function injectControls() {
  const controls = document.querySelector('.controls');
  if (!controls) return;

  const wrapper = document.createElement('div');
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.gap = '8px';
  wrapper.style.marginTop = '6px';

  // Margin grid layout
  const marginRow = document.createElement('div');
  marginRow.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px;">
      <div style="font-weight:600;font-size:13px;">Margin (mm)</div>
      <div style="display:flex;justify-content:center;">
        <div style="width:160px;text-align:center;">
          <label style="font-size:12px;color:#666">Atas</label><br>
          <input id="marginTop" type="number" value="20" min="0" step="0.1" style="width:80px">
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;gap:8px;">
        <div style="width:160px;text-align:center;">
          <label style="font-size:12px;color:#666">Kiri</label><br>
          <input id="marginLeft" type="number" value="30" min="0" step="0.1" style="width:80px">
        </div>
        <div style="width:160px;text-align:center;">
          <label style="font-size:12px;color:#666">Kanan</label><br>
          <input id="marginRight" type="number" value="20" min="0" step="0.1" style="width:80px">
        </div>
      </div>
      <div style="display:flex;justify-content:center;">
        <div style="width:160px;text-align:center;">
          <label style="font-size:12px;color:#666">Bawah</label><br>
          <input id="marginBottom" type="number" value="20" min="0" step="0.1" style="width:80px">
        </div>
      </div>
    </div>
  `;

  // Circle mode checkbox + diameter input
  const circleRow = document.createElement('div');
  circleRow.style.display = 'flex';
  circleRow.style.flexDirection = 'column';
  circleRow.innerHTML = `
    <label><input type="checkbox" id="circleMode"> Mode Lingkaran (Crop Bulat)</label>
    <div id="circleControls" style="display:none;gap:8px;align-items:center;">
      <label>Diameter Lingkaran (cm)</label>
      <input id="circleDiameter" type="number" value="3" min="0.5" step="0.1" style="width:120px">
    </div>
  `;

  // Margin-only checkbox + border thickness input
  const borderRow = document.createElement('div');
  borderRow.style.display = 'flex';
  borderRow.style.flexDirection = 'column';
  borderRow.innerHTML = `
    <label><input type="checkbox" id="borderOnly"> Cetak Margin Saja (hanya border persegi)</label>
    <div id="borderControls" style="display:none;gap:8px;align-items:center;">
      <label>Ketebalan Border (px)</label>
      <input id="borderThickness" type="number" value="2" min="1" step="1" style="width:120px">
    </div>
  `;

  wrapper.append(marginRow, circleRow, borderRow);
  controls.appendChild(wrapper);

  // link new elements to window scope so other functions can access
  window.marginTop = document.getElementById('marginTop');
  window.marginLeft = document.getElementById('marginLeft');
  window.marginRight = document.getElementById('marginRight');
  window.marginBottom = document.getElementById('marginBottom');

  window.circleMode = document.getElementById('circleMode');
  window.circleControls = document.getElementById('circleControls');
  window.circleDiameter = document.getElementById('circleDiameter');

  window.borderOnly = document.getElementById('borderOnly');
  window.borderControls = document.getElementById('borderControls');
  window.borderThickness = document.getElementById('borderThickness');

  // events
  window.circleMode.onchange = () => {
    circleControls.style.display = circleMode.checked ? 'flex' : 'none';
  };
  window.borderOnly.onchange = () => {
    borderControls.style.display = borderOnly.checked ? 'flex' : 'none';
  };
})();

/* Theme init */
(function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') {
    document.body.classList.add('dark');
    darkSwitch.classList.add('on');
  }
})();
darkSwitch.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  const on = document.body.classList.contains('dark');
  darkSwitch.classList.toggle('on', on);
  localStorage.setItem('theme', on ? 'dark' : 'light');
});

/* Existing UI handlers */
modeSelect.onchange = () => { 
  hargaPerFotoBox.style.display = modeSelect.value === 'perfoto' ? 'block' : 'none'; 
  updatePricePreview();
};
sizeSelect.onchange = () => { 
  customSize.style.display = sizeSelect.value === 'custom' ? 'flex' : 'none'; 
};
laprakMode.onchange = () => {
  laprakControls.style.display = laprakMode.checked ? 'block' : 'none';
  modeSelect.disabled = laprakMode.checked;
};
if (manualHargaCheckbox) {
  manualHargaCheckbox.onchange = () => {
    manualHargaBox.style.display = manualHargaCheckbox.checked ? 'block' : 'none';
    updatePricePreview();
  };
}

/* Helper: wrap file into object with default adjustments */
function wrapFiles(files) {
  return files.map(f => ({
    file: f,
    adjustments: { offsetX: 0, offsetY: 0, scale: 1 } // offset in pixels relative to box center
  }));
}

/* Upload handler */
upload.onchange = async e => {
  const rawFiles = Array.from(e.target.files || []);
  if (!rawFiles.length) return;
  const wrapped = wrapFiles(rawFiles);
  if (sizeSelect.value === 'custom') {
    const cw = parseFloat(customW.value), ch = parseFloat(customH.value);
    if (!cw || !ch) batches.push({ files: wrapped, size: '2x3', copy: 1 });
    else batches.push({ files: wrapped, size: 'custom', customW: cw, customH: ch, copy: 1 });
  } else {
    batches.push({ files: wrapped, size: sizeSelect.value, copy: 1 });
  }
  upload.value = '';
  refreshBatchList();
  await updatePricePreview();
};

/* Refresh batch list: show thumbnails + Atur Posisi button + copies + delete */
function refreshBatchList() {
  batchList.innerHTML = '';
  batches.forEach((b, bi) => {
    const row = document.createElement('div');
    row.className = 'batch-row';
    const sizeText = b.size === 'custom' ? `${b.customW}x${b.customH} cm` : b.size.replace('x',' x ');
    const meta = document.createElement('div');
    meta.style.flex = '1';
    meta.innerHTML = `<strong>Batch ${bi+1}</strong><div class="small">${b.files.length} foto — ${sizeText}</div>`;
    row.appendChild(meta);

    // thumbnails container
    const thumbs = document.createElement('div');
    thumbs.style.display = 'flex';
    thumbs.style.gap = '6px';
    thumbs.style.alignItems = 'center';
    b.files.forEach((fobj, fi) => {
      const thumbWrap = document.createElement('div');
      thumbWrap.style.display = 'flex';
      thumbWrap.style.flexDirection = 'column';
      thumbWrap.style.alignItems = 'center';
      thumbWrap.style.gap = '4px';

      const img = document.createElement('img');
      img.src = URL.createObjectURL(fobj.file);
      img.style.width = '56px';
      img.style.height = '56px';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '6px';
      img.style.border = '1px solid rgba(0,0,0,0.06)';

      // Atur Posisi button
      const btn = document.createElement('button');
      btn.className = 'ok';
      btn.style.padding = '6px';
      btn.style.fontSize = '12px';
      btn.textContent = '⚙️';
      btn.title = 'Atur Posisi';
      btn.onclick = () => openAdjustOverlay(bi, fi);

      // show scale small
      const small = document.createElement('div');
      small.className = 'small';
      small.style.fontSize = '11px';
      small.textContent = `x${(fobj.adjustments.scale||1).toFixed(2)}`;

      thumbWrap.append(img, btn, small);
      thumbs.appendChild(thumbWrap);
    });

    // copies input & delete batch button
    const copies = document.createElement('input'); 
    copies.type='number'; copies.value=b.copy||1; copies.min=1; copies.style.width='60px';
    copies.onchange = async () => { b.copy = Math.max(1, parseInt(copies.value)||1); await updatePricePreview(); };
    const del = document.createElement('button'); del.textContent='❌'; del.className='warn';
    del.onclick = async () => { batches.splice(bi,1); refreshBatchList(); await updatePricePreview(); };

    row.append(thumbs, copies, del);
    batchList.appendChild(row);
  });
  batchList.style.display = batches.length ? 'block' : 'none';
}

/* ========== EXIF load + compression ========== */
function loadImageWithEXIF(file, mode = "preview") {
  return new Promise(res => {
    try {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onerror = () => { console.warn(`Gagal memuat: ${file.name}, dilewati.`); res(null); };
        EXIF.getData(file, function() {
          const o = EXIF.getTag(this, 'Orientation');
          img.onload = () => {
            const maxDim = mode === "pdf" ? 2500 : 1500;
            const quality = mode === "pdf" ? 0.9 : 0.7;
            let iw = img.width, ih = img.height;
            let scale = Math.min(1, maxDim / Math.max(iw, ih));
            const newW = Math.round(iw * scale);
            const newH = Math.round(ih * scale);

            const c = document.createElement('canvas');
            const x = c.getContext('2d');

            if (o >= 5 && o <= 8) { c.width = newH; c.height = newW; } 
            else { c.width = newW; c.height = newH; }

            switch (o) {
              case 2: x.translate(c.width, 0); x.scale(-1, 1); break;
              case 3: x.translate(c.width, c.height); x.rotate(Math.PI); break;
              case 4: x.translate(0, c.height); x.scale(1, -1); break;
              case 5: x.rotate(0.5 * Math.PI); x.scale(1, -1); break;
              case 6: x.translate(c.width, 0); x.rotate(0.5 * Math.PI); break;
              case 7: x.translate(c.width, c.height); x.rotate(0.5 * Math.PI); x.scale(-1, 1); break;
              case 8: x.translate(0, c.height); x.rotate(-0.5 * Math.PI); break;
            }

            x.drawImage(img, 0, 0, newW, newH);
            const compressed = new Image();
            compressed.onload = () => res(compressed);
            compressed.onerror = () => { console.warn(`Gagal kompres: ${file.name}, dilewati.`); res(null); };
            compressed.src = c.toDataURL('image/jpeg', quality);
          };
          img.src = e.target.result;
        });
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Error baca file:', err);
      res(null);
    }
  });
}

/* ---------- drawImageCoverWithShape ----------
   shape: 'rect' or 'circle'
   For circle: diameterPx parameter used (centered in box)
   adjustments: { offsetX, offsetY, scale }
*/
function drawImageCoverWithShape(ctx, img, x, y, boxW, boxH, adjustments = { offsetX:0, offsetY:0, scale:1 }, shape = 'rect', diameterPx = null) {
  const adj = adjustments || { offsetX:0, offsetY:0, scale:1 };

  if (shape === 'rect') {
    let iw = img.width, ih = img.height;
    let imgRatio = iw/ih, boxRatio = boxW/boxH;
    let drawW, drawH;
    if (imgRatio > boxRatio) { drawH = boxH; drawW = boxH * imgRatio; } 
    else { drawW = boxW; drawH = boxW / imgRatio; }
    drawW *= adj.scale; drawH *= adj.scale;
    const offsetX = (boxW - drawW)/2 + (adj.offsetX || 0);
    const offsetY = (boxH - drawH)/2 + (adj.offsetY || 0);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x+1, y+1, boxW-2, boxH-2);
    ctx.clip();
    ctx.drawImage(img, x + offsetX, y + offsetY, drawW, drawH);
    ctx.restore();
  } else if (shape === 'circle') {
    const dia = diameterPx || Math.min(boxW, boxH);
    const cx = x + boxW/2;
    const cy = y + boxH/2;
    const sqX = cx - dia/2;
    const sqY = cy - dia/2;
    const sqW = dia;
    const sqH = dia;

    let iw = img.width, ih = img.height;
    let imgRatio = iw/ih, boxRatio = sqW/sqH;
    let drawW, drawH;
    if (imgRatio > boxRatio) { drawH = sqH; drawW = sqH * imgRatio; } 
    else { drawW = sqW; drawH = sqW / imgRatio; }

    drawW *= adj.scale; drawH *= adj.scale;
    const offsetX = (sqW - drawW)/2 + (adj.offsetX || 0);
    const offsetY = (sqH - drawH)/2 + (adj.offsetY || 0);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, dia/2 - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, sqX + offsetX, sqY + offsetY, drawW, drawH);
    ctx.restore();
  }
}

/* Convert margin mm -> pixels given pxPerCm (pxPerCm uses cm) */
function mmToPx(mm, pxPerCm) {
  return (parseFloat(mm) || 0) / 10 * pxPerCm;
}

/* ---------- Special: render a single A4 margin-only page (preview & pdf) ---------- */
function renderMarginOnlyCanvas(fullW, fullH, pxPerCm, forPreview = false) {
  // fullW/fullH in px (for preview scaled or full)
  const c = document.createElement('canvas');
  c.width = fullW; c.height = fullH;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0,0,fullW,fullH);

  // margins come from window.margin* inputs (values in mm)
  const topPx = mmToPx(window.marginTop ? window.marginTop.value : 2, pxPerCm);
  const leftPx = mmToPx(window.marginLeft ? window.marginLeft.value : 3, pxPerCm);
  const rightPx = mmToPx(window.marginRight ? window.marginRight.value : 2, pxPerCm);
  const bottomPx = mmToPx(window.marginBottom ? window.marginBottom.value : 2, pxPerCm);

  const bt = parseInt(window.borderThickness ? window.borderThickness.value : 2) || 2;
  x.strokeStyle = '#000';
  x.lineWidth = forPreview ? bt * PREVIEW_SCALE : bt;
  // draw rectangle border inset by left/top and sized to page minus left/right/top/bottom
  const rectX = leftPx;
  const rectY = topPx;
  const rectW = fullW - leftPx - rightPx;
  const rectH = fullH - topPx - bottomPx;
  x.strokeRect(rectX, rectY, rectW, rectH);

  return c;
}

/* ========== PREVIEW rendering ========== */
async function renderPreviewPages() {
  const fullW = 2480, fullH = 3508;
  const previewW = fullW * PREVIEW_SCALE;
  const previewH = fullH * PREVIEW_SCALE;
  const pxPerCm = 118 * PREVIEW_SCALE;
  const footerHeightMm = 20, footerPx = (footerHeightMm / 10) * pxPerCm;

  // If borderOnly and no batches => render margin-only preview page
  if (window.borderOnly && window.borderOnly.checked && batches.length === 0) {
    const c = renderMarginOnlyCanvas(previewW, previewH, pxPerCm, true);
    return [c];
  }

  // standard flow with images (if any)
  const marginTopPx = mmToPx(window.marginTop ? window.marginTop.value : 2, pxPerCm);
  const marginLeftPx = mmToPx(window.marginLeft ? window.marginLeft.value : 3, pxPerCm);
  const marginRightPx = mmToPx(window.marginRight ? window.marginRight.value : 2, pxPerCm);
  const marginBottomPx = mmToPx(window.marginBottom ? window.marginBottom.value : 2, pxPerCm);
  const gap = Math.max(0, parseInt(gapInput.value) || 10) * PREVIEW_SCALE;

  const pages = [];
  let page = document.createElement('canvas'); page.width = previewW; page.height = previewH;
  let pctx = page.getContext('2d'); pctx.fillStyle = '#fff'; pctx.fillRect(0,0,previewW,previewH);

  let xPos = marginLeftPx;
  let yPos = marginTopPx;
  let rowMaxH = 0;
  const usableHeight = previewH - marginBottomPx - footerPx;

  let totalFiles = batches.reduce((a,b) => a + b.files.length * (b.copy||1), 0);
  let processed = 0;
  previewBtn.textContent = `🔁 Mengompres 0/${totalFiles} foto...`;

  for (const batch of batches) {
    let wcm, hcm;
    if (batch.size === 'custom') { wcm = batch.customW; hcm = batch.customH; } 
    else { [wcm, hcm] = batch.size.split('x').map(Number); }
    const boxW = wcm * pxPerCm, boxH = hcm * pxPerCm;
    const copies = Math.max(1, batch.copy || 1);

    for (let cp = 0; cp < copies; cp++) {
      for (const fileObj of batch.files) {
        processed++;
        previewBtn.textContent = `🔁 Mengompres ${processed}/${totalFiles} foto...`;
        const img = await loadImageWithEXIF(fileObj.file, "preview");
        if (!img) continue;

        if (xPos + boxW > previewW - marginRightPx) { xPos = marginLeftPx; yPos += rowMaxH + gap; rowMaxH = 0; }
        if (yPos + boxH > usableHeight) {
          pages.push(page);
          page = document.createElement('canvas'); page.width = previewW; page.height = previewH;
          pctx = page.getContext('2d'); pctx.fillStyle = '#fff'; pctx.fillRect(0,0,previewW,previewH);
          xPos = marginLeftPx; yPos = marginTopPx; rowMaxH = 0;
        }

        if (window.borderOnly && window.borderOnly.checked) {
          const bt = parseInt(window.borderThickness.value) || 2;
          pctx.strokeStyle = '#000';
          pctx.lineWidth = bt * PREVIEW_SCALE;
          pctx.strokeRect(xPos, yPos, boxW, boxH);
        } else {
          // adjustments scaled to preview
          const adjScaled = {
            offsetX: (fileObj.adjustments.offsetX || 0) * PREVIEW_SCALE,
            offsetY: (fileObj.adjustments.offsetY || 0) * PREVIEW_SCALE,
            scale: fileObj.adjustments.scale || 1
          };

          if (window.circleMode && window.circleMode.checked) {
            // IMPORTANT: compute diameter in preview px (use pxPerCm already scaled)
            const diameterCm = parseFloat(window.circleDiameter.value) || Math.min(wcm, hcm);
            const diameterPxPreview = diameterCm * pxPerCm; // pxPerCm already PREVIEW_SCALE
            drawImageCoverWithShape(pctx, img, xPos, yPos, boxW, boxH, adjScaled, 'circle', diameterPxPreview);
            // circle border in preview
            pctx.beginPath();
            pctx.lineWidth = Math.max(1, 2 * PREVIEW_SCALE);
            pctx.strokeStyle = '#000';
            const cx = xPos + boxW/2, cy = yPos + boxH/2;
            pctx.arc(cx, cy, (diameterPxPreview/2) - (1 * PREVIEW_SCALE), 0, Math.PI * 2);
            pctx.stroke();
          } else {
            drawImageCoverWithShape(pctx, img, xPos, yPos, boxW, boxH, adjScaled, 'rect');
            pctx.strokeStyle = '#000';
            pctx.lineWidth = 1 * PREVIEW_SCALE;
            pctx.strokeRect(xPos, yPos, boxW, boxH);
          }
        }

        rowMaxH = Math.max(rowMaxH, boxH);
        xPos += boxW + gap;
      }
    }
  }

  previewBtn.textContent = '👁️ Preview Cepat';
  pages.push(page);
  return pages;
}

/* ========== PDF rendering (full resolution canvases) ========== */
async function renderAllPagesToCanvases() {
  const fullW = 2480, fullH = 3508;
  const pxPerCm = 118;
  const footerHeightMm = 20, footerPx = (footerHeightMm / 10) * pxPerCm;

  // If borderOnly and no batches => render margin-only PDF page
  if (window.borderOnly && window.borderOnly.checked && batches.length === 0) {
    const c = renderMarginOnlyCanvas(fullW, fullH, pxPerCm, false);
    // Return single page and used heights for pricing (we set used height small enough)
    return { pages: [c], usedMmPerPage: [ ( (fullH - (mmToPx(window.marginTop ? window.marginTop.value : 2, pxPerCm) + mmToPx(window.marginBottom ? window.marginBottom.value : 2, pxPerCm))) / fullH) * 297 ], totalPhotosCount: 0 };
  }

  // normal flow when images present
  const marginTopPx = mmToPx(window.marginTop ? window.marginTop.value : 2, pxPerCm);
  const marginLeftPx = mmToPx(window.marginLeft ? window.marginLeft.value : 3, pxPerCm);
  const marginRightPx = mmToPx(window.marginRight ? window.marginRight.value : 2, pxPerCm);
  const marginBottomPx = mmToPx(window.marginBottom ? window.marginBottom.value : 2, pxPerCm);

  const gap = Math.max(0, parseInt(gapInput.value) || 10);

  const pages = []; let page = document.createElement('canvas'); page.width = fullW; page.height = fullH;
  let pctx = page.getContext('2d'); pctx.fillStyle = '#fff'; pctx.fillRect(0,0,fullW,fullH);
  let xPos = marginLeftPx, yPos = marginTopPx, rowMaxH = 0; const usableHeight = fullH - marginBottomPx - footerPx;
  let usedHeightPerPagePx = [];

  let totalFiles = batches.reduce((a,b) => a + b.files.length * (b.copy||1), 0);
  let processed = 0;
  generateBtn.textContent = `🔁 Mengompres 0/${totalFiles} foto...`;

  for (const batch of batches) {
    let wcm, hcm;
    if (batch.size === 'custom') { wcm = batch.customW; hcm = batch.customH; } 
    else { [wcm, hcm] = batch.size.split('x').map(Number); }
    const boxW = wcm * pxPerCm, boxH = hcm * pxPerCm;
    const copies = Math.max(1, batch.copy || 1);

    for (let cp = 0; cp < copies; cp++) {
      for (const fileObj of batch.files) {
        processed++;
        generateBtn.textContent = `🔁 Mengompres ${processed}/${totalFiles} foto...`;
        const img = await loadImageWithEXIF(fileObj.file, "pdf");
        if (!img) continue;

        if (xPos + boxW > fullW - marginRightPx) { xPos = marginLeftPx; yPos += rowMaxH + gap; rowMaxH = 0; }
        if (yPos + boxH > usableHeight) { usedHeightPerPagePx.push(yPos); pages.push(page);
          page = document.createElement('canvas'); page.width = fullW; page.height = fullH;
          pctx = page.getContext('2d'); pctx.fillStyle = '#fff'; pctx.fillRect(0,0,fullW,fullH);
          xPos = marginLeftPx; yPos = marginTopPx; rowMaxH = 0; }

        if (window.borderOnly && window.borderOnly.checked) {
          const bt = parseInt(window.borderThickness.value) || 2;
          pctx.strokeStyle = '#000';
          pctx.lineWidth = bt;
          pctx.strokeRect(xPos, yPos, boxW, boxH);
        } else {
          if (window.circleMode && window.circleMode.checked) {
            const diameterCm = parseFloat(window.circleDiameter.value) || Math.min(wcm, hcm);
            const diameterPx = diameterCm * pxPerCm; // full px for PDF
            drawImageCoverWithShape(pctx, img, xPos, yPos, boxW, boxH, fileObj.adjustments, 'circle', diameterPx);
            pctx.beginPath();
            pctx.lineWidth = Math.max(1, 2);
            pctx.strokeStyle = '#000';
            const cx = xPos + boxW/2, cy = yPos + boxH/2;
            pctx.arc(cx, cy, (diameterPx/2) - 1, 0, Math.PI * 2);
            pctx.stroke();
          } else {
            drawImageCoverWithShape(pctx, img, xPos, yPos, boxW, boxH, fileObj.adjustments, 'rect');
            pctx.strokeStyle = '#000';
            pctx.lineWidth = 2;
            pctx.strokeRect(xPos, yPos, boxW, boxH);
          }
        }

        rowMaxH = Math.max(rowMaxH, boxH); xPos += boxW + gap;
      }
    }
  }

  generateBtn.textContent = '📄 Buat Kolase';
  usedHeightPerPagePx.push(yPos);
  pages.push(page);

  // Laprak check (harus 1 baris)
  if (laprakMode.checked) {
    const firstPageUsedMm = usedHeightPerPagePx[0] / fullH * 297;
    if (firstPageUsedMm > 297 / 3) {
      alert('Foto melebihi 1 baris — Mode Laprak dinonaktifkan otomatis.');
      laprakMode.checked = false;
      laprakControls.style.display = 'none';
      modeSelect.disabled = false;
    }
  }

  const canvasHeightMm = 297;
  const usedMmPerPage = usedHeightPerPagePx.map(px => (px/fullH)*canvasHeightMm);
  return { pages, usedMmPerPage, totalPhotosCount: batches.reduce((a,b)=>a+(b.files.length||0)*(b.copy||1),0) };
}

/* Harga logic */
function hitungHargaDariUsedMm(usedMmPerPage){
  let totalHarga = 0;
  const halfPageMm = 297 / 2;
  if (manualHargaCheckbox && manualHargaCheckbox.checked) {
    return parseInt(manualHargaInput.value) || 0;
  }
  usedMmPerPage.forEach(used => {
    totalHarga += used <= halfPageMm ? 1000 : 2000;
  });
  return totalHarga;
}

/* Preview navigation */
function showPageAtIndex(i){
  if(!pagesCache||!pagesCache.length) return;
  currentPageIndex=Math.max(0,Math.min(i,pagesCache.length-1));
  const p=pagesCache[currentPageIndex];
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(p,0,0,canvas.width,canvas.height);
  pageNav.style.display=pagesCache.length>1?'flex':'none';
  pageIndicator.textContent=`Halaman ${currentPageIndex+1} / ${pagesCache.length}`;
  prevPageBtn.disabled=currentPageIndex===0;
  nextPageBtn.disabled=currentPageIndex===pagesCache.length-1;
}

/* Main buttons */
previewBtn.onclick = async () => {
  previewBtn.disabled=true;
  try{
    pagesCache = await renderPreviewPages();
    showPageAtIndex(0);
    await updatePricePreview();
  }catch(err){ console.error(err); alert('Error preview.'); }
  finally{ previewBtn.disabled=false; }
};

generateBtn.onclick = async () => {
  generateBtn.disabled=true;
  try{
    const { pages, usedMmPerPage, totalPhotosCount } = await renderAllPagesToCanvases();

    let totalHarga;
    if (laprakMode.checked) {
      totalHarga = parseInt(laprakPrice.value) || 0;
    } else if (modeSelect.value === 'normal') {
      totalHarga = hitungHargaDariUsedMm(usedMmPerPage);
    } else {
      totalHarga = totalPhotosCount * (parseInt(hargaPerFotoInput.value) || 1000);
    }

    pagesCache = pages;
    showPageAtIndex(0);
    priceDisplay.textContent = `Harga: Rp ${totalHarga.toLocaleString()}`;
  }catch(err){ console.error(err); alert('Error kolase.'); }
  finally{ generateBtn.disabled=false; }
};

prevPageBtn.onclick = () => showPageAtIndex(currentPageIndex-1);
nextPageBtn.onclick = () => showPageAtIndex(currentPageIndex+1);

/* Download PDF: integrated with margin-only mode (no extra button) */
downloadPdf.onclick = async () => {
  // If borderOnly checked and no batches => it's margin-doc mode
  const isMarginDocMode = (window.borderOnly && window.borderOnly.checked && batches.length === 0);

  if (!batches.length && !isMarginDocMode) return alert('Belum ada foto/batch.');
  if (!userName.value.trim() && !isMarginDocMode) {
    alert('Nama harus diisi terlebih dahulu sebelum membuat PDF!');
    return;
  }

  // Ensure preview already available for usual flow; but for margin-doc we can render directly
  downloadPdf.disabled = true;
  downloadPdf.textContent = '⏳ Menyiapkan PDF...';

  try {
    let pages;
    if (isMarginDocMode) {
      // Render margin-only full page(s)
      const { pages: renderedPages } = await (async () => {
        const c = renderMarginOnlyCanvas(2480, 3508, 118, false);
        return { pages: [c] };
      })();
      pages = renderedPages;
    } else {
      if (!pagesCache.length) {
        // render first if not yet
        const result = await renderAllPagesToCanvases();
        pages = result.pages;
      } else {
        pages = pagesCache;
      }
    }

    // When margin-doc mode, force hide name/harga in last page
    let totalHarga = priceDisplay.textContent.replace(/[^\d]/g, '');
    totalHarga = parseInt(totalHarga) || 0;

    // If not margin-doc, draw footer on last page unless hideInfo checked
    if (!isMarginDocMode) {
      const lastCanvas = pages[pages.length - 1];
      const lastCtx = lastCanvas.getContext('2d');
      const fullW = lastCanvas.width, fullH = lastCanvas.height;
      const pxPerCm = 118, footerHeightMm = 20, footerPx = (footerHeightMm / 10) * pxPerCm;
      lastCtx.font = `48px Poppins`;
      lastCtx.fillStyle = '#333';
      const footerX = 100;
      const footerYName = fullH - footerPx + 30, footerYPrice = footerYName + 60;
      if (!hideInfo || !hideInfo.checked) {
        lastCtx.fillText(`Nama: ${userName.value || '-'}`, footerX, footerYName);
        lastCtx.fillText(`Harga: Rp ${totalHarga.toLocaleString()}`, footerX, footerYPrice);
      }
    } else {
      // margin-doc mode: ensure no footer (explicit)
    }

    // Make PDF
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'pt', 'a4');
    pages.forEach((pg, i) => {
      if (i > 0) pdf.addPage();
      pdf.addImage(pg.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 595, 842);
    });
    const pdfBlob = pdf.output('blob');
    window.open(URL.createObjectURL(pdfBlob), '_blank');
  } catch (err) {
    console.error(err);
    alert('Gagal membuat PDF.');
  } finally {
    downloadPdf.disabled = false;
    downloadPdf.textContent = '💾 Buka PDF di Tab Baru';
  }
};

/* Reset */
resetBtn.onclick = () => {
  batches = [];
  refreshBatchList();
  pagesCache = [];
  currentPageIndex = 0;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  priceDisplay.textContent = 'Harga: Rp 0';
  userName.value = 'SEDULUR FOTOCOPY';
  pageNav.style.display = 'none';
  pageIndicator.textContent = 'Halaman 0 / 0';
  laprakMode.checked = false;
  laprakControls.style.display = 'none';
  modeSelect.disabled = false;
  if (manualHargaCheckbox) { manualHargaCheckbox.checked = false; manualHargaBox.style.display = 'none'; }
  if (hideInfo) hideInfo.checked = false;
  // reset injected controls
  if (window.circleMode) { window.circleMode.checked = false; window.circleControls.style.display = 'none'; }
  if (window.borderOnly) { window.borderOnly.checked = false; window.borderControls.style.display = 'none'; }
  if (window.marginTop) { window.marginTop.value = 2; window.marginLeft.value = 3; window.marginRight.value = 2; window.marginBottom.value = 2; }
};

/* Update price preview */
async function updatePricePreview(){
  if(!batches.length && !(window.borderOnly && window.borderOnly.checked)) { priceDisplay.textContent='Harga: Rp 0 (preview)'; return; }
  try{
    const { usedMmPerPage } = await renderAllPagesToCanvases();
    const previewPrice = hitungHargaDariUsedMm(usedMmPerPage);
    priceDisplay.textContent=`Harga: Rp ${previewPrice.toLocaleString()} (preview)`;
  }catch(err){ console.error(err); priceDisplay.textContent='Harga: Rp 0 (preview error)'; }
}

/* ================== Overlay editor for adjustments ================== */
/* Create overlay DOM once */
const overlay = document.createElement('div');
overlay.style.position = 'fixed';
overlay.style.inset = '0';
overlay.style.display = 'none';
overlay.style.justifyContent = 'center';
overlay.style.alignItems = 'center';
overlay.style.background = 'rgba(0,0,0,0.45)';
overlay.style.zIndex = '9999';

overlay.innerHTML = `
  <div id="adjustCard" style="background:#fff;padding:16px;border-radius:12px;max-width:720px;width:92%;box-shadow:0 8px 30px rgba(0,0,0,.25);">
    <div style="display:flex;gap:12px;">
      <canvas id="adjustCanvas" width="420" height="420" style="border-radius:8px;background:#f6f6f6;"></canvas>
      <div style="flex:1;display:flex;flex-direction:column;gap:8px;">
        <div style="font-weight:700">Atur Posisi Gambar</div>
        <div style="font-size:13px;color:#666">Gunakan slider untuk zoom dan tombol arah untuk menggeser posisi.</div>
        <label style="font-size:13px;margin-top:8px;">Zoom (50% - 200%)</label>
        <input id="zoomSlider" type="range" min="0.5" max="2" step="0.01" value="1" style="width:100%">
        <div style="display:flex;gap:6px;justify-content:center;margin-top:6px;">
          <button id="upBtn" class="ok" style="padding:8px 10px">⬆️</button>
        </div>
        <div style="display:flex;gap:6px;justify-content:center;">
          <button id="leftBtn" class="ok" style="padding:8px 10px">⬅️</button>
          <button id="rightBtn" class="ok" style="padding:8px 10px">➡️</button>
        </div>
        <div style="display:flex;gap:6px;justify-content:center;">
          <button id="downBtn" class="ok" style="padding:8px 10px">⬇️</button>
        </div>
        <div style="display:flex;gap:8px;margin-top:auto;">
          <button id="saveAdjust" class="ok" style="flex:1;padding:10px">Simpan</button>
          <button id="cancelAdjust" class="warn" style="flex:1;padding:10px">Batal</button>
        </div>
      </div>
    </div>
  </div>
`;
document.body.appendChild(overlay);

const adjustCanvas = overlay.querySelector('#adjustCanvas');
const aCtx = adjustCanvas.getContext('2d');
const zoomSlider = overlay.querySelector('#zoomSlider');
const upBtn = overlay.querySelector('#upBtn');
const downBtn = overlay.querySelector('#downBtn');
const leftBtn = overlay.querySelector('#leftBtn');
const rightBtn = overlay.querySelector('#rightBtn');
const saveAdjust = overlay.querySelector('#saveAdjust');
const cancelAdjust = overlay.querySelector('#cancelAdjust');

let currentEditing = null; // { batchIndex, fileIndex, img (Image object) }
let snapshotAdjustments = null; // store snapshot to allow Cancel revert

/* Open overlay for a specific file */
async function openAdjustOverlay(batchIndex, fileIndex) {
  const b = batches[batchIndex];
  if (!b) return;
  const fobj = b.files[fileIndex];
  if (!fobj) return;
  // load compressed image for smoother editing
  const img = await loadImageWithEXIF(fobj.file, "preview");
  if (!img) return alert('Gagal memuat gambar untuk diatur.');

  currentEditing = { batchIndex, fileIndex, img };

  // snapshot for cancel
  snapshotAdjustments = Object.assign({}, fobj.adjustments);

  // initialize controls from adjustments
  zoomSlider.value = fobj.adjustments.scale || 1;
  drawAdjustCanvas();

  overlay.style.display = 'flex';
}

/* draw preview in overlay using currentEditing and control values */
function drawAdjustCanvas() {
  if (!currentEditing) return;
  const img = currentEditing.img;
  aCtx.clearRect(0,0,adjustCanvas.width,adjustCanvas.height);
  aCtx.fillStyle = '#fff';
  aCtx.fillRect(0,0,adjustCanvas.width,adjustCanvas.height);

  const boxPadding = 8;
  const boxW = adjustCanvas.width - boxPadding*2;
  const boxH = adjustCanvas.height - boxPadding*2;
  const fobj = batches[currentEditing.batchIndex].files[currentEditing.fileIndex];
  const adj = fobj.adjustments || { offsetX:0, offsetY:0, scale:1 };

  const tempAdj = {
    offsetX: adj.offsetX || 0,
    offsetY: adj.offsetY || 0,
    scale: parseFloat(zoomSlider.value) || 1
  };

  if (window.circleMode && window.circleMode.checked) {
    // compute diameter in preview px for visualization in overlay
    const pxPerCmPreview = 118 * PREVIEW_SCALE;
    const diameterCm = parseFloat(window.circleDiameter.value) || Math.min(boxW/pxPerCmPreview, boxH/pxPerCmPreview);
    const diameterPx = diameterCm * pxPerCmPreview;
    drawImageCoverWithShape(aCtx, img, boxPadding, boxPadding, boxW, boxH, tempAdj, 'circle', diameterPx);
    aCtx.beginPath();
    aCtx.lineWidth = Math.max(1, 2);
    aCtx.strokeStyle = '#333';
    const cx = boxPadding + boxW/2, cy = boxPadding + boxH/2;
    aCtx.arc(cx, cy, Math.max(0, (diameterPx/2)-2), 0, Math.PI*2);
    aCtx.stroke();
  } else {
    drawImageCoverWithShape(aCtx, img, boxPadding, boxPadding, boxW, boxH, tempAdj, 'rect');
    aCtx.strokeStyle = '#ddd';
    aCtx.lineWidth = 2;
    aCtx.strokeRect(boxPadding, boxPadding, boxW, boxH);
  }
}

/* Arrow buttons modify adjustments by step pixels */
const STEP = 10;
upBtn.onclick = () => { modifyOffset(0, -STEP); };
downBtn.onclick = () => { modifyOffset(0, STEP); };
leftBtn.onclick = () => { modifyOffset(-STEP, 0); };
rightBtn.onclick = () => { modifyOffset(STEP, 0); };

function modifyOffset(dx, dy) {
  if (!currentEditing) return;
  const fobj = batches[currentEditing.batchIndex].files[currentEditing.fileIndex];
  fobj.adjustments.offsetX = (fobj.adjustments.offsetX || 0) + dx;
  fobj.adjustments.offsetY = (fobj.adjustments.offsetY || 0) + dy;
  drawAdjustCanvas();
}

/* Zoom slider updates scale */
zoomSlider.oninput = () => {
  if (!currentEditing) return;
  const fobj = batches[currentEditing.batchIndex].files[currentEditing.fileIndex];
  fobj.adjustments.scale = parseFloat(zoomSlider.value);
  drawAdjustCanvas();
};

/* Save / Cancel buttons */
saveAdjust.onclick = () => {
  overlay.style.display = 'none';
  currentEditing = null;
  snapshotAdjustments = null;
  refreshBatchList();
};
cancelAdjust.onclick = () => {
  if (currentEditing && snapshotAdjustments) {
    const fobj = batches[currentEditing.batchIndex].files[currentEditing.fileIndex];
    fobj.adjustments = Object.assign({}, snapshotAdjustments);
  }
  overlay.style.display = 'none';
  currentEditing = null;
  snapshotAdjustments = null;
  refreshBatchList();
};

/* Close overlay when clicking outside card */
overlay.addEventListener('click', (ev) => {
  if (ev.target === overlay) {
    overlay.style.display = 'none';
  }
});

/* Init */
ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);

// optional debug export
// window._batches = batches;
