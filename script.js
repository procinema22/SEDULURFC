/* script.js v2.5 - all-in: fixes + loading overlay + tombol berubah merah setelah kolase */

/* ---------------------------
   Element refs
   --------------------------- */
   const upload = document.getElementById('upload');
   const canvas = document.getElementById('canvas');
   const ctx = canvas.getContext('2d');
   const sizeSelect = document.getElementById('sizeSelect');
   const customSize = document.getElementById('customSize');
   const customW = document.getElementById('customW');
   const customH = document.getElementById('customH');
   const marginInputMm = document.getElementById('marginInputMm');
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
   if (hargaPerFotoInput && !hargaPerFotoInput.value) hargaPerFotoInput.value = '1000';
   const prevPageBtn = document.getElementById('prevPage');
   const nextPageBtn = document.getElementById('nextPage');
   const pageIndicator = document.getElementById('pageIndicator');
   const pageNav = document.getElementById('pageNav');
   const darkSwitch = document.getElementById('darkSwitch');
   const circleControls = document.getElementById('circleControls');
   const circleDiameter = document.getElementById('circleDiameter');
   const laprakMode = document.getElementById('laprakMode');
   const laprakControls = document.getElementById('laprakControls');
   const laprakPrice = document.getElementById('laprakPrice');
   const manualHargaCheckbox = document.getElementById('manualHargaCheckbox');
   const manualHargaBox = document.getElementById('manualHargaBox');
   const manualHargaInput = document.getElementById('manualHargaInput');
   const hideInfo = document.getElementById('hideInfo');
   
   /* ---------------------------
      App state
      --------------------------- */
   let batches = []; // {files, size/customW/customH, copy, mode}
   let placementsByPage = []; // per page placements
   let pagesCache = []; // canvases for preview
   let currentPageIndex = 0;
   let selectedPlacement = null;
   
   const PREVIEW_SCALE = 0.25;
   const PX_PER_CM = 118;
   const STORAGE_KEY = 'cetakfoto_v2_placements';
   
   /* ---------------------------
      Inject loading overlay CSS + DOM
      (so user doesn't need to edit HTML/CSS)
      --------------------------- */
   (function injectLoadingOverlay() {
     const css = `
     /* overlay injected by script.js v2.5 */
     #loadingOverlay_kolase {
       position: fixed;
       inset: 0;
       display: none;
       background: rgba(0,0,0,0.42);
       align-items: center;
       justify-content: center;
       z-index: 99999;
     }
     #loadingOverlay_kolase.active { display:flex; }
     .spinner_kolase {
       width: 68px;
       height: 68px;
       border-radius: 50%;
       border: 6px solid rgba(255,255,255,0.85);
       border-top-color: rgba(33,150,243,1);
       animation: spin_kolase 0.8s linear infinite;
       box-shadow: 0 6px 18px rgba(0,0,0,0.4);
     }
     @keyframes spin_kolase { to { transform: rotate(360deg); } }
   
     /* kolase-done class for generateBtn */
     .kolase-done {
       transition: background-color 420ms cubic-bezier(.2,.8,.2,1), transform 220ms;
       background-color: #b71c1c !important; /* merah gelap elegan */
       box-shadow: 0 6px 18px rgba(183,28,28,0.25) !important;
       color: #fff !important;
       transform: translateY(-1px);
     }
     .kolase-reset-transition {
       transition: background-color 420ms cubic-bezier(.2,.8,.2,1), box-shadow 320ms;
     }
     `;
     const style = document.createElement('style');
     style.setAttribute('data-generated', 'script-v2.5');
     style.appendChild(document.createTextNode(css));
     document.head.appendChild(style);
   
     const overlay = document.createElement('div');
     overlay.id = 'loadingOverlay_kolase';
     overlay.innerHTML = `<div class="spinner_kolase" aria-hidden="true"></div>`;
     document.body.appendChild(overlay);
   })();
   
   /* ---------------------------
      Theme init
      --------------------------- */
   (function initTheme() {
     const saved = localStorage.getItem('theme');
     if (saved === 'dark') {
       document.body.classList.add('dark');
       if (darkSwitch) darkSwitch.classList.add('on');
     }
   })();
   if (darkSwitch) darkSwitch.addEventListener('click', () => {
     document.body.classList.toggle('dark');
     const on = document.body.classList.contains('dark');
     darkSwitch.classList.toggle('on', on);
     localStorage.setItem('theme', on ? 'dark' : 'light');
   });
   
   /* ---------------------------
      UI interactions
      --------------------------- */
      if (modeSelect) modeSelect.onchange = async () => {
        // 💾 simpan posisi sebelum mode diganti
        saveAllPlacementData();
      
        // tampilkan elemen sesuai mode
        if (hargaPerFotoBox) hargaPerFotoBox.style.display = modeSelect.value === 'perfoto' ? 'block' : 'none';
        if (circleControls) circleControls.style.display = modeSelect.value === 'circle' ? 'block' : 'none';
      
        // jika user berpindah ke mode circle, muat ulang placement agar posisi tetap sama
        if (modeSelect.value === 'circle' && batches.length) {
          await buildPlacementsForPages();
          pagesCache = [];
          showPageAtIndex(0);
        }
      
        updatePricePreview();
      };
      
  
   if (sizeSelect) sizeSelect.onchange = () => { if (customSize) customSize.style.display = sizeSelect.value === 'custom' ? 'flex' : 'none'; };
   if (laprakMode) laprakMode.onchange = () => { if (laprakControls) laprakControls.style.display = laprakMode.checked ? 'block' : 'none'; if (modeSelect) modeSelect.disabled = laprakMode.checked; updatePricePreview();};
   if (manualHargaCheckbox) manualHargaCheckbox.onchange = () => { if (manualHargaBox) manualHargaBox.style.display = manualHargaCheckbox.checked ? 'block' : 'none'; updatePricePreview(); };
   
   /* ---------------------------
      helper file key
      --------------------------- */
   function fileKeyFor(file) {
     try { return `${file.name}_${file.size || 0}_${file.lastModified || 0}`; } catch (e) { return file.name; }
   }
   
   /* ---------------------------
      persistence
      --------------------------- */
   function saveAllPlacementData() {
     const flat = [];
     placementsByPage.forEach(page => {
       (page || []).forEach(pl => {
         if (!pl.fileKey) return;
         flat.push({ key: pl.fileKey, offsetX: pl.offsetX || 0, offsetY: pl.offsetY || 0, scale: pl.scale || 1 });
       });
     });
     try { localStorage.setItem(STORAGE_KEY, JSON.stringify(flat)); } catch (e) { /* ignore */ }
   }
   function loadSavedForKey(key) {
     const raw = localStorage.getItem(STORAGE_KEY);
     if (!raw) return null;
     try { const arr = JSON.parse(raw); return arr.find(x => x.key === key) || null; } catch (e) { return null; }
   }
   
   /* ---------------------------
      upload
      --------------------------- */
   if (upload) upload.onchange = async e => {
     const files = Array.from(e.target.files || []);
     if (!files.length) return;
     const mode = (modeSelect && modeSelect.value) || 'normal';
     if (sizeSelect && sizeSelect.value === 'custom') {
       const cw = parseFloat(customW.value), ch = parseFloat(customH.value);
       if (!cw || !ch) batches.push({ files, size: '2x3', copy: 1, mode });
       else batches.push({ files, size: 'custom', customW: cw, customH: ch, copy: 1, mode });
     } else {
       batches.push({ files, size: sizeSelect ? sizeSelect.value : '2x3', copy: 1, mode });
     }
     upload.value = '';
     refreshBatchList();
     await updatePricePreview();
   };
   
   function refreshBatchList() {
     if (!batchList) return;
     batchList.innerHTML = '';
     batches.forEach((b, i) => {
       const row = document.createElement('div'); row.className = 'batch-row';
       const sizeText = b.size === 'custom' ? `${b.customW}x${b.customH} cm` : (b.size ? b.size.replace('x', ' x ') : 'unknown');
       row.innerHTML = `<div style="flex:1"><strong>Batch ${i+1}</strong><div class="small">${(b.files||[]).length} foto — ${sizeText} — mode: ${b.mode||'normal'}</div></div>`;
       const copies = document.createElement('input');
       copies.type = 'number'; copies.value = b.copy || 1; copies.min = 1; copies.style.width = '60px';
       copies.onchange = async () => { b.copy = Math.max(1, parseInt(copies.value) || 1); await updatePricePreview(); };
       const del = document.createElement('button'); del.textContent = '❌'; del.className = 'warn';
       del.onclick = async () => { batches.splice(i, 1); refreshBatchList(); await updatePricePreview(); };
       row.append(copies, del);
       batchList.appendChild(row);
     });
     batchList.style.display = batches.length ? 'block' : 'none';
   }
   
   /* ---------------------------
      image load w/ EXIF
      --------------------------- */
   function loadImageWithEXIF(file, mode = "preview") {
     return new Promise(res => {
       try {
         const reader = new FileReader();
         reader.onload = e => {
           const img = new Image();
           img.onerror = () => { console.warn(`Gagal memuat: ${file.name}`); res(null); };
           EXIF.getData(file, function () {
             const o = EXIF.getTag(this, 'Orientation');
             img.onload = () => {
               const maxDim = mode === "pdf" ? 2500 : 1500;
               const quality = mode === "pdf" ? 0.92 : 0.8;
               let iw = img.width, ih = img.height;
               let scale = Math.min(1, maxDim / Math.max(iw, ih));
               const newW = Math.round(iw * scale);
               const newH = Math.round(ih * scale);
               const c = document.createElement('canvas');
               const x = c.getContext('2d');
               if (o >= 5 && o <= 8) { c.width = newH; c.height = newW; } else { c.width = newW; c.height = newH; }
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
               compressed.onerror = () => res(null);
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
   
   /* ---------------------------
      draw helpers
      --------------------------- */
   function drawImageCover(ctx, img, x, y, boxW, boxH, rotateLandscapeToPortrait = true) {
     let iw = img.width, ih = img.height; let rotate = false;
     if (rotateLandscapeToPortrait && iw > ih) { rotate = true; [iw, ih] = [ih, iw]; }
     const imgRatio = iw / ih; const boxRatio = boxW / boxH;
     let drawW, drawH;
     if (imgRatio > boxRatio) { drawH = boxH; drawW = boxH * imgRatio; } else { drawW = boxW; drawH = boxW / imgRatio; }
     const offsetX = x + (boxW - drawW) / 2; const offsetY = y + (boxH - drawH) / 2;
     ctx.save(); ctx.beginPath(); ctx.rect(x + 1, y + 1, boxW - 2, boxH - 2); ctx.clip();
     if (rotate) {
       const cx = x + boxW / 2, cy = y + boxH / 2; ctx.translate(cx, cy); ctx.rotate(-0.5 * Math.PI);
       ctx.drawImage(img, -drawH / 2, -drawW / 2, drawH, drawW);
     } else { ctx.drawImage(img, offsetX, offsetY, drawW, drawH); }
     ctx.restore();
   }
   
   function drawCirclePlacement(ctx, placement) {
     const { imgObj, x, y, diameterPx, offsetX = 0, offsetY = 0, scale = 1 } = placement;
     const radius = diameterPx / 2;
     const cx = x + radius, cy = y + radius;
     ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2); ctx.clip();
     const iw = imgObj.width, ih = imgObj.height;
     const imgRatio = iw / ih;
     let drawW, drawH;
     if (imgRatio >= 1) { drawH = diameterPx * scale; drawW = drawH * imgRatio; } else { drawW = diameterPx * scale; drawH = drawW / imgRatio; }
     const drawX = cx - drawW / 2 + offsetX; const drawY = cy - drawH / 2 + offsetY;
     ctx.drawImage(imgObj, drawX, drawY, drawW, drawH);
     ctx.restore();
     ctx.beginPath(); ctx.lineWidth = 2; ctx.strokeStyle = (placement === selectedPlacement) ? '#1e88e5' : '#000';
     ctx.arc(cx, cy, radius - 1, 0, Math.PI * 2); ctx.stroke();
   }
   
   /* ---------------------------
      build placements (support mixed modes)
      --------------------------- */
   async function buildPlacementsForPages() {
     placementsByPage = [];
     const fullW = 2480, fullH = 3508;
     const pxPerCm = PX_PER_CM;
     const marginPx = (Math.max(0, parseFloat(marginInputMm.value) || 1) / 10) * pxPerCm;
     const gap = Math.max(0, parseInt(gapInput.value) || 10);
     let pageIdx = 0;
     placementsByPage[pageIdx] = [];
     let x = marginPx, y = marginPx, rowMaxH = 0;
   
     for (const batch of batches) {
       const mode = batch.mode || 'normal';
       if (mode === 'circle') {
         const diameterCm = parseFloat(circleDiameter.value) || 4;
         const diameterPx = diameterCm * pxPerCm;
         for (let cp = 0; cp < Math.max(1, batch.copy || 1); cp++) {
           for (const file of batch.files) {
             const imgObj = await loadImageWithEXIF(file, 'preview'); if (!imgObj) continue;
             if (x + diameterPx > fullW - marginPx) { x = marginPx; y += rowMaxH + gap; rowMaxH = 0; }
             if (y + diameterPx > fullH - marginPx) { pageIdx++; placementsByPage[pageIdx] = []; x = marginPx; y = marginPx; rowMaxH = 0; }
             const key = fileKeyFor(file);
             const saved = loadSavedForKey(key);
             placementsByPage[pageIdx].push({
               file, fileKey: key, imgObj, x, y, diameterPx, isCircle: true,
               offsetX: saved ? saved.offsetX : 0,
               offsetY: saved ? saved.offsetY : 0,
               scale: saved ? saved.scale : 1
             });
             rowMaxH = Math.max(rowMaxH, diameterPx); x += diameterPx + gap;
           }
         }
       } else {
         let wcm, hcm;
         if (batch.size === 'custom') { wcm = batch.customW; hcm = batch.customH; } else { [wcm, hcm] = (batch.size || '2x3').split('x').map(Number); }
         const boxW = wcm * pxPerCm, boxH = hcm * pxPerCm;
         for (let cp = 0; cp < Math.max(1, batch.copy || 1); cp++) {
           for (const file of batch.files) {
             const imgObj = await loadImageWithEXIF(file, 'preview'); if (!imgObj) continue;
             if (x + boxW > fullW - marginPx) { x = marginPx; y += rowMaxH + gap; rowMaxH = 0; }
             if (y + boxH > fullH - marginPx) { pageIdx++; placementsByPage[pageIdx] = []; x = marginPx; y = marginPx; rowMaxH = 0; }
             const key = fileKeyFor(file);
             const saved = loadSavedForKey(key);
             placementsByPage[pageIdx].push({
               file, fileKey: key, imgObj, x, y, boxW, boxH,
               offsetX: saved ? saved.offsetX : 0,
               offsetY: saved ? saved.offsetY : 0,
               scale: saved ? saved.scale : 1,
               isRectangle: true
             });
             rowMaxH = Math.max(rowMaxH, boxH); x += boxW + gap;
           }
         }
       }
     }
   }
   
   /* ---------------------------
      render preview for page
      --------------------------- */
   function renderPreviewFromPlacements(pageIndex) {
     const fullW = 2480, fullH = 3508;
     const previewW = fullW * PREVIEW_SCALE, previewH = fullH * PREVIEW_SCALE;
     const scale = PREVIEW_SCALE;
     const pc = document.createElement('canvas'); pc.width = previewW; pc.height = previewH;
     const pctx = pc.getContext('2d'); pctx.fillStyle = '#fff'; pctx.fillRect(0, 0, previewW, previewH);
     const placements = placementsByPage[pageIndex] || [];
     for (const p of placements) {
       if (p.isRectangle) {
         const r = Object.assign({}, p);
         r.x = Math.round(p.x * scale); r.y = Math.round(p.y * scale); r.boxW = Math.round(p.boxW * scale); r.boxH = Math.round(p.boxH * scale);
         drawImageCover(pctx, p.imgObj, r.x, r.y, r.boxW, r.boxH, true);
         pctx.strokeStyle = '#000'; pctx.lineWidth = 2; pctx.strokeRect(r.x, r.y, r.boxW, r.boxH);
       } else {
         const cp = Object.assign({}, p);
         cp.x = Math.round(p.x * scale); cp.y = Math.round(p.y * scale); cp.diameterPx = Math.round(p.diameterPx * scale);
         cp.offsetX = Math.round((p.offsetX || 0) * scale); cp.offsetY = Math.round((p.offsetY || 0) * scale); cp.scale = p.scale || 1;
         cp.imgObj = p.imgObj;
         drawCirclePlacement(pctx, cp);
       }
     }
     return pc;
   }
   
   /* ---------------------------
      render all pages (full-res)
      --------------------------- */
   async function renderAllPagesToCanvases() {
     const fullW = 2480, fullH = 3508;
     const pxPerCm = PX_PER_CM;
     const marginPx = (Math.max(0, parseFloat(marginInputMm.value) || 1) / 10) * pxPerCm;
     const pages = []; const usedHeightPerPagePx = []; // per-page used height considering only circle placements
     for (let pi = 0; pi < (placementsByPage.length || 0); pi++) {
       const pagePlacements = placementsByPage[pi] || [];
       const pageCanvas = document.createElement('canvas'); pageCanvas.width = fullW; pageCanvas.height = fullH;
       const pctx = pageCanvas.getContext('2d'); pctx.fillStyle = '#fff'; pctx.fillRect(0, 0, fullW, fullH);
       let usedY = marginPx;
       for (const pl of pagePlacements) {
         const imgHigh = await loadImageWithEXIF(pl.file, 'pdf'); if (!imgHigh) continue;
         const placementHigh = Object.assign({}, pl); placementHigh.imgObj = imgHigh;
         if (pl.isRectangle) {
           drawImageCover(pctx, imgHigh, pl.x, pl.y, pl.boxW, pl.boxH, true);
           pctx.strokeStyle = '#000'; pctx.lineWidth = 2; pctx.strokeRect(pl.x, pl.y, pl.boxW, pl.boxH);
           usedY = Math.max(usedY, pl.y + pl.boxW ? pl.boxH : 0); // ensure usedY moves
         } else {
           drawCirclePlacement(pctx, placementHigh);
           usedY = Math.max(usedY, pl.y + pl.diameterPx);
         }
       }
       usedHeightPerPagePx.push(usedY);
       pages.push(pageCanvas);
     }
     return { pages, usedHeightPerPagePx,  };
   }
   
   /* ---------------------------
      pricing helpers
      --------------------------- */
   function priceFromUsedHeightsArray(usedHeightPxArray) {
     const pxToMm = 297 / 3508;
     const halfPageMm = 297 / 2;
     let total = 10;
     usedHeightPxArray.forEach(px => {
       if (!px || px <= 0) return;
       const usedMm = px * pxToMm;
       total += (usedMm <= halfPageMm) ? 1000 : 2000;
     });
     return total;
   }
   function countPerfotoFromBatches(batches) {
     let cnt = 0;
     for (const b of batches) {
       const cp = Math.max(1, b.copy || 1);
       const fileCount = (b.files && b.files.length) ? b.files.length * cp : 0;
       if (b.mode === 'perfoto') cnt += fileCount;
     }
     return cnt;
   }
   
   /* ---------------------------
      unified price compute
      --------------------------- */
   async function computeTotalPriceForPreviewOrGenerate() {
     const { pages, usedHeightPerPagePx,  } = await renderAllPagesToCanvases();
     const laprakPriceTotal = laprakMode && laprakMode.checked ? priceFromUsedHeightsArray(usedHeightPerPagePx) : 0;

// harga universal per halaman untuk semua mode kecuali perfoto
// dipisah dari mode perfoto
let normalPagePrice = 0;
if (!laprakMode || !laprakMode.checked){
  normalPagePrice = priceFromUsedHeightsArray(usedHeightPerPagePx);
}

const perFotoCount = countPerfotoFromBatches(batches);
const hargaPerFoto = parseInt(hargaPerFotoInput ? hargaPerFotoInput.value : '1000') || 1000;
const perfotoTotal = perFotoCount * hargaPerFoto;
if (manualHargaCheckbox && manualHargaCheckbox.checked) {
       // if manual override, return numeric value for compatibility (we handle both cases)
       return parseInt(manualHargaInput.value) || 0;
     }
   
     const grandTotal = laprakPriceTotal + normalPagePrice + perfotoTotal;
return { grandTotal, laprakPriceTotal, normalPagePrice, perfotoTotal, pagesCount: pages.length, pages, usedHeightPerPagePx };

   }
   
   /* ---------------------------
      updatePricePreview (safe)
      --------------------------- */
   async function updatePricePreview() {
     if (!batches.length) { priceDisplay.textContent = 'Harga: Rp 0 (preview)'; return; }
     try {
       
    await buildPlacementsForPages();

const result = await computeTotalPriceForPreviewOrGenerate();
       const total = (typeof result === 'object' && result !== null)
         ? (result.grandTotal || 0)
         : (parseInt(result) || 0);
       priceDisplay.textContent = `Harga: Rp ${total.toLocaleString()} (preview)`;
     } catch (err) {
       console.error(err);
       priceDisplay.textContent = 'Harga: Rp 0 (preview error)';
     }
   }
   
   /* ---------------------------
      preview button
      --------------------------- */
   if (previewBtn) previewBtn.onclick = async () => {
     previewBtn.disabled = true;
     try {
       await buildPlacementsForPages();
       const result = await renderAllPagesToCanvases();
       pagesCache = result.pages || [];
       showPageAtIndex(0);
       await updatePricePreview();
     } catch (err) {
       console.error(err); alert('Error preview.');
     } finally { previewBtn.disabled = false; }
   };
   
   /* ---------------------------
      show page
      --------------------------- */
   function showPageAtIndex(i) {
     if (!pagesCache || !pagesCache.length) return;
     currentPageIndex = Math.max(0, Math.min(i, pagesCache.length - 1));
     const p = pagesCache[currentPageIndex];
     ctx.clearRect(0, 0, canvas.width, canvas.height);
     ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
     ctx.drawImage(p, 0, 0, canvas.width, canvas.height);
     if (pageNav) pageNav.style.display = pagesCache.length > 1 ? 'flex' : 'none';
     if (pageIndicator) pageIndicator.textContent = `Halaman ${currentPageIndex + 1} / ${pagesCache.length}`;
     if (prevPageBtn) prevPageBtn.disabled = currentPageIndex === 0;
     if (nextPageBtn) nextPageBtn.disabled = currentPageIndex === pagesCache.length - 1;
   }
   
   /* ---------------------------
      page nav
      --------------------------- */
   if (prevPageBtn) prevPageBtn.onclick = () => showPageAtIndex(currentPageIndex - 1);
   if (nextPageBtn) nextPageBtn.onclick = () => showPageAtIndex(currentPageIndex + 1);
   
   /* ---------------------------
      select, drag, zoom interactions
      --------------------------- */
   let isDragging = false; let dragStart = null;
   canvas.addEventListener('mousedown', (ev) => {
     if (!placementsByPage.length) return;
     const rect = canvas.getBoundingClientRect(); const mx = ev.clientX - rect.left; const my = ev.clientY - rect.top;
     const scale = PREVIEW_SCALE; selectedPlacement = null;
     const placements = placementsByPage[currentPageIndex] || [];
     for (const p of placements) {
       if (p.isRectangle) {
         if (mx >= p.x * scale && mx <= (p.x + p.boxW) * scale && my >= p.y * scale && my <= (p.y + p.boxH) * scale) { selectedPlacement = p; break; }
       } else {
         const cx = p.x * scale + (p.diameterPx * scale) / 2; const cy = p.y * scale + (p.diameterPx * scale) / 2;
         const r = (p.diameterPx * scale) / 2; if (Math.hypot(mx - cx, my - cy) <= r) { selectedPlacement = p; break; }
       }
     }
     if (selectedPlacement) {
       isDragging = true;
       dragStart = { x: ev.clientX, y: ev.clientY, origOffsetX: selectedPlacement.offsetX || 0, origOffsetY: selectedPlacement.offsetY || 0 };
       canvas.classList.add('dragging');
       pagesCache[currentPageIndex] = renderPreviewFromPlacements(currentPageIndex); showPageAtIndex(currentPageIndex);
     }
   });
   canvas.addEventListener('mousemove', (ev) => {
     if (!isDragging || !selectedPlacement) return;
     const dx = ev.clientX - dragStart.x; const dy = ev.clientY - dragStart.y;
     const moveX_full = dx / PREVIEW_SCALE; const moveY_full = dy / PREVIEW_SCALE;
     selectedPlacement.offsetX = dragStart.origOffsetX + moveX_full; selectedPlacement.offsetY = dragStart.origOffsetY + moveY_full;
     pagesCache[currentPageIndex] = renderPreviewFromPlacements(currentPageIndex); showPageAtIndex(currentPageIndex);
   });
   canvas.addEventListener('mouseup', () => {
     if (isDragging && selectedPlacement) { isDragging = false; dragStart = null; canvas.classList.remove('dragging'); saveAllPlacementData(); }
   });
   canvas.addEventListener('mouseleave', () => { if (isDragging) { isDragging = false; dragStart = null; canvas.classList.remove('dragging'); saveAllPlacementData(); } });
   
   canvas.addEventListener('wheel', (ev) => {
     if (!selectedPlacement) return;
     ev.preventDefault();
     const delta = ev.deltaY < 0 ? 0.05 : -0.05;
     selectedPlacement.scale = Math.max(0.2, (selectedPlacement.scale || 1) + delta);
     pagesCache[currentPageIndex] = renderPreviewFromPlacements(currentPageIndex); showPageAtIndex(currentPageIndex);
     saveAllPlacementData();
   }, { passive: false });
   
   /* =========================
      RESET TOTAL — (enhanced)
      ========================= */
   if (resetBtn) resetBtn.addEventListener("click", async (e) => {
     e.preventDefault();
   
     // Bersihkan semua state utama
     batches = [];
     placementsByPage = [];
     pagesCache = [];
     currentPageIndex = 0;
     selectedPlacement = null;
   
     // Hapus data tersimpan
     try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
   
     // Bersihkan kanvas
     ctx.clearRect(0, 0, canvas.width, canvas.height);
     ctx.fillStyle = "#fff";
     ctx.fillRect(0, 0, canvas.width, canvas.height);
   
     // Reset UI
     if (batchList) batchList.innerHTML = "";
     if (priceDisplay) priceDisplay.textContent = "Harga: Rp 0";
     if (modeSelect) modeSelect.value = "normal";
     if (circleControls) circleControls.style.display = "none";
     if (laprakControls) laprakControls.style.display = "none";
     if (laprakMode) laprakMode.checked = false;
     if (manualHargaCheckbox) manualHargaCheckbox.checked = false;
     if (manualHargaBox) manualHargaBox.style.display = "none";
     if (hideInfo) hideInfo.checked = false;
     if (userName) userName.value = "";
   
     // Reset inputs
     document.querySelectorAll('input[type="file"]').forEach(inp => inp.value = "");
     if (sizeSelect) sizeSelect.value = "2x3";
     if (customSize) customSize.style.display = "none";
     if (marginInputMm) marginInputMm.value = "5";
     if (gapInput) gapInput.value = "20";
     if (hargaPerFotoInput) hargaPerFotoInput.value = "1000";
   
     // Sembunyikan navigasi halaman
     if (pageNav) pageNav.style.display = "none";
   
     // Kembalikan tampilan tombol generate ke semula (hapus kelas kolase-done)
     if (generateBtn) {
       generateBtn.classList.remove('kolase-done');
       generateBtn.classList.add('kolase-reset-transition');
       // remove transition class after transition finished to keep DOM clean
       setTimeout(() => generateBtn.classList.remove('kolase-reset-transition'), 600);
     }
   
     // hide overlay jika tersisa
     const overlay = document.getElementById('loadingOverlay_kolase');
     if (overlay) overlay.classList.remove('active');
   });
   
   /* ---------------------------
      generate (with overlay + color change)
      --------------------------- */
   if (generateBtn) generateBtn.onclick = async () => {
     const overlay = document.getElementById('loadingOverlay_kolase');
     // show overlay
     if (overlay) overlay.classList.add('active');
   
     // disable button during process
     generateBtn.disabled = true;
   
     try {
       await buildPlacementsForPages();
       const result = await computeTotalPriceForPreviewOrGenerate();
       // result might be a number (manual override) or object
       pagesCache = (result && result.pages) ? result.pages : (result && result.length ? result : (Array.isArray(result.pages) ? result.pages : pagesCache));
       // if pages included in result use them, else attempt to renderAllPagesToCanvases for final pages
       if (!pagesCache || !pagesCache.length) {
         const r = await renderAllPagesToCanvases();
         pagesCache = r.pages || pagesCache;
       }
       showPageAtIndex(0);
   
       // calculate totalHarga robustly
       let totalHarga = 0;
       if (typeof result === 'object' && result !== null) totalHarga = result.grandTotal || 0;
       else totalHarga = parseInt(result) || 0;
       priceDisplay.textContent = `Harga: Rp ${totalHarga.toLocaleString()}`;
   
       // mark button as done (change color to merah gelap elegan)
       generateBtn.classList.add('kolase-done');
     } catch (err) {
       console.error(err);
       alert('Terjadi kesalahan saat membuat kolase.');
     } finally {
       // hide overlay & re-enable button
       const o = document.getElementById('loadingOverlay_kolase');
       if (o) o.classList.remove('active');
       generateBtn.disabled = false;
     }
   };
   
   /* ---------------------------
      download pdf
      --------------------------- */
   if (downloadPdf) downloadPdf.onclick = async () => {
     if (!batches.length) return alert('Belum ada foto/batch.');
     if (!userName.value.trim()) return alert('Nama harus diisi terlebih dahulu sebelum membuat PDF!');
     if (!pagesCache.length) return alert('Silakan klik "📄 Buat Kolase" terlebih dahulu sebelum membuka PDF.');
     downloadPdf.disabled = true; downloadPdf.textContent = '⏳ Menyiapkan PDF...';
     try {
       const pages = pagesCache;
       // Attach footer (last page)
       let totalHarga = 0;
       try { totalHarga = parseInt(priceDisplay.textContent.replace(/[^\d]/g, '')) || 0; } catch (e) { totalHarga = 0; }
       const lastCanvas = pages[pages.length - 1]; const lastCtx = lastCanvas.getContext('2d');
       const fullW = lastCanvas.width, fullH = lastCanvas.height;
       const pxPerCm = PX_PER_CM, footerHeightMm = 20, footerPx = (footerHeightMm / 10) * pxPerCm;
       const footerX = 100;
       const footerYName = fullH - footerPx + 30, footerYPrice = footerYName + 60;
       if (!hideInfo || !hideInfo.checked) {
         lastCtx.font = `48px Poppins`; lastCtx.fillStyle = '#333';
         lastCtx.fillText(`Nama: ${userName.value || '-'}`, footerX, footerYName);
         lastCtx.fillText(`Harga: Rp ${totalHarga.toLocaleString()}`, footerX, footerYPrice);
       }
       // build PDF
       const { jsPDF } = window.jspdf;
       const pdf = new jsPDF('p', 'pt', 'a4');
       pages.forEach((pg, i) => {
         if (i > 0) pdf.addPage();
         pdf.addImage(pg.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 595, 842);
       });
       const blob = pdf.output('blob');
       window.open(URL.createObjectURL(blob), '_blank');
     } catch (err) {
       console.error(err);
       alert('Gagal membuat PDF.');
     } finally { downloadPdf.disabled = false; downloadPdf.textContent = '💾 Buka PDF di Tab Baru'; }
   };
   
   /* ---------------------------
      save on unload
      --------------------------- */
   window.addEventListener('beforeunload', () => saveAllPlacementData());
   
   /* ---------------------------
      initial blank
      --------------------------- */
   ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
   
   /* ---------------------------
      safe resetPosLingkaran listener (if exists)
      --------------------------- */
   const btnResetLingkaran = document.getElementById('resetPosLingkaran');
   if (btnResetLingkaran) {
     btnResetLingkaran.addEventListener('click', () => {
       if (typeof lingkaranImages === 'undefined' || !Array.isArray(lingkaranImages)) return;
       lingkaranImages.forEach(img => {
         img.x = canvas.width / 2;
         img.y = canvas.height / 2;
         img.scale = 1;
       });
       if (typeof drawCircleMode === 'function') drawCircleMode();
     });
   }
   