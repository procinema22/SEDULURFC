/* script.js
   Semua komentar dalam Bahasa Indonesia.
   - Fitur: cover crop, auto-rotate landscape->portrait,
     multi-batch, multi-page A4 portrait, footer hanya mode normal,
     harga otomatis berdasarkan jumlah halaman (≤ setengah A4 = 1000, > setengah = 2000),
     preview ringan, generate PDF full resolusi,
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

// scale preview supaya ringan
const PREVIEW_SCALE = 0.25; // 25% resolusi A4

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
  darkSwitch.classList.toggle('on', on);
  localStorage.setItem('theme', on ? 'dark' : 'light');
});

/* UI handlers */
modeSelect.onchange = () => { 
  hargaPerFotoBox.style.display = modeSelect.value === 'perfoto' ? 'block' : 'none'; 
  updatePricePreview(); 
};
sizeSelect.onchange = () => { 
  customSize.style.display = sizeSelect.value === 'custom' ? 'flex' : 'none'; 
};

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
          if (o>=5 && o<=8){c.width=img.height;c.height=img.width;} else {c.width=img.width;c.height=img.height;}
          switch(o){
            case 2: x.translate(c.width,0); x.scale(-1,1); break;
            case 3: x.translate(c.width,c.height); x.rotate(Math.PI); break;
            case 4: x.translate(0,c.height); x.scale(1,-1); break;
            case 5: x.rotate(0.5*Math.PI); x.scale(1,-1); break;
            case 6: x.translate(c.width,0); x.rotate(0.5*Math.PI); break;
            case 7: x.translate(c.width,c.height); x.rotate(0.5*Math.PI); x.scale(-1,1); break;
            case 8: x.translate(0,c.height); x.rotate(-0.5*Math.PI); break;
            default: break;
          }
          x.drawImage(img,0,0);
          const fixed = new Image();
          fixed.onload=()=>res(fixed);
          try{ fixed.src=c.toDataURL('image/jpeg'); } catch(err){ fixed.src=e.target.result; }
        };
        img.src=e.target.result;
      });
    };
    reader.readAsDataURL(file);
  });
}

/* drawImageCover: fill (cover), rotate landscape -> portrait, clip inset 1px */
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

/* render preview ringan */
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
  let x=marginPx, y=marginPx, rowMaxH=0; const usableHeight=previewH-marginPx-footerPx; let currentPageMaxY=marginPx;

  for(const batch of batches){
    let wcm,hcm;
    if(batch.size==='custom'){ wcm=batch.customW; hcm=batch.customH; } else { [wcm,hcm]=batch.size.split('x').map(Number); }
    const boxW=wcm*pxPerCm, boxH=hcm*pxPerCm;
    const copies=Math.max(1,batch.copy||1);

    for(let cp=0; cp<copies; cp++){
      for(const file of batch.files){
        const img=await loadImageWithEXIF(file);
        if(x+boxW>previewW-marginPx){ x=marginPx; y+=rowMaxH+gap; rowMaxH=0; }
        if(y+boxH>usableHeight){ pages.push(page); page=document.createElement('canvas'); page.width=previewW; page.height=previewH;
          pctx=page.getContext('2d'); pctx.fillStyle='#fff'; pctx.fillRect(0,0,previewW,previewH);
          x=marginPx; y=marginPx; rowMaxH=0; currentPageMaxY=marginPx; }
        drawImageCover(pctx,img,x,y,boxW,boxH,true);
        rowMaxH=Math.max(rowMaxH,boxH); x+=boxW+gap; currentPageMaxY=Math.max(currentPageMaxY,y+boxH);
      }
    }
  }
  pages.push(page); return pages;
}

/* render PDF full resolusi untuk generate */
async function renderAllPagesToCanvases() {
  const fullW = 2480, fullH = 3508;
  const pxPerCm = 118;
  const footerHeightMm=20, footerPx=(footerHeightMm/10)*pxPerCm;
  const marginPx=(Math.max(0,parseFloat(marginInputMm.value)||1)/10)*pxPerCm;
  const gap = Math.max(0,parseInt(gapInput.value)||10);

  const pages=[]; let page=document.createElement('canvas'); page.width=fullW; page.height=fullH;
  let pctx=page.getContext('2d'); pctx.fillStyle='#fff'; pctx.fillRect(0,0,fullW,fullH);
  let x=marginPx, y=marginPx, rowMaxH=0; const usableHeight=fullH-marginPx-footerPx; let currentPageMaxY=marginPx;
  let usedHeightPerPagePx=[];

  for(const batch of batches){
    let wcm,hcm;
    if(batch.size==='custom'){ wcm=batch.customW; hcm=batch.customH; } else { [wcm,hcm]=batch.size.split('x').map(Number); }
    const boxW=wcm*pxPerCm, boxH=hcm*pxPerCm;
    const copies=Math.max(1,batch.copy||1);

    for(let cp=0; cp<copies; cp++){
      for(const file of batch.files){
        const img=await loadImageWithEXIF(file);
        if(x+boxW>fullW-marginPx){ x=marginPx; y+=rowMaxH+gap; rowMaxH=0; }
        if(y+boxH>usableHeight){ usedHeightPerPagePx.push(Math.max(currentPageMaxY,marginPx));
          pages.push(page); page=document.createElement('canvas'); page.width=fullW; page.height=fullH;
          pctx=page.getContext('2d'); pctx.fillStyle='#fff'; pctx.fillRect(0,0,fullW,fullH);
          x=marginPx; y=marginPx; rowMaxH=0; currentPageMaxY=marginPx; }
        drawImageCover(pctx,img,x,y,boxW,boxH,true);
        pctx.strokeStyle='#000'; pctx.lineWidth=2; pctx.strokeRect(x,y,boxW,boxH);
        rowMaxH=Math.max(rowMaxH,boxH); x+=boxW+gap; currentPageMaxY=Math.max(currentPageMaxY,y+boxH);
      }
    }
  }
  usedHeightPerPagePx.push(Math.max(currentPageMaxY,marginPx));
  pages.push(page);
  const canvasHeightMm=297;
  const usedMmPerPage = usedHeightPerPagePx.map(px => (px/fullH)*canvasHeightMm);
  return { pages, usedMmPerPage, totalPhotosCount: batches.reduce((a,b)=>a+(b.files.length||0)*(b.copy||1),0) };
}

/* hitung harga: ≤ setengah A4 = 1000, > setengah = 2000 */
function hitungHargaDariUsedMm(usedMmPerPage){
  let totalHarga=0; const halfPageMm=297/2;
  usedMmPerPage.forEach(used => { totalHarga += used<=halfPageMm ? 1000 : 2000; });
  return totalHarga;
}

/* tampil halaman canvas */
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

/* tombol preview */
previewBtn.onclick = async () => {
  previewBtn.disabled=true; previewBtn.textContent='🔁 Memproses...';
  try{
    pagesCache=await renderPreviewPages();
    showPageAtIndex(0);
    await updatePricePreview();
  }catch(err){ console.error(err); alert('Error preview. Coba ulangi.'); }
  finally{ previewBtn.disabled=false; previewBtn.textContent='👁️ Preview Cepat'; }
};

/* tombol generate PDF */
generateBtn.onclick = async () => {
  generateBtn.disabled=true; generateBtn.textContent='🔁 Memproses...';
  try{
    const { pages, usedMmPerPage, totalPhotosCount } = await renderAllPagesToCanvases();
    pagesCache=pages;
    const totalHarga = modeSelect.value==='normal'?hitungHargaDariUsedMm(usedMmPerPage):totalPhotosCount*(parseInt(hargaPerFotoInput.value)||1000);
    showPageAtIndex(0);
    priceDisplay.textContent=`Harga: Rp ${totalHarga.toLocaleString()}`;
  }catch(err){ console.error(err); alert('Terjadi error saat membuat kolase.'); }
  finally{ generateBtn.disabled=false; generateBtn.textContent='📄 Buat Kolase'; }
};

prevPageBtn.onclick = () => showPageAtIndex(currentPageIndex-1);
nextPageBtn.onclick = () => showPageAtIndex(currentPageIndex+1);

/* DOWNLOAD PDF */
downloadPdf.onclick = async () => {
  if(!batches.length) return alert('Belum ada foto/batch.');
  downloadPdf.disabled=true; downloadPdf.textContent='⏳ Menyiapkan PDF...';
  try{
    const { pages, usedMmPerPage, totalPhotosCount } = await renderAllPagesToCanvases();
    const totalHarga = modeSelect.value==='normal'?hitungHargaDariUsedMm(usedMmPerPage):totalPhotosCount*(parseInt(hargaPerFotoInput.value)||1000);

    if(modeSelect.value==='normal'){
      const lastCanvas=pages[pages.length-1]; const lastCtx=lastCanvas.getContext('2d');
      const fullW=lastCanvas.width, fullH=lastCanvas.height;
      const pxPerCm=118, footerHeightMm=20, footerPx=(footerHeightMm/10)*pxPerCm, footerFontSize=48;
      lastCtx.font=`${footerFontSize}px Poppins`; lastCtx.fillStyle='#333';
      const footerX=(Math.max(20,(parseFloat(marginInputMm.value)||5)/10*pxPerCm))+20;
      const footerYName=fullH-footerPx+30, footerYPrice=footerYName+footerFontSize+6;
      lastCtx.fillText(`Nama: ${userName.value||'-'}`,footerX,footerYName);
      lastCtx.fillText(`Harga: Rp ${totalHarga.toLocaleString()}`,footerX,footerYPrice);
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p','pt','a4');
    pages.forEach((pg,i)=>{ if(i>0) pdf.addPage(); pdf.addImage(pg.toDataURL('image/jpeg',0.92),'JPEG',0,0,595,842); });
    const pdfBlob=pdf.output('blob'); window.open(URL.createObjectURL(pdfBlob),'_blank');
  }catch(err){ console.error(err); alert('Gagal membuat PDF.'); }
  finally{ downloadPdf.disabled=false; downloadPdf.textContent='💾 Buka PDF di Tab Baru'; }
};

/* reset semua */
resetBtn.onclick=()=>{
  if(!confirm('Reset semua batch dan preview?')) return;
  batches=[]; refreshBatchList(); pagesCache=[]; currentPageIndex=0;
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
  priceDisplay.textContent='Harga: Rp 0';
  userName.value='SEDULUR FOTOCOPY';
  pageNav.style.display='none'; pageIndicator.textContent='Halaman 0 / 0';
};

/* update harga preview */
async function updatePricePreview(){
  if(!batches.length){ priceDisplay.textContent='Harga: Rp 0 (preview)'; return; }
  try{
    const { usedMmPerPage } = await renderAllPagesToCanvases();
    const previewPrice = hitungHargaDariUsedMm(usedMmPerPage);
    priceDisplay.textContent=`Harga: Rp ${previewPrice.toLocaleString()} (preview)`;
  }catch(err){ console.error(err); priceDisplay.textContent='Harga: Rp 0 (preview error)'; }
}

/* inisialisasi kanvas */
ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
