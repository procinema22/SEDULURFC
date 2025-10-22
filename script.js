/* script.js — versi lengkap final dengan Mode Laprak
   Fitur:
   - cover crop, auto-rotate landscape->portrait
   - multi-batch, multi-page A4 portrait
   - harga otomatis (≤½ A4 = 1000, >½ = 2000)
   - mode gelap UI-only
   - kompresi otomatis (preview & PDF)
   - indikator progres
   - auto-skip gambar rusak
   - 🔹 Mode Laprak: nama & harga manual, aktif hanya jika ≤1 baris
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

// 🔹 Elemen Mode Laprak
const laprakMode = document.getElementById('laprakMode');
const laprakControls = document.getElementById('laprakControls');
const laprakName = document.getElementById('laprakName');
const laprakPrice = document.getElementById('laprakPrice');

let batches = [];
let pagesCache = [];
let currentPageIndex = 0;

const PREVIEW_SCALE = 0.25;

/* Theme */
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

modeSelect.onchange = () => { 
  hargaPerFotoBox.style.display = modeSelect.value === 'perfoto' ? 'block' : 'none'; 
  updatePricePreview(); 
};
sizeSelect.onchange = () => { 
  customSize.style.display = sizeSelect.value === 'custom' ? 'flex' : 'none'; 
};

// 🔹 Toggle Mode Laprak
laprakMode.onchange = () => {
  laprakControls.style.display = laprakMode.checked ? 'block' : 'none';
  if (laprakMode.checked) {
    modeSelect.disabled = true; // kunci agar tidak bentrok dengan mode lain
  } else {
    modeSelect.disabled = false;
  }
};

/* Upload handler */
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
  await updatePricePreview();
};

function refreshBatchList() {
  batchList.innerHTML = '';
  batches.forEach((b, i) => {
    const row = document.createElement('div'); row.className = 'batch-row';
    const sizeText = b.size === 'custom' ? `${b.customW}x${b.customH} cm` : b.size.replace('x',' x ');
    row.innerHTML = `<div style="flex:1"><strong>Batch ${i+1}</strong><div class="small">${b.files.length} foto — ${sizeText}</div></div>`;
    const copies = document.createElement('input'); 
    copies.type='number'; copies.value=b.copy||1; copies.min=1; copies.style.width='60px';
    copies.onchange = async () => { b.copy = Math.max(1, parseInt(copies.value)||1); await updatePricePreview(); };
    const del = document.createElement('button'); del.textContent='❌'; del.className='warn';
    del.onclick = async () => { batches.splice(i,1); refreshBatchList(); await updatePricePreview(); };
    row.append(copies, del);
    batchList.appendChild(row);
  });
  batchList.style.display = batches.length ? 'block' : 'none';
}

/* ========== Kompresi Gambar + Auto Skip ========== */
function loadImageWithEXIF(file, mode = "preview") {
  return new Promise(res => {
    try {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onerror = () => {
          console.warn(`Gagal memuat: ${file.name}, dilewati.`);
          res(null);
        };
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

/* drawImageCover */
function drawImageCover(ctx,img,x,y,boxW,boxH,rotateLandscapeToPortrait=true){
  let iw=img.width, ih=img.height; let rotate=false;
  if(rotateLandscapeToPortrait && iw>ih){rotate=true;[iw,ih]=[ih,iw];}
  const imgRatio=iw/ih; const boxRatio=boxW/boxH;
  let drawW,drawH;
  if(imgRatio>boxRatio){drawH=boxH;drawW=boxH*imgRatio;} else {drawW=boxW;drawH=boxW/imgRatio;}
  const offsetX=x+(boxW-drawW)/2; const offsetY=y+(boxH-drawH)/2;
  ctx.save(); ctx.beginPath(); ctx.rect(x+1,y+1,boxW-2,boxH-2); ctx.clip();
  if(rotate){
    const cx=x+boxW/2,cy=y+boxH/2; ctx.translate(cx,cy); ctx.rotate(-0.5*Math.PI);
    ctx.drawImage(img,-drawH/2,-drawW/2,drawH,drawW);
  } else { ctx.drawImage(img,offsetX,offsetY,drawW,drawH); }
  ctx.restore();
}

/* render preview */
async function renderPreviewPages() {
  const fullW = 2480, fullH = 3508;
  const previewW = fullW*PREVIEW_SCALE;
  const previewH = fullH*PREVIEW_SCALE;
  const pxPerCm = 118*PREVIEW_SCALE;
  const footerHeightMm=20, footerPx=(footerHeightMm/10)*pxPerCm;
  const marginPx=(Math.max(0,parseFloat(marginInputMm.value)||1)/10)*pxPerCm;
  const gap = Math.max(0,parseInt(gapInput.value)||10)*PREVIEW_SCALE;

  const pages=[]; let page=document.createElement('canvas'); page.width=previewW; page.height=previewH;
  let pctx=page.getContext('2d'); pctx.fillStyle='#fff'; pctx.fillRect(0,0,previewW,previewH);
  let x=marginPx, y=marginPx, rowMaxH=0; const usableHeight=previewH-marginPx-footerPx;

  let totalFiles = batches.reduce((a,b)=>a+b.files.length*(b.copy||1),0);
  let processed=0;
  previewBtn.textContent = `🔁 Mengompres 0/${totalFiles} foto...`;

  for(const batch of batches){
    let wcm,hcm;
    if(batch.size==='custom'){ wcm=batch.customW; hcm=batch.customH; } else { [wcm,hcm]=batch.size.split('x').map(Number); }
    const boxW=wcm*pxPerCm, boxH=hcm*pxPerCm;
    const copies=Math.max(1,batch.copy||1);

    for(let cp=0; cp<copies; cp++){
      for(const file of batch.files){
        processed++;
        previewBtn.textContent = `🔁 Mengompres ${processed}/${totalFiles} foto...`;
        const img=await loadImageWithEXIF(file,"preview");
        if(!img) continue;
        if(x+boxW>previewW-marginPx){ x=marginPx; y+=rowMaxH+gap; rowMaxH=0; }
        if(y+boxH>usableHeight){ pages.push(page); page=document.createElement('canvas'); page.width=previewW; page.height=previewH;
          pctx=page.getContext('2d'); pctx.fillStyle='#fff'; pctx.fillRect(0,0,previewW,previewH);
          x=marginPx; y=marginPx; rowMaxH=0; }
        drawImageCover(pctx,img,x,y,boxW,boxH,true);
        rowMaxH=Math.max(rowMaxH,boxH); x+=boxW+gap;
      }
    }
  }
  previewBtn.textContent='👁️ Preview Cepat';
  pages.push(page); return pages;
}

/* render PDF */
async function renderAllPagesToCanvases() {
  const fullW = 2480, fullH = 3508;
  const pxPerCm = 118;
  const footerHeightMm=20, footerPx=(footerHeightMm/10)*pxPerCm;
  const marginPx=(Math.max(0,parseFloat(marginInputMm.value)||1)/10)*pxPerCm;
  const gap = Math.max(0,parseInt(gapInput.value)||10);

  const pages=[]; let page=document.createElement('canvas'); page.width=fullW; page.height=fullH;
  let pctx=page.getContext('2d'); pctx.fillStyle='#fff'; pctx.fillRect(0,0,fullW,fullH);
  let x=marginPx, y=marginPx, rowMaxH=0; const usableHeight=fullH-marginPx-footerPx;
  let usedHeightPerPagePx=[];

  let totalFiles = batches.reduce((a,b)=>a+b.files.length*(b.copy||1),0);
  let processed=0;
  generateBtn.textContent = `🔁 Mengompres 0/${totalFiles} foto...`;

  for(const batch of batches){
    let wcm,hcm;
    if(batch.size==='custom'){ wcm=batch.customW; hcm=batch.customH; } else { [wcm,hcm]=batch.size.split('x').map(Number); }
    const boxW=wcm*pxPerCm, boxH=hcm*pxPerCm;
    const copies=Math.max(1,batch.copy||1);

    for(let cp=0; cp<copies; cp++){
      for(const file of batch.files){
        processed++;
        generateBtn.textContent = `🔁 Mengompres ${processed}/${totalFiles} foto...`;
        const img=await loadImageWithEXIF(file,"pdf");
        if(!img) continue;
        if(x+boxW>fullW-marginPx){ x=marginPx; y+=rowMaxH+gap; rowMaxH=0; }
        if(y+boxH>usableHeight){ usedHeightPerPagePx.push(y); pages.push(page);
          page=document.createElement('canvas'); page.width=fullW; page.height=fullH;
          pctx=page.getContext('2d'); pctx.fillStyle='#fff'; pctx.fillRect(0,0,fullW,fullH);
          x=marginPx; y=marginPx; rowMaxH=0; }
        drawImageCover(pctx,img,x,y,boxW,boxH,true);
        pctx.strokeStyle='#000'; pctx.lineWidth=2; pctx.strokeRect(x,y,boxW,boxH);
        rowMaxH=Math.max(rowMaxH,boxH); x+=boxW+gap;
      }
    }
  }

  generateBtn.textContent='📄 Buat Kolase';
  usedHeightPerPagePx.push(y);
  pages.push(page);

  // 🔹 Cek otomatis Mode Laprak (harus 1 baris)
  if (laprakMode.checked) {
    const firstPageUsedMm = usedHeightPerPagePx[0] / fullH * 297;
    if (firstPageUsedMm > 297 / 3) {
      alert('Foto melebihi 1 baris — Mode Laprak dinonaktifkan otomatis.');
      laprakMode.checked = false;
      laprakControls.style.display = 'none';
      modeSelect.disabled = false;
    }
  }

  const canvasHeightMm=297;
  const usedMmPerPage = usedHeightPerPagePx.map(px => (px/fullH)*canvasHeightMm);
  return { pages, usedMmPerPage, totalPhotosCount: batches.reduce((a,b)=>a+(b.files.length||0)*(b.copy||1),0) };
}

/* Hitung harga */
function hitungHargaDariUsedMm(usedMmPerPage){
  const manualHarga = document.getElementById('manualHarga');
  let totalHarga = 0;
  const halfPageMm = 297 / 2;

  // Jika tombol harga manual aktif, semua harga pakai Rp 500
  if (manualHarga && manualHarga.checked) {
    return 500; // atau nilai lain sesuai keinginanmu
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

/* Tombol utama */
previewBtn.onclick = async () => {
  previewBtn.disabled=true;
  try{
    pagesCache=await renderPreviewPages();
    showPageAtIndex(0);
    await updatePricePreview();
  }catch(err){ console.error(err); alert('Error preview.'); }
  finally{ previewBtn.disabled=false; }
};

generateBtn.onclick = async () => {
  generateBtn.disabled=true;
  try{
    const { pages, usedMmPerPage, totalPhotosCount } = await renderAllPagesToCanvases();

    // 🔹 Kalkulasi harga menyesuaikan Mode Laprak
    let totalHarga;
    if (laprakMode.checked) {
      totalHarga = parseInt(laprakPrice.value) || 0;
    } else if (modeSelect.value === 'normal') {
      totalHarga = hitungHargaDariUsedMm(usedMmPerPage);
    } else {
      totalHarga = totalPhotosCount * (parseInt(hargaPerFotoInput.value) || 1000);
    }

    pagesCache=pages;
    showPageAtIndex(0);
    priceDisplay.textContent=`Harga: Rp ${totalHarga.toLocaleString()}`;
  }catch(err){ console.error(err); alert('Error kolase.'); }
  finally{ generateBtn.disabled=false; }
};

prevPageBtn.onclick = () => showPageAtIndex(currentPageIndex-1);
nextPageBtn.onclick = () => showPageAtIndex(currentPageIndex+1);


downloadPdf.onclick = async () => {
  if (!batches.length) return alert('Belum ada foto/batch.');
  if (!userName.value.trim()) {
    alert('Nama harus diisi terlebih dahulu sebelum membuat PDF!');
    return;
  }

  // 🔹 Pastikan kolase sudah pernah dibuat
  if (!pagesCache.length) {
    alert('Silakan klik "📄 Buat Kolase" terlebih dahulu sebelum membuka PDF.');
    return;
  }

  downloadPdf.disabled = true;
  downloadPdf.textContent = '⏳ Menyiapkan PDF...';

  try {
    // 🔹 Gunakan hasil render sebelumnya
    const pages = pagesCache;

    // Kita tidak render ulang atau kompres lagi di sini
    // Ambil kembali harga dari label
    let totalHarga = priceDisplay.textContent.replace(/[^\d]/g, '');
    totalHarga = parseInt(totalHarga) || 0;

    // Tambahkan footer nama & harga di halaman terakhir
    const lastCanvas = pages[pages.length - 1];
    const lastCtx = lastCanvas.getContext('2d');
    const fullW = lastCanvas.width, fullH = lastCanvas.height;
    const pxPerCm = 118, footerHeightMm = 20, footerPx = (footerHeightMm / 10) * pxPerCm;
    lastCtx.font = `48px Poppins`;
    lastCtx.fillStyle = '#333';
    const footerX = 100;
    const footerYName = fullH - footerPx + 30, footerYPrice = footerYName + 60;
    lastCtx.fillText(`Nama: ${userName.value || '-'}`, footerX, footerYName);
    lastCtx.fillText(`Harga: Rp ${totalHarga.toLocaleString()}`, footerX, footerYPrice);

    // 🔹 Buat PDF langsung dari pagesCache
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


resetBtn.onclick = () => {
  // Reset langsung tanpa pop-up konfirmasi
  batches = [];
  refreshBatchList();
  pagesCache = [];
  currentPageIndex = 0;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  priceDisplay.textContent = 'Harga: Rp 0';
  userName.value = 'SEDULUR FOTOCOPY';
  pageNav.style.display = 'none';
  pageIndicator.textContent = 'Halaman 0 / 0';
  laprakMode.checked = false;
  laprakControls.style.display = 'none';
  modeSelect.disabled = false;
};


/* Update harga */
async function updatePricePreview(){
  if(!batches.length){ priceDisplay.textContent='Harga: Rp 0 (preview)'; return; }
  try{
    const { usedMmPerPage } = await renderAllPagesToCanvases();
    const previewPrice = hitungHargaDariUsedMm(usedMmPerPage);
    priceDisplay.textContent=`Harga: Rp ${previewPrice.toLocaleString()} (preview)`;
  }catch(err){ console.error(err); priceDisplay.textContent='Harga: Rp 0 (preview error)'; }
}


/* Inisialisasi */
ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
