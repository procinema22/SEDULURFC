/* script.js
   Semua komentar dalam Bahasa Indonesia.
   - Fitur: cover crop, auto-rotate landscape->portrait,
     multi-batch, multi-page A4 portrait, footer hanya mode normal,
     harga otomatis berdasarkan jumlah halaman (≤½A4=1000, >½A4=2000),
     compress otomatis untuk file >500MB, buka PDF di tab baru,
     mode gelap UI-only.
*/

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
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageIndicator = document.getElementById('pageIndicator');
const pageNav = document.getElementById('pageNav');
const darkSwitch = document.getElementById('darkSwitch');

let batches = [];
let pagesCache = [];
let currentPageIndex = 0;

/* Theme init (UI only) */
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
  if (on) darkSwitch.classList.add('on'); else darkSwitch.classList.remove('on');
  localStorage.setItem('theme', on ? 'dark' : 'light');
});

/* UI handlers */
modeSelect.onchange = () => { hargaPerFotoBox.style.display = modeSelect.value === 'perfoto' ? 'block' : 'none'; updatePricePreview(); };
sizeSelect.onchange = () => { customSize.style.display = sizeSelect.value === 'custom' ? 'flex' : 'none'; };

/* EXIF-aware loader */
function loadImageWithEXIF(file) {
  return new Promise(res => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      EXIF.getData(file, function() {
        const o = EXIF.getTag(this, 'Orientation');
        img.onload = () => {
          const c = document.createElement('canvas');
          const x = c.getContext('2d');
          if (o >= 5 && o <= 8) { c.width = img.height; c.height = img.width; } else { c.width = img.width; c.height = img.height; }
          switch (o) {
            case 2: x.translate(c.width,0); x.scale(-1,1); break;
            case 3: x.translate(c.width,c.height); x.rotate(Math.PI); break;
            case 4: x.translate(0,c.height); x.scale(1,-1); break;
            case 5: x.rotate(0.5*Math.PI); x.scale(1,-1); break;
            case 6: x.translate(c.width,0); x.rotate(0.5*Math.PI); break;
            case 7: x.translate(c.width,c.height); x.rotate(0.5*Math.PI); x.scale(-1,1); break;
            case 8: x.translate(0,c.height); x.rotate(-0.5*Math.PI); break;
            default: break;
          }
          x.drawImage(img, 0, 0);
          const fixed = new Image();
          fixed.onload = () => res(fixed);
          try { fixed.src = c.toDataURL('image/jpeg'); } catch (err) { fixed.src = e.target.result; }
        };
        img.src = e.target.result;
      });
    };
    reader.readAsDataURL(file);
  });
}

/* Compress image jika terlalu besar (>500MB) */
async function compressImage(file, maxWidth = 2500, quality = 0.75) {
  const img = await loadImageWithEXIF(file);
  const scale = Math.min(1, maxWidth / img.width);
  const canvas = document.createElement('canvas');
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise(res => {
    canvas.toBlob(blob => {
      const compressedFile = new File([blob], file.name, { type: 'image/jpeg' });
      res(compressedFile);
    }, 'image/jpeg', quality);
  });
}

/* Upload -> buat batch dengan compress otomatis */
upload.onchange = async e => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  const processedFiles = [];
  for (const file of files) {
    if (file.size > 500 * 1024 * 1024) {
      const compressed = await compressImage(file, 2500, 0.75);
      processedFiles.push(compressed);
    } else {
      processedFiles.push(file);
    }
  }

  if (sizeSelect.value === 'custom') {
    const cw = parseFloat(customW.value), ch = parseFloat(customH.value);
    if (!cw || !ch) batches.push({ files: processedFiles, size: '2x3', copy: 1 });
    else batches.push({ files: processedFiles, size: 'custom', customW: cw, customH: ch, copy: 1 });
  } else {
    batches.push({ files: processedFiles, size: sizeSelect.value, copy: 1 });
  }

  upload.value = '';
  refreshBatchList();
  await updatePricePreview();
};

/* refreshBatchList: update batch dan harga */
function refreshBatchList() {
  batchList.innerHTML = '';
  batches.forEach((b, i) => {
    const row = document.createElement('div'); row.className = 'batch-row';
    const sizeText = b.size === 'custom' ? `${b.customW}x${b.customH} cm` : b.size.replace('x',' x ');
    row.innerHTML = `<div style="flex:1"><strong>Batch ${i+1}</strong><div class="small">${b.files.length} foto — ${sizeText}</div></div>`;
    const copies = document.createElement('input'); copies.type='number'; copies.value=b.copy||1; copies.min=1; copies.style.width='60px';
    copies.onchange = async () => { b.copy = Math.max(1, parseInt(copies.value) || 1); await updatePricePreview(); };
    const del = document.createElement('button'); del.textContent='❌'; del.className='warn';
    del.onclick = async () => { batches.splice(i,1); refreshBatchList(); await updatePricePreview(); };
    row.append(copies, del);
    batchList.appendChild(row);
  });
  batchList.style.display = batches.length ? 'block' : 'none';
}

/* drawImageCover: fill (cover), rotate landscape -> portrait */
function drawImageCover(ctx, img, x, y, boxW, boxH, rotateLandscapeToPortrait = true) {
  let iw = img.width, ih = img.height;
  let rotate = false;
  if (rotateLandscapeToPortrait && iw > ih) { rotate = true; [iw, ih] = [ih, iw]; }
  const imgRatio = iw / ih;
  const boxRatio = boxW / boxH;
  let drawW, drawH;
  if (imgRatio > boxRatio) { drawH = boxH; drawW = boxH * imgRatio; }
  else { drawW = boxW; drawH = boxW / imgRatio; }
  const offsetX = x + (boxW - drawW) / 2;
  const offsetY = y + (boxH - drawH) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 1, y + 1, boxW - 2, boxH - 2);
  ctx.clip();

  if (rotate) {
    const cx = x + boxW / 2;
    const cy = y + boxH / 2;
    ctx.translate(cx, cy);
    ctx.rotate(-0.5 * Math.PI);
    ctx.drawImage(img, -drawH / 2, -drawW / 2, drawH, drawW);
  } else {
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  }
  ctx.restore();
}

/* renderAllPagesToCanvases: buat halaman A4 */
async function renderAllPagesToCanvases() {
  const fullW = 2480, fullH = 3508;
  const pxPerCm = 118;
  const footerHeightMm = 20; const footerPx = (footerHeightMm / 10) * pxPerCm;
  const marginPx = (Math.max(0, parseFloat(marginInputMm.value) || 1) / 10) * pxPerCm;
  const gap = Math.max(0, parseInt(gapInput.value) || 10);

  const pages = [];
  let page = document.createElement('canvas'); page.width = fullW; page.height = fullH;
  let pctx = page.getContext('2d'); pctx.fillStyle = '#fff'; pctx.fillRect(0,0,fullW,fullH);

  let x = marginPx; let y = marginPx; let rowMaxH = 0;
  const usableHeight = fullH - marginPx - footerPx;
  let usedHeightPerPagePx = []; let currentPageMaxY = marginPx;

  for (const batch of batches) {
    let wcm, hcm;
    if (batch.size === 'custom') { wcm = batch.customW; hcm = batch.customH; }
    else { [wcm, hcm] = batch.size.split('x').map(Number); }
    const boxW = wcm * pxPerCm; const boxH = hcm * pxPerCm;
    const copies = Math.max(1, batch.copy || 1);

    for (let cp = 0; cp < copies; cp++) {
      for (const file of batch.files) {
        const img = await loadImageWithEXIF(file);

        if (x + boxW > fullW - marginPx) {
          x = marginPx;
          y += rowMaxH + gap;
          rowMaxH = 0;
        }

        if (y + boxH > usableHeight) {
          usedHeightPerPagePx.push(Math.max(currentPageMaxY, marginPx));
          pages.push(page);
          page = document.createElement('canvas'); page.width = fullW; page.height = fullH;
          pctx = page.getContext('2d'); pctx.fillStyle = '#fff'; pctx.fillRect(0,0,fullW,fullH);
          x = marginPx; y = marginPx; rowMaxH = 0; currentPageMaxY = marginPx;
        }

        drawImageCover(pctx, img, x, y, boxW, boxH, true);

        pctx.strokeStyle = '#000';
        pctx.lineWidth = 2;
        pctx.strokeRect(x, y, boxW, boxH);

        rowMaxH = Math.max(rowMaxH, boxH);
        x += boxW + gap;
        currentPageMaxY = Math.max(currentPageMaxY, y + boxH);
      }
    }
  }

  usedHeightPerPagePx.push(Math.max(currentPageMaxY, marginPx));
  pages.push(page);

  const canvasHeightMm = 297;
  const usedMmPerPage = usedHeightPerPagePx.map(px => (px / fullH) * canvasHeightMm);
  return { pages, usedMmPerPage };
}

/* hitungHargaDariUsedMm: setiap halaman ≤½A4=1000, >½A4=2000 */
function hitungHargaDariUsedMm(usedMmPerPage) {
  let totalHarga = 0;
  const halfPageMm = 297 / 2;
  usedMmPerPage.forEach(used => {
    if (used <= halfPageMm) totalHarga += 1000;
    else totalHarga += 2000;
  });
  return totalHarga;
}

/* updatePricePreview */
async function updatePricePreview() {
  if (!batches.length) { 
    priceDisplay.textContent = 'Harga: Rp 0 (preview)';
    return;
  }
  try {
    const { usedMmPerPage } = await renderAllPagesToCanvases();
    const previewPrice = hitungHargaDariUsedMm(usedMmPerPage);
    priceDisplay.textContent = `Harga: Rp ${previewPrice.toLocaleString()} (preview)`;
  } catch (err) {
    console.error(err);
    priceDisplay.textContent = 'Harga: Rp 0 (preview error)';
  }
}

/* showPageAtIndex */
function showPageAtIndex(i) {
  if (!pagesCache || !pagesCache.length) return;
  currentPageIndex = Math.max(0, Math.min(i, pagesCache.length - 1));
  const p = pagesCache[currentPageIndex];
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(p, 0, 0, canvas.width, canvas.height);
  pageNav.style.display = pagesCache.length > 1 ? 'flex' : 'none';
  pageIndicator.textContent = `Halaman ${currentPageIndex + 1} / ${pagesCache.length}`;
  prevPageBtn.disabled = currentPageIndex === 0;
  nextPageBtn.disabled = currentPageIndex === pagesCache.length - 1;
}

/* Tombol preview */
previewBtn.onclick = async () => {
  previewBtn.disabled = true; previewBtn.textContent = '🔁 Memproses...';
  try {
    const { pages, usedMmPerPage } = await renderAllPagesToCanvases();
    pagesCache = pages;
    const totalHarga = hitungHargaDariUsedMm(usedMmPerPage);
    showPageAtIndex(0);
    priceDisplay.textContent = `Harga: Rp ${totalHarga.toLocaleString()} (preview)`;
  } catch (err) {
    console.error(err); alert('Terjadi error saat memproses preview. Coba ulangi.');
  } finally {
    previewBtn.disabled = false; previewBtn.textContent = '👁️ Preview Cepat';
  }
};

/* Tombol generate / download PDF */
generateBtn.onclick = async () => {
  generateBtn.disabled = true; generateBtn.textContent = '🔁 Memproses...';
  try {
    const { pages, usedMmPerPage } = await renderAllPagesToCanvases();
    pagesCache = pages;
    const totalHarga = hitungHargaDariUsedMm(usedMmPerPage);
    showPageAtIndex(0);
    priceDisplay.textContent = `Harga: Rp ${totalHarga.toLocaleString()}`;
  } catch (err) {
    console.error(err); alert('Terjadi error saat membuat kolase. Coba ulangi.');
  } finally {
    generateBtn.disabled = false; generateBtn.textContent = '📄 Buat Kolase';
  }
};

prevPageBtn.onclick = () => showPageAtIndex(currentPageIndex - 1);
nextPageBtn.onclick = () => showPageAtIndex(currentPageIndex + 1);

/* reset semua */
resetBtn.onclick = () => {
  if (!confirm('Reset semua batch dan hasil preview?')) return;
  batches = []; refreshBatchList(); pagesCache = []; currentPageIndex = 0;
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  priceDisplay.textContent = 'Harga: Rp 0';
  userName.value = 'SEDULUR FOTOCOPY';
  pageNav.style.display = 'none'; pageIndicator.textContent = 'Halaman 0 / 0';
};

/* inisialisasi kanvas putih */
ctx.fillStyle = '#fff';
ctx.fillRect(0,0,canvas.width,canvas.height);
