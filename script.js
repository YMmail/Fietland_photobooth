// ================= ขนาดรูป =================
const OUT_W = 1080, OUT_H = 1920;        // ขนาดไฟล์ที่เซฟ (9:16)
const CANVAS_W = 540, CANVAS_H = 960;    // ขนาดทำงานบน canvas (ตอนเซฟขยาย x2)
const K = CANVAS_W / OUT_W;

// ช่องรูปแบบแถบแนวตั้งสำหรับกรอบสีพื้น (พิกัดเป็นพิกเซลบนรูป 1080x1920)
function stripSlots(cuts, ratio) {
    const top = 60, bottom = 240, gap = 28, side = 90;
    let h = (OUT_H - top - bottom - gap * (cuts - 1)) / cuts;
    let w = h * ratio;
    if (w > OUT_W - side * 2) { w = OUT_W - side * 2; h = w / ratio; }
    const totalH = h * cuts + gap * (cuts - 1);
    const y0 = top + (OUT_H - top - bottom - totalH) / 2;
    return Array.from({ length: cuts }, (_, i) => ({
        x: Math.round((OUT_W - w) / 2), y: Math.round(y0 + i * (h + gap)),
        w: Math.round(w), h: Math.round(h)
    }));
}

function plainFrame(name, color, cuts) {
    return { name, color, cuts, slots: stripSlots(cuts, cuts === 3 ? 4 / 3 : 3 / 2) };
}

// ================= CONFIG: กรอบรูป =================
// แต่ละกรอบมี:
//   name  : ชื่อที่แสดง
//   cuts  : จำนวนช็อต (3 หรือ 4)
//   slots : ช่องรูป พิกัดพิกเซลบนรูป 1080x1920 เรียงตามลำดับช็อต
//           สัดส่วนของช่อง = สัดส่วนกล้องตอนถ่าย
//   color : สีพื้นหลังกรอบ (ถ้ามี)
//   src   : ไฟล์ PNG 1080x1920 ที่เจาะช่องรูปให้โปร่งใส (ถ้ามี) วางทับบนรูปถ่าย
const FRAMES = [
    plainFrame('Classic White', '#ffffff', 3),
    plainFrame('Lavender', '#dbc7eb', 3),
    plainFrame('Pink', '#f6cfdc', 3),
    plainFrame('Butter', '#f7eeca', 3),
    {
        name: 'Cloud Frame', cuts: 3, color: '#bfe3f7',
        src: 'frames/cloud-frame.png',
        slots: [
            { x: 135, y: 86, w: 797, h: 482 },
            { x: 135, y: 631, w: 797, h: 482 },
            { x: 131, y: 1176, w: 797, h: 512 },
        ],
    },
    {
        name: 'Window Frame', cuts: 3, color: '#d0d0d0',
        src: 'frames/window-frame.png',
        slots: [
            { x: 156, y: 261, w: 712, h: 441 },
            { x: 156, y: 722, w: 713, h: 442 },
            { x: 156, y: 1179, w: 713, h: 446 },
        ],
    },

    plainFrame('Classic White', '#ffffff', 4),
    plainFrame('Lavender', '#dbc7eb', 4),
    plainFrame('Pink', '#f6cfdc', 4),
    plainFrame('Butter', '#f7eeca', 4),
    {
        name: 'Game Frame', cuts: 4, color: '#0d0b2e',
        src: 'Game_frames.png',
        slots: [
            { x: 92, y: 127, w: 397, h: 643 },
            { x: 591, y: 127, w: 397, h: 643 },
            { x: 92, y: 832, w: 397, h: 642 },
            { x: 591, y: 832, w: 397, h: 642 },
        ],
    },
];

// หมวดสติกเกอร์: ใส่ path ไฟล์ใน items เช่น items: ['stickers/deco/heart.png']
const STICKER_CATEGORIES = [
    { id: 'cat-1', label: '✨ deco', items: [] },
    { id: 'cat-2', label: '🎪 festival', items: [] },
    { id: 'cat-3', label: '🐣 cmm', items: [] },
    { id: 'cat-4', label: '🍭 sweets', items: [] },
];

// URL ของ Google Apps Script สำหรับอัปโหลด (เว้นว่าง = ไม่อัปโหลด ไม่มี QR)
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw4F0bouElg00hvU3tvvsKZcY6xfx60rx-h8JoLNPc9tynYHALTI8mkCgVFbUx20IYJ/exec';

const COUNTDOWN_SECONDS = 5;

// QR ที่แสดงหลังกด Save: พาไปโฟลเดอร์ Google Drive ที่เก็บรูป
const QR_IMAGE = 'ui/qr-fietland-drive.png';

// ================= DOM =================
const $ = id => document.getElementById(id);
const views = { frame: $('view-frame'), photo: $('view-photo'), edit: $('view-edit') };
const video = $('webcam');
const cameraBox = $('camera-box');
const snapBtn = $('snap-btn');
const changeFrameBtn = $('change-frame-btn');
const countdownDisplay = $('countdown-display');
const flashEffect = $('flash-effect');
const saveBtn = $('save-btn');
const qrCard = $('qr-card');
const qrDisplay = $('qr-display');

// ================= State =================
let frame = null;         // กรอบที่เลือก
let shots = [];           // dataURL ของรูปที่ถ่ายแล้ว (ครอปตามช่องแล้ว)
let shooting = false;
let stream = null;
let canvas = null;
let saved = false;

// ================= ตัวช่วย =================
function ratioLabel(r) {
    for (let q = 1; q <= 10; q++) {
        const p = Math.round(r * q);
        if (p > 0 && Math.abs(p / q - r) / r < 0.015) return `${p}:${q}`;
    }
    return r.toFixed(2);
}

function loadFabricImage(url) {
    return new Promise((resolve, reject) => {
        fabric.Image.fromURL(url, (img, isError) => {
            if (isError || !img || !img.width) reject(new Error('โหลดรูปไม่ได้: ' + url));
            else resolve(img);
        }, { crossOrigin: 'anonymous' });
    });
}

function setStep(n) {
    document.querySelectorAll('.step').forEach(el => {
        const s = Number(el.dataset.step);
        el.classList.toggle('active', s === n);
        el.classList.toggle('done', s < n);
    });
}

function showView(name) {
    Object.entries(views).forEach(([k, el]) => { el.hidden = k !== name; });
    window.scrollTo({ top: 0 });
}

// ================= ขั้นที่ 1: เลือกกรอบ =================
function drawFrameThumb(f, cnv) {
    const W = cnv.width = 180, H = cnv.height = 320, k = W / OUT_W;
    const ctx = cnv.getContext('2d');
    const paint = (overlay) => {
        ctx.fillStyle = f.color || '#ffffff';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#d9d0e2';
        f.slots.forEach(s => ctx.fillRect(s.x * k, s.y * k, s.w * k, s.h * k));
        if (overlay) ctx.drawImage(overlay, 0, 0, W, H);
    };
    paint(null);
    if (f.src) {
        const img = new Image();
        img.onload = () => paint(img);
        img.src = f.src;
    }
}

function renderFrameGroups() {
    const root = $('frame-groups');
    root.innerHTML = '';
    [3, 4].forEach(cuts => {
        const frames = FRAMES.filter(f => f.cuts === cuts);
        if (!frames.length) return;
        const group = document.createElement('div');
        group.className = 'frame-group';
        const h = document.createElement('h2');
        h.textContent = `${cuts} cuts`;
        const small = document.createElement('small');
        small.textContent = `${cuts} photos`;
        h.appendChild(small);
        const grid = document.createElement('div');
        grid.className = 'frame-grid';
        frames.forEach(f => {
            const card = document.createElement('button');
            card.className = 'frame-card';
            card.type = 'button';
            const cnv = document.createElement('canvas');
            drawFrameThumb(f, cnv);
            const name = document.createElement('span');
            name.textContent = f.name;
            card.append(cnv, name);
            card.addEventListener('click', () => { frame = f; goPhoto(); });
            grid.appendChild(card);
        });
        group.append(h, grid);
        root.appendChild(group);
    });
}

function goFrame() {
    stopCamera();
    setStep(1);
    showView('frame');
}

// ================= ขั้นที่ 2: ถ่ายรูป =================
function slotRatio(i) {
    const s = frame.slots[Math.min(i, frame.slots.length - 1)];
    return s.w / s.h;
}

// ปรับกล่องกล้องให้เป็นสัดส่วนเดียวกับช่องรูป
function sizeCamera() {
    if (!frame || views.photo.hidden) return;
    const r = slotRatio(shots.length);
    const colW = cameraBox.parentElement.clientWidth;
    const maxW = Math.min(colW, 640);
    const maxH = Math.min(window.innerHeight * 0.6, 520);
    let w = maxW, h = w / r;
    if (h > maxH) { h = maxH; w = h * r; }
    cameraBox.style.width = Math.round(w) + 'px';
    cameraBox.style.height = Math.round(h) + 'px';
    $('camera-tag').textContent = `${ratioLabel(r)} · ${frame.cuts} cuts`;
}

function renderStrip() {
    const el = $('strip-preview');
    el.innerHTML = '';
    el.style.background = frame.color || '#fff';
    frame.slots.forEach((s, i) => {
        const slot = document.createElement('div');
        slot.className = 'slot';
        slot.style.left = (s.x / OUT_W * 100) + '%';
        slot.style.top = (s.y / OUT_H * 100) + '%';
        slot.style.width = (s.w / OUT_W * 100) + '%';
        slot.style.height = (s.h / OUT_H * 100) + '%';
        if (shots[i]) slot.style.backgroundImage = `url(${shots[i]})`;
        else slot.textContent = i + 1;
        if (i === shots.length && shooting) slot.classList.add('current');
        el.appendChild(slot);
    });
    if (frame.src) {
        const ov = document.createElement('img');
        ov.className = 'overlay';
        ov.src = frame.src;
        ov.alt = '';
        el.appendChild(ov);
    }
}

function updateCounter() {
    const n = Math.min(shots.length + 1, frame.cuts);
    $('photo-counter').textContent = `Photo ${n} of ${frame.cuts}`;
}

async function startCamera() {
    $('camera-error').hidden = true;
    if (stream) return;
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 960 }, facingMode: 'user' }
        });
        video.srcObject = stream;
        await video.play().catch(() => {});
        snapBtn.disabled = false;
    } catch (err) {
        console.error('Camera Error:', err);
        $('camera-error').textContent = 'เปิดกล้องไม่ได้ (' + err.message + ') กดอนุญาตการใช้กล้องใน browser แล้วโหลดหน้าใหม่';
        $('camera-error').hidden = false;
        snapBtn.disabled = true;
    }
}

function stopCamera() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null;
    video.srcObject = null;
}

function goPhoto() {
    shots = [];
    shooting = false;
    snapBtn.textContent = '📷 Take a Photo';
    changeFrameBtn.disabled = false;
    setStep(2);
    showView('photo');
    updateCounter();
    renderStrip();
    sizeCamera();
    startCamera();
}

snapBtn.addEventListener('click', () => {
    if (shooting || !stream) return;
    shooting = true;
    shots = [];
    snapBtn.disabled = true;
    changeFrameBtn.disabled = true;
    shootNext();
});

changeFrameBtn.addEventListener('click', () => { if (!shooting) goFrame(); });

function shootNext() {
    updateCounter();
    sizeCamera();
    renderStrip();
    snapBtn.textContent = `📸 Taking photo ${shots.length + 1} / ${frame.cuts}...`;

    let count = COUNTDOWN_SECONDS;
    countdownDisplay.hidden = false;
    countdownDisplay.textContent = count;
    const timer = setInterval(() => {
        count--;
        if (count > 0) {
            countdownDisplay.textContent = count;
        } else if (count === 0) {
            countdownDisplay.textContent = 'Cheese! 📸';
        } else {
            clearInterval(timer);
            countdownDisplay.hidden = true;
            capturePhoto(shots.length);
            renderStrip();
            if (shots.length < frame.cuts) {
                setTimeout(shootNext, 1000);
            } else {
                shooting = false;
                setTimeout(goEdit, 600);
            }
        }
    }, 1000);
}

// ครอปตรงกลางของกล้องให้ได้สัดส่วนเท่าช่อง แล้วเก็บที่ความละเอียดของรูปที่เซฟ
function capturePhoto(i) {
    flashEffect.classList.add('flash-animate');
    setTimeout(() => flashEffect.classList.remove('flash-animate'), 500);

    const slot = frame.slots[i];
    const r = slot.w / slot.h;
    const vw = video.videoWidth, vh = video.videoHeight;
    let sw, sh;
    if (vw / vh > r) { sh = vh; sw = sh * r; } else { sw = vw; sh = sw / r; }
    const sx = (vw - sw) / 2, sy = (vh - sh) / 2;

    const c = document.createElement('canvas');
    c.width = slot.w;
    c.height = slot.h;
    const ctx = c.getContext('2d');
    ctx.translate(c.width, 0);   // กลับด้านเหมือนกระจก
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, c.width, c.height);
    shots.push(c.toDataURL('image/jpeg', 0.92));
}

// ================= ขั้นที่ 3: ตกแต่ง =================
async function goEdit() {
    stopCamera();
    setStep(3);
    showView('edit');
    resetSave();

    if (!canvas) {
        canvas = new fabric.Canvas('fabric-canvas', {
            width: CANVAS_W, height: CANVAS_H, preserveObjectStacking: true
        });
        canvas.on('object:modified', markDirty);
    }
    canvas.clear();
    canvas.backgroundColor = frame.color || '#ffffff';
    fitCanvas();

    try {
        // ชั้นล่าง: รูปถ่าย
        for (let i = 0; i < shots.length; i++) {
            const img = await loadFabricImage(shots[i]);
            const s = frame.slots[i];
            img.set({
                left: s.x * K, top: s.y * K,
                scaleX: (s.w * K) / img.width, scaleY: (s.h * K) / img.height,
                selectable: false, evented: false
            });
            canvas.add(img);
        }
        // ชั้นกลาง: กรอบ (สติกเกอร์ที่เพิ่มทีหลังจะอยู่บนสุด)
        if (frame.src) {
            const f = await loadFabricImage(frame.src);
            f.set({
                left: 0, top: 0,
                scaleX: CANVAS_W / f.width, scaleY: CANVAS_H / f.height,
                selectable: false, evented: false
            });
            canvas.add(f);
        }
    } catch (err) {
        alert(err.message);
    }
    canvas.renderAll();
}

// ย่อ/ขยายการแสดงผลของ canvas ให้พอดีจอ (ขนาดจริงยังเป็น 540x960)
function fitCanvas() {
    if (!canvas || views.edit.hidden) return;
    const col = document.querySelector('.edit-center');
    const maxH = Math.max(360, Math.min(window.innerHeight - 140, 760));
    const maxW = col.clientWidth || CANVAS_W;
    let h = maxH, w = h * 9 / 16;
    if (w > maxW) { w = maxW; h = w * 16 / 9; }
    canvas.setDimensions({ width: Math.round(w) + 'px', height: Math.round(h) + 'px' }, { cssOnly: true });
    canvas.calcOffset();
}

window.addEventListener('resize', () => { sizeCamera(); fitCanvas(); });

$('retake-btn').addEventListener('click', () => {
    if (confirm('ถ่ายใหม่? รูปและสติกเกอร์ที่ตกแต่งไว้จะหายไป')) goPhoto();
});

// ---------- สติกเกอร์ ----------
function makeEmptyNote(text) {
    const p = document.createElement('p');
    p.className = 'empty-note';
    p.textContent = text;
    return p;
}

function renderStickerCategories() {
    const tabs = $('category-tabs');
    const panels = $('sticker-panels');
    tabs.innerHTML = '';
    panels.innerHTML = '';

    STICKER_CATEGORIES.forEach((cat, i) => {
        const btn = document.createElement('button');
        btn.className = 'cat-btn' + (i === 0 ? ' active' : '');
        btn.textContent = cat.label;
        btn.addEventListener('click', () => {
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b === btn));
            document.querySelectorAll('.sticker-category').forEach(p => { p.hidden = p.id !== cat.id; });
        });
        tabs.appendChild(btn);

        const panel = document.createElement('div');
        panel.id = cat.id;
        panel.className = 'sticker-category';
        panel.hidden = i !== 0;
        const grid = document.createElement('div');
        grid.className = 'sticker-grid';
        if (!cat.items.length) {
            grid.appendChild(makeEmptyNote('No stickers yet'));
        } else {
            cat.items.forEach(src => {
                const img = document.createElement('img');
                img.src = src;
                img.className = 'thumb-btn';
                img.alt = src.split('/').pop();
                img.loading = 'lazy';
                img.addEventListener('click', () => addSticker(src));
                grid.appendChild(img);
            });
        }
        panel.appendChild(grid);
        panels.appendChild(panel);
    });
}

async function addSticker(url) {
    try {
        const img = await loadFabricImage(url);
        const scale = (CANVAS_W * 0.25) / img.width;
        img.set({
            scaleX: scale, scaleY: scale,
            transparentCorners: false, cornerColor: '#dbc7eb', cornerSize: 12, cornerStyle: 'circle'
        });
        canvas.add(img);
        img.center().setCoords();
        canvas.setActiveObject(img);
        markDirty();
    } catch (err) {
        alert(err.message);
    }
}

function deleteSelected() {
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (obj && obj.selectable) { canvas.remove(obj); markDirty(); }
}

$('delete-btn').addEventListener('click', deleteSelected);

window.addEventListener('keydown', (e) => {
    if (views.edit.hidden) return;
    if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
});

// ================= ขั้นที่ 4: เซฟ + QR =================
function resetSave() {
    saved = false;
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 Save Image';
    qrCard.hidden = true;
}

// แก้รูปหลังเซฟ = ต้องเซฟใหม่ (QR เดิมเป็นรูปเก่า)
function markDirty() {
    if (!saved) return;
    resetSave();
    setStep(3);
}

saveBtn.addEventListener('click', async () => {
    if (saved || !canvas) return;
    canvas.discardActiveObject().renderAll();
    const dataURL = canvas.toDataURL({ format: 'png', multiplier: OUT_W / CANVAS_W });

    // เซฟลงเครื่องก่อนเสมอ
    const link = document.createElement('a');
    link.download = 'photobooth_' + Date.now() + '.png';
    link.href = dataURL;
    link.click();

    saved = true;
    setStep(4);
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Saving...';
    qrCard.hidden = false;

    // แสดง QR โฟลเดอร์ Drive ทันที แล้วบอกชื่อไฟล์เมื่ออัปโหลดเสร็จ
    qrDisplay.innerHTML = '';
    const qrImg = document.createElement('img');
    qrImg.src = QR_IMAGE;
    qrImg.alt = 'QR code to the photo folder in Google Drive';
    const status = document.createElement('span');
    status.className = 'qr-status';
    qrDisplay.append(qrImg, status);
    $('qr-hint').textContent = 'Opens the photo folder in Google Drive. Find your photo by its name and download it to your phone.';

    if (!SCRIPT_URL) {
        status.textContent = 'Saved to this device.';
        saveBtn.textContent = '✓ Saved';
        return;
    }

    status.textContent = '⏳ Uploading...';
    try {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const payload = JSON.stringify({
            photoBase64: dataURL,
            fileName: 'Booth_' + stamp + '.png',
            // 2 ค่านี้ไว้ให้ Apps Script ตัวเก่ายังใช้ได้
            sessionName: 'Booth_' + stamp,
            photoName: 'final_photo.png'
        });
        const response = await fetch(SCRIPT_URL, { method: 'POST', mode: 'cors', body: payload });
        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message);
        if (!saved) return;   // แก้รูประหว่างอัปโหลด

        // ไม่มี fileName = Apps Script ที่ทำงานอยู่ยังเป็นตัวเก่า (ยังไม่ได้ Deploy เวอร์ชันใหม่)
        status.textContent = result.fileName
            ? 'Your photo: ' + result.fileName.replace(/\.png$/i, '')
            : '✓ Uploaded (old Apps Script version — file not renamed)';
    } catch (error) {
        console.error('Upload error:', error);
        if (!saved) return;
        status.textContent = 'Upload failed: ' + (error && error.message ? error.message : error) + '. The photo is saved on this device.';
        status.classList.add('error');
    }
    if (saved) saveBtn.textContent = '✓ Saved';
});

// ================= เริ่มต้น =================
renderFrameGroups();
renderStickerCategories();
goFrame();
