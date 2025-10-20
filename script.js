/* script.js
   Semua komentar dalam Bahasa Indonesia.
   - Fitur: cover crop, auto-rotate landscape->portrait,
     multi-batch, multi-page A4 portrait, footer hanya mode normal,
     harga otomatis berdasarkan jumlah halaman (1 full = 2000, partial = 1000),
     buka PDF di tab baru, mode gelap UI-only.
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

/* Upload -> buat batch */
upload.onchange = e => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  if (sizeSelect.value === 'custom') {
    const cw = parseFloat(customW.value), ch = parseFloat(customH.value);
    if (!cw || !ch) batches.push({ files, size: '2x3', copy: 1 });
    else batches.push({ files, size: 'custom', customW: cw, customH: ch, copy: 1 });
  } else {
    batches.push({ files, size: sizeSelect.value, copy: 1 });
  }
  upload.value = '';
  refreshBatchList();
  updatePricePreview();
};

function refreshBatchList() {
  batchList.innerHTML = '';
  batches.forEach((b, i) => {
    const row = document.createElement('div'); row.className = 'batch-row';
    const sizeText = b.size === 'custom' ? `${b.customW}x${b.customH} cm` : b.size.replace('x',' x ');
    row.innerHTML = `<div style="flex:1"><strong>Batch ${i+1}</strong><div class="small">${b.files.length} foto — ${sizeText}</div></div>`;
    const copies = document.createElement('input'); copies.type='number'; copies.value=b.copy||1; copies.min=1; copies.style.width='60px';
    copies.onchange = () => { b.copy = Math.max(1, parseInt(copies.value) || 1); updatePricePreview(); };
    const del = document.createElement('button'); del.textContent='❌'; del.className='warn';
    del.onclick = () => { batches.splice(i,1); refreshBatchList(); updatePricePreview(); };
    row.append(copies, del);
    batchList.appendChild(row);
  });
  batchList.style.display = batches.length ? 'block' : 'none';
}

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

/* drawImageCover: fill (cover), rotate landscape -> portrait, clip inset 1px */
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

/* renderAllPagesToCanvases:
   - fullW/fullH ~ A4 at ~300dpi (px)
   - sisakan footer area (footerHeightMm)
   - return { pages (canvas array), pageUsageMmPerPage, totalPhotosCount }
*/
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
  const totalPhotosCount = batches.reduce((acc, b) => acc + (b.files.length || 0) * (b.copy || 1), 0);

  return { pages, usedMmPerPage, totalPhotosCount };
}

/* Fungsi untuk hitung harga berdasarkan rule:
   - setiap lembar penuh (>= full) = 2000
   - bagian sisa < 1 lembar dianggap: jika > 0 add 1000 (half rule)
   Implementasi: untuk tiap halaman gunakan usedMmPerPage (mm tinggi terpakai per halaman).
   Sederhana: hitung berapa lembar sebanding yang digunakan total = sum(usedMm)/297
   Lalu: integer part * 2000 + (sisa > 0 ? 1000 : 0)
*/
function hitungHargaDariUsedMm(usedMmPerPage) {
  // total tinggi dalam mm (jumlah semua halaman terpakai)
  const totalMmUsed = usedMmPerPage.reduce((a,b) => a + b, 0);
  const pagesFloat = totalMmUsed / 297.0; // berapa lembar setara
  const fullPages = Math.floor(pagesFloat);
  const sisa = pagesFloat - fullPages;

  // aturan: setiap full = 2000
  // sisa > 0 -> tambahan 1000 (seperti contoh: 1.5 => 2000 + 1000 = 3000)
  let totalHarga = fullPages * 2000;
  if (sisa > 0) totalHarga += 1000;
  // edge-case: jika tidak ada foto, harga 0
  if (pagesFloat <= 0) totalHarga = 0;
  return totalHarga;
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

/* Tombol preview: render -> tampilkan halaman pertama dan update harga UI */
previewBtn.onclick = async () => {
  previewBtn.disabled = true; previewBtn.textContent = '🔁 Memproses...';
  try {
    const { pages, usedMmPerPage, totalPhotosCount } = await renderAllPagesToCanvases();
    pagesCache = pages;
    // hitung harga sesuai rule (hanya untuk display); footer akan ditambahkan di generate / pdf jika mode normal
    const totalHarga = (modeSelect.value === 'normal') ? hitungHargaDariUsedMm(usedMmPerPage) : (totalPhotosCount * (parseInt(hargaPerFotoInput.value)||1000));
    showPageAtIndex(0);
    priceDisplay.textContent = `Harga: Rp ${totalHarga.toLocaleString()} (preview)`;
  } catch (err) {
    console.error(err); alert('Terjadi error saat memproses preview. Coba ulangi.');
  } finally {
    previewBtn.disabled = false; previewBtn.textContent = '👁️ Preview Cepat';
  }
};

/* Tombol generate: sama dengan preview (render final & tampilkan) */
generateBtn.onclick = async () => {
  generateBtn.disabled = true; generateBtn.textContent = '🔁 Memproses...';
  try {
    const { pages, usedMmPerPage, totalPhotosCount } = await renderAllPagesToCanvases();
    pagesCache = pages;
    const totalHarga = (modeSelect.value === 'normal') ? hitungHargaDariUsedMm(usedMmPerPage) : (totalPhotosCount * (parseInt(hargaPerFotoInput.value)||1000));
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

/* DOWNLOAD -> buka PDF di tab baru */
downloadPdf.onclick = async () => {
  if (!batches.length) return alert('Belum ada foto/batch untuk di-download.');
  downloadPdf.disabled = true; downloadPdf.textContent = '⏳ Menyiapkan PDF...';
  try {
    const { pages, usedMmPerPage, totalPhotosCount } = await renderAllPagesToCanvases();

    // jika mode normal => hitung harga final berdasarkan usedMmPerPage
    const totalHarga = (modeSelect.value === 'normal') ? hitungHargaDariUsedMm(usedMmPerPage) : (totalPhotosCount * (parseInt(hargaPerFotoInput.value)||1000));

    // jika mode normal -> tambahkan footer (nama & harga) di halaman terakhir (pada salinan canvas)
    if (modeSelect.value === 'normal') {
      // buat salinan halaman terakhir untuk ditulis footer
      const lastIdx = pages.length - 1;
      const lastCanvas = pages[lastIdx];
      const lastCtx = lastCanvas.getContext('2d');
      const fullW = lastCanvas.width, fullH = lastCanvas.height;
      const pxPerCm = 118;
      const footerHeightMm = 20; const footerPx = (footerHeightMm / 10) * pxPerCm;
      const footerFontSize = 48;
      lastCtx.font = `${footerFontSize}px Poppins`;
      lastCtx.fillStyle = '#333';
      const footerX = (Math.max(20, (parseFloat(marginInputMm.value)||5) / 10 * pxPerCm)) + 20;
      const footerYName = fullH - footerPx + 30;
      const footerYPrice = footerYName + footerFontSize + 6;
      lastCtx.fillText(`Nama: ${userName.value || '-'}`, footerX, footerYName);
      lastCtx.fillText(`Harga: Rp ${totalHarga.toLocaleString()}`, footerX, footerYPrice);
    }

    // buat PDF dan buka di tab baru
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p','pt','a4');
    pages.forEach((pg, i) => {
      if (i > 0) pdf.addPage();
      pdf.addImage(pg.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 595, 842);
    });

    const pdfBlob = pdf.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);
    window.open(blobUrl, '_blank');

  } catch (err) {
    console.error(err); alert('Gagal membuat PDF. Coba lagi.');
  } finally {
    downloadPdf.disabled = false; downloadPdf.textContent = '💾 Buka PDF di Tab Baru';
  }
};

resetBtn.onclick = () => {
  if (!confirm('Reset semua batch dan hasil preview?')) return;
  batches = []; refreshBatchList(); pagesCache = []; currentPageIndex = 0;
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  priceDisplay.textContent = 'Harga: Rp 0';
  userName.value = 'SEDULUR FOTOCOPY';
  pageNav.style.display = 'none'; pageIndicator.textContent = 'Halaman 0 / 0';
};
/* updatePricePreview: preview harga sesuai tinggi tiap halaman */
async function updatePricePreview() {
    if (!batches.length) { 
      priceDisplay.textContent = 'Harga: Rp 0 (preview)';
      return;
    }
  
    try {
      // render halaman sementara untuk dapat tinggi terpakai tiap halaman
      const { usedMmPerPage } = await renderAllPagesToCanvases();
  
      // hitung harga tiap halaman: ≤ setengah A4 = 1000, > setengah = 2000
      const previewPrice = hitungHargaDariUsedMm(usedMmPerPage);
  
      priceDisplay.textContent = `Harga: Rp ${previewPrice.toLocaleString()} (preview)`;
    } catch (err) {
      console.error(err);
      priceDisplay.textContent = 'Harga: Rp 0 (preview error)';
    }
  }
  
  /* hitungHargaDariUsedMm: setiap halaman dihitung independen */
  function hitungHargaDariUsedMm(usedMmPerPage) {
    let totalHarga = 0;
    const halfPageMm = 297 / 2; // setengah A4 = 148.5 mm
    usedMmPerPage.forEach(used => {
      if (used <= halfPageMm) totalHarga += 1000;   // ≤ setengah A4
      else totalHarga += 2000;                      // > setengah A4
    });
    return totalHarga;
  }
  
  /* contoh: panggil updatePricePreview() saat upload atau ubah copy */
  upload.onchange = async e => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (sizeSelect.value === 'custom') {
      const cw = parseFloat(customW.value), ch = parseFloat(customH.value);
      if (!cw || !ch) batches.push({ files, size: '2x3', copy: 1 });
      else batches.push({ files, size: 'custom', customW: cw, customH: ch, copy: 1 });
    } else {
      batches.push({ files, size: sizeSelect.value, copy: 1 });
    }
    upload.value = '';
    refreshBatchList();
    await updatePricePreview(); // <<< update harga preview sesuai tinggi halaman
  };
  
  /* refreshBatchList: update harga setiap kali copy diubah */
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
    

/* inisialisasi kanvas putih */
ctx.fillStyle = '#fff';
ctx.fillRect(0,0,canvas.width,canvas.height);
