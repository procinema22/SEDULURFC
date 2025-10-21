/* script.js
   Semua komentar dalam Bahasa Indonesia.
   Fitur:
   - cover crop, auto-rotate landscape->portrait,
   - multi-batch, multi-page A4 portrait,
   - footer hanya mode normal,
   - harga otomatis (≤½ A4=1000, >½ A4=2000),
   - preview cepat untuk file besar,
   - buka PDF di tab baru, mode gelap UI-only.
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
modeSelect.onchange = () => { updatePricePreview(); };
sizeSelect.onchange = () => { customSize.style.display = sizeSelect.value === 'custom' ? 'flex' : 'none'; };

/* Upload -> buat batch */
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

/* EXIF-aware loader + resize untuk preview */
function loadImagePreview(file, maxPx = 1240) {
  return new Promise(res => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      EXIF.getData(file, function() {
        const o = EXIF.getTag(this, 'Orientation');
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > maxPx || h > maxPx) {
            const ratio = Math.min(maxPx / w, maxPx / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          const x = c.getContext('2d');
          if (o >= 5 && o <= 8) { [c.width, c.height] = [c.height, c.width]; }
          switch(o){
            case 2: x.translate(c.width,0); x.scale(-1,1); break;
            case 3: x.translate(c.width,c.height); x.rotate(Math.PI); break;
            case 4: x.translate(0,c.height); x.scale(1,-1); break;
            case 5: x.rotate(0.5*Math.PI); x.scale(1,-1); break;
            case 6: x.translate(c.width,0); x.rotate(0.5*Math.PI); break;
            case 7: x.translate(c.width,c.height); x.rotate(0.5*Math.PI); x.scale(-1,1); break;
            case 8: x.translate(0,c.height); x.rotate(-0.5*Math.PI); break;
          }
          x.drawImage(img,0,0,w,h);
          const fixed = new Image();
          fixed.onload = () => res(fixed);
          fixed.src = c.toDataURL('image/jpeg',0.7);
        };
        img.src = e.target.result;
      });
    };
    reader.readAsDataURL(file);
  });
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

/* Render preview halaman pertama (A4 kecil) */
async function renderPreviewPage() {
  if (!batches.length) return;

  const fullW = 1240, fullH = 1754; // A4 kecil untuk preview
  const pxPerCm = 118;
  const marginPx = (Math.max(0, parseFloat(marginInputMm.value)||1)/10)*pxPerCm;
  const gap = Math.max(0, parseInt(gapInput.value)||10);

  let page = document.createElement('canvas');
  page.width = fullW; page.height = fullH;
  const pctx = page.getContext('2d');
  pctx.fillStyle = '#fff'; pctx.fillRect(0,0,fullW,fullH);

  let x = marginPx, y = marginPx, rowMaxH = 0;
  const usableHeight = fullH - marginPx;

  for (const batch of batches) {
    let wcm,hcm;
    if(batch.size==='custom'){ wcm=batch.customW; hcm=batch.customH; }
    else { [wcm,hcm]=batch.size.split('x').map(Number); }
    const boxW = wcm*pxPerCm, boxH = hcm*pxPerCm;
    const copies = Math.max(1,batch.copy||1);

    for(let cp=0; cp<copies; cp++){
      for(const file of batch.files){
        const img = await loadImagePreview(file, Math.max(boxW,boxH));
        if(x+boxW > fullW-marginPx){ x=marginPx; y+=rowMaxH+gap; rowMaxH=0; }
        if(y+boxH > usableHeight) break; // preview hanya halaman pertama
        drawImageCover(pctx,img,x,y,boxW,boxH,true);
        rowMaxH=Math.max(rowMaxH,boxH);
        x+=boxW+gap;
      }
    }
  }

  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(page,0,0,canvas.width,canvas.height);
}

/* updatePricePreview: hitung harga sesuai rule */
async function updatePricePreview() {
  if(!batches.length){ priceDisplay.textContent='Harga: Rp 0 (preview)'; return; }

  try {
    const { pages, usedMmPerPage } = await renderAllPagesToCanvases(); // tetap full-res untuk hitung harga
    const totalHarga = hitungHargaDariUsedMm(usedMmPerPage);
    priceDisplay.textContent = `Harga: Rp ${totalHarga.toLocaleString()} (preview)`;
    await renderPreviewPage(); // tampilkan preview cepat
  } catch(err){ console.error(err); priceDisplay.textContent='Harga: Rp 0 (preview error)'; }
}

/* hitungHargaDariUsedMm: setiap halaman dihitung independen */
function hitungHargaDariUsedMm(usedMmPerPage){
  let totalHarga=0;
  const halfPageMm = 297/2;
  usedMmPerPage.forEach(used => {
    if(used <= halfPageMm) totalHarga += 1000;
    else totalHarga += 2000;
  });
  return totalHarga;
}

/* Render semua halaman full-res untuk PDF */
async function renderAllPagesToCanvases() {
  const fullW = 2480, fullH = 3508;
  const pxPerCm = 118;
  const footerHeightMm=20, footerPx=(footerHeightMm/10)*pxPerCm;
  const marginPx=(Math.max(0,parseFloat(marginInputMm.value)||1)/10)*pxPerCm;
  const gap = Math.max(0,parseInt(gapInput.value)||10);

  const pages=[];
  let page=document.createElement('canvas'); page.width=fullW; page.height=fullH;
  let pctx=page.getContext('2d'); pctx.fillStyle='#fff'; pctx.fillRect(0,0,fullW,fullH);

  let x=marginPx,y=marginPx,rowMaxH=0;
  const usableHeight = fullH - marginPx - footerPx;
  let usedHeightPerPagePx=[]; let currentPageMaxY=marginPx;

  for(const batch of batches){
    let wcm,hcm;
    if(batch.size==='custom'){ wcm=batch.customW; hcm=batch.customH; }
    else [wcm,hcm]=batch.size.split('x').map(Number);
    const boxW=wcm*pxPerCm, boxH=hcm*pxPerCm;
    const copies=Math.max(1,batch.copy||1);

    for(let cp=0; cp<copies; cp++){
      for(const file of batch.files){
        const img = await loadImageWithEXIF(file);
        if(x+boxW>fullW-marginPx){ x=marginPx; y+=rowMaxH+gap; rowMaxH=0; }
        if(y+boxH>usableHeight){
          usedHeightPerPagePx.push(Math.max(currentPageMaxY,marginPx));
          pages.push(page);
          page=document.createElement('canvas'); page.width=fullW; page.height=fullH;
          pctx=page.getContext('2d'); pctx.fillStyle='#fff'; pctx.fillRect(0,0,fullW,fullH);
          x=marginPx; y=marginPx; rowMaxH=0; currentPageMaxY=marginPx;
        }
        drawImageCover(pctx,img,x,y,boxW,boxH,true);
        pctx.strokeStyle='#000'; pctx.lineWidth=2; pctx.strokeRect(x,y,boxW,boxH);
        rowMaxH=Math.max(rowMaxH,boxH);
        x+=boxW+gap;
        currentPageMaxY=Math.max(currentPageMaxY,y+boxH);
      }
    }
  }
  usedHeightPerPagePx.push(Math.max(currentPageMaxY,marginPx));
  pages.push(page);

  const canvasHeightMm=297;
  const usedMmPerPage=usedHeightPerPagePx.map(px=>(px/fullH)*canvasHeightMm);
  const totalPhotosCount=batches.reduce((acc,b)=>acc+(b.files.length||0)*(b.copy||1),0);

  return { pages, usedMmPerPage, totalPhotosCount };
}

/* loadImageWithEXIF full-res */
function loadImageWithEXIF(file){
  return new Promise(res=>{
    const reader=new FileReader();
    reader.onload=e=>{
      const img=new Image();
      EXIF.getData(file,function(){
        const o=EXIF.getTag(this,'Orientation');
        img.onload=()=>{
          const c=document.createElement('canvas');
          const x=c.getContext('2d');
          let iw=img.width, ih=img.height;
          if(o>=5&&o<=8){ c.width=ih; c.height=iw; } else { c.width=iw; c.height=ih; }
          switch(o){
            case 2: x.translate(c.width,0); x.scale(-1,1); break;
            case 3: x.translate(c.width,c.height); x.rotate(Math.PI); break;
            case 4: x.translate(0,c.height); x.scale(1,-1); break;
            case 5: x.rotate(0.5*Math.PI); x.scale(1,-1); break;
            case 6: x.translate(c.width,0); x.rotate(0.5*Math.PI); break;
            case 7: x.translate(c.width,c.height); x.rotate(0.5*Math.PI); x.scale(-1,1); break;
            case 8: x.translate(0,c.height); x.rotate(-0.5*Math.PI); break;
          }
          x.drawImage(img,0,0);
          const fixed=new Image();
          fixed.onload=()=>res(fixed);
          fixed.src=c.toDataURL('image/jpeg',0.9);
        };
        img.src=e.target.result;
      });
    };
    reader.readAsDataURL(file);
  });
}

/* showPageAtIndex */
function showPageAtIndex(i){
  if(!pagesCache||!pagesCache.length) return;
  currentPageIndex=Math.max(0,Math.min(i,pagesCache.length-1));
  const p=pagesCache[currentPageIndex];
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(p,0,0,canvas.width,canvas.height);
}

/* Tombol preview */
previewBtn.onclick=async()=>{
  previewBtn.disabled=true; previewBtn.textContent='🔁 Memproses...';
  try{ await updatePricePreview(); } catch(e){ console.error(e); }
  finally{ previewBtn.disabled=false; previewBtn.textContent='👁️ Preview Cepat'; }
};

/* Tombol generate PDF */
generateBtn.onclick=async()=>{
  generateBtn.disabled=true; generateBtn.textContent='🔁 Memproses...';
  try{
    const { pages, usedMmPerPage } = await renderAllPagesToCanvases();
    pagesCache=pages;
    const totalHarga=hitungHargaDariUsedMm(usedMmPerPage);
    showPageAtIndex(0);
    priceDisplay.textContent=`Harga: Rp ${totalHarga.toLocaleString()}`;
  }catch(e){ console.error(e); alert('Gagal membuat kolase. Coba ulangi.'); }
  finally{ generateBtn.disabled=false; generateBtn.textContent='📄 Buat Kolase'; }
};

/* DOWNLOAD PDF */
downloadPdf.onclick=async()=>{
  if(!batches.length) return alert('Belum ada foto/batch.');
  downloadPdf.disabled=true; downloadPdf.textContent='⏳ Menyiapkan PDF...';
  try{
    const { pages, usedMmPerPage } = await renderAllPagesToCanvases();
    const totalHarga=hitungHargaDariUsedMm(usedMmPerPage);

    if(modeSelect.value==='normal'){
      const lastIdx=pages.length-1;
      const lastCanvas=pages[lastIdx];
      const lastCtx=lastCanvas.getContext('2d');
      const fullW=lastCanvas.width, fullH=lastCanvas.height;
      const pxPerCm=118;
      const footerHeightMm=20, footerPx=(footerHeightMm/10)*pxPerCm;
      const footerFontSize=48;
      lastCtx.font=`${footerFontSize}px Poppins`;
      lastCtx.fillStyle='#333';
      const footerX=20+20;
      const footerYName=fullH-footerPx+30;
      const footerYPrice=footerYName+footerFontSize+6;
      lastCtx.fillText(`Nama: ${userName.value||'-'}`, footerX, footerYName);
      lastCtx.fillText(`Harga: Rp ${totalHarga.toLocaleString()}`, footerX, footerYPrice);
    }

    const { jsPDF }=window.jspdf;
    const pdf=new jsPDF('p','pt','a4');
    pages.forEach((pg,i)=>{
      if(i>0) pdf.addPage();
      pdf.addImage(pg.toDataURL('image/jpeg',0.92),'JPEG',0,0,595,842);
    });
    const pdfBlob=pdf.output('blob');
    const blobUrl=URL.createObjectURL(pdfBlob);
    window.open(blobUrl,'_blank');
  }catch(e){ console.error(e); alert('Gagal membuat PDF. Coba lagi.'); }
  finally{ downloadPdf.disabled=false; downloadPdf.textContent='💾 Buka PDF di Tab Baru'; }
};

/* Reset semua */
resetBtn.onclick=()=>{
  if(!confirm('Reset semua batch dan preview?')) return;
  batches=[]; refreshBatchList(); pagesCache=[]; currentPageIndex=0;
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  priceDisplay.textContent='Harga: Rp 0';
  userName.value='SEDULUR FOTOCOPY';
};
