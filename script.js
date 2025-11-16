/* ============================================================
   SCRIPT.JS FINAL v3 (Layout 3 Kolom + Log Aktivitas)
   ============================================================ */

/* ------------------ ELEMENTS ------------------ */

const upload = document.getElementById('upload');
const dropArea = document.getElementById('dropArea');
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

const circleControls = document.getElementById('circleControls');
const circleDiameter = document.getElementById('circleDiameter');

const hargaPerFotoBox = document.getElementById('hargaPerFotoBox');
const hargaPerFotoInput = document.getElementById('hargaPerFoto');

const laprakMode = document.getElementById('laprakMode');
const laprakControls = document.getElementById('laprakControls');
const laprakPrice = document.getElementById('laprakPrice');
const hideInfo = document.getElementById('hideInfo');

const manualHargaCheckbox = document.getElementById('manualHargaCheckbox');
const manualHargaBox = document.getElementById('manualHargaBox');
const manualHargaInput = document.getElementById('manualHargaInput');

const pageNav = document.getElementById('pageNav');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageIndicator = document.getElementById('pageIndicator');

const logBox = document.getElementById("logContent");


/* ------------------ LOG FUNCTION ------------------ */
function addLog(text) {
    const t = new Date();
    const time = `[${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}]`;
    logBox.innerHTML += `${time} • ${text}<br>`;
    logBox.scrollTop = logBox.scrollHeight;
}


/* ------------------ GLOBAL STATE ------------------ */

let allImages = [];
let pages = [];
let currentPage = 0;


/* ------------------ UTILS ------------------ */

function mmToPx(mm) {
    return (mm * 300) / 25.4;
}

function cmToPx(cm) {
    return (cm * 300) / 2.54;
}


/* ============================================================
                         UPLOAD FOTO
   ============================================================ */

dropArea.addEventListener("click", () => upload.click());

dropArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropArea.classList.add("hover");
});

dropArea.addEventListener("dragleave", () => {
    dropArea.classList.remove("hover");
});

dropArea.addEventListener("drop", async (e) => {
    e.preventDefault();
    dropArea.classList.remove("hover");

    const files = [...e.dataTransfer.files];

    await handleFiles(files);
});

upload.onchange = async (e) => {
    const files = [...e.target.files];
    await handleFiles(files);
};

async function handleFiles(files) {
    if (files.length === 0) return;

    for (const file of files) {
        const img = await loadImage(file);
        allImages.push(img);
    }

    addLog(`Upload ${files.length} foto berhasil`);
    updateBatchList();
}

function loadImage(file) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}


/* ============================================================
                     BATCH LIST (DAFTAR FOTO)
   ============================================================ */

function updateBatchList() {
    batchList.innerHTML = "";
    allImages.forEach((img, i) => {
        const row = document.createElement("div");
        row.className = "batch-row";
        row.innerHTML = `
            <span>Foto ${i + 1}</span>
            <button data-id="${i}" class="del-btn">Hapus</button>
        `;
        batchList.appendChild(row);
    });

    document.querySelectorAll(".del-btn").forEach(btn => {
        btn.onclick = () => deleteImage(btn.dataset.id);
    });
}

function deleteImage(id) {
    allImages.splice(id, 1);
    updateBatchList();
    addLog(`Foto ke-${Number(id)+1} dihapus`);
}


/* ============================================================
                        MODE SELECTOR
   ============================================================ */

modeSelect.onchange = () => {
    const val = modeSelect.value;

    circleControls.style.display = val === "circle" ? "block" : "none";
    hargaPerFotoBox.style.display = val === "perfoto" ? "block" : "none";

    addLog(`Mode berubah ke: ${val}`);
};


/* ============================================================
                        CUSTOM SIZE
   ============================================================ */

sizeSelect.onchange = () => {
    customSize.style.display = (sizeSelect.value === "custom") ? "flex" : "none";
};


/* ============================================================
                        LAPRAK MODE
   ============================================================ */

laprakMode.onchange = () => {
    laprakControls.style.display = laprakMode.checked ? "block" : "none";
};


/* ============================================================
                      MANUAL HARGA
   ============================================================ */

manualHargaCheckbox.onchange = () => {
    manualHargaBox.style.display = manualHargaCheckbox.checked ? "block" : "none";
};


/* ============================================================
                       PREVIEW & GENERATE
   ============================================================ */

previewBtn.onclick = () => {
    if (allImages.length === 0) {
        addLog("⚠ Tidak ada foto untuk di-preview");
        return;
    }
    generateCollage(false);
    addLog("Preview selesai");
};

generateBtn.onclick = () => {
    if (allImages.length === 0) {
        addLog("⚠ Tidak ada foto untuk dibuat kolase");
        return;
    }
    generateCollage(true);
    addLog("Kolase berhasil dibuat");
};


/* ============================================================
                    FUNGSI GENERATE KOLASE
   ============================================================ */

function generateCollage(finalMode = false) {
    const pageWidth = canvas.width;
    const pageHeight = canvas.height;

    const margin = mmToPx(Number(marginInputMm.value));
    const gap = Number(gapInput.value);

    let w, h;

    if (sizeSelect.value === "custom") {
        w = cmToPx(Number(customW.value));
        h = cmToPx(Number(customH.value));
    } else {
        const [cw, ch] = sizeSelect.value.split("x").map(Number);
        w = cmToPx(cw);
        h = cmToPx(ch);
    }

    pages = [];
    let tempCanvas = document.createElement("canvas");
    tempCanvas.width = pageWidth;
    tempCanvas.height = pageHeight;
    let tempCtx = tempCanvas.getContext("2d");

    let x = margin, y = margin;

    tempCtx.fillStyle = "#ffffff";
    tempCtx.fillRect(0, 0, pageWidth, pageHeight);

    allImages.forEach((img, index) => {

        let drawWidth = w;
        let drawHeight = h;

        // Rotasi otomatis landscape → portrait
        if (img.width > img.height) {
            let temp = drawWidth;
            drawWidth = drawHeight;
            drawHeight = temp;
        }

        if (x + drawWidth > pageWidth - margin) {
            x = margin;
            y += drawHeight + gap;
        }
        if (y + drawHeight > pageHeight - margin) {
            pages.push(tempCanvas);
            tempCanvas = document.createElement("canvas");
            tempCanvas.width = pageWidth;
            tempCanvas.height = pageHeight;
            tempCtx = tempCanvas.getContext("2d");
            tempCtx.fillStyle = "#ffffff";
            tempCtx.fillRect(0, 0, pageWidth, pageHeight);
            x = margin;
            y = margin;
        }

        tempCtx.drawImage(img, x, y, drawWidth, drawHeight);
        x += drawWidth + gap;
    });

    pages.push(tempCanvas);
    currentPage = 0;

    updatePage();
}


/* ============================================================
                       PAGINATION
   ============================================================ */

function updatePage() {
    if (pages.length === 0) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(pages[currentPage], 0, 0);

    pageIndicator.innerText = `Halaman ${currentPage + 1} / ${pages.length}`;
    pageNav.style.display = pages.length > 1 ? "flex" : "none";
}

prevPageBtn.onclick = () => {
    if (currentPage > 0) {
        currentPage--;
        updatePage();
        addLog(`Halaman → ${currentPage + 1}`);
    }
};

nextPageBtn.onclick = () => {
    if (currentPage < pages.length - 1) {
        currentPage++;
        updatePage();
        addLog(`Halaman → ${currentPage + 1}`);
    }
};


/* ============================================================
                         EXPORT PDF
   ============================================================ */

downloadPdf.onclick = async () => {
    if (pages.length === 0) {
        addLog("⚠ PDF gagal dibuat (belum ada kolase)");
        return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "pt", "a4");

    pages.forEach((pg, i) => {
        if (i > 0) pdf.addPage();
        pdf.addImage(pg.toDataURL("image/jpeg", 1), "JPEG", 0, 0, 595, 842);
    });

    pdf.output("dataurlnewwindow");
    addLog("PDF dibuka di tab baru");
};


/* ============================================================
                          RESET
   ============================================================ */

resetBtn.onclick = () => {
    allImages = [];
    pages = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    batchList.innerHTML = "";
    addLog("Semua data di-reset");
};

