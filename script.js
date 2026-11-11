// ================= CONFIG: กรอบรูป =================
// แต่ละกรอบเป็น PNG ขนาด 1080x1920 ที่เจาะช่องรูปให้โปร่งใส
//   src   : path ของไฟล์
//   slots : ช่องรูป (พิกัดพิกเซลบนไฟล์กรอบ 1080x1920) เรียงตามลำดับช็อต
//           จำนวนช่อง = จำนวนช็อตที่กรอบนี้ใช้ได้
//           ไม่ใส่ slots = กรอบแบบทับเฉย ๆ ใช้กับทุกจำนวนช็อต
const FRAMES = [
    {
        src: 'frames/unlock-multiskills.png',
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

// URL ของ Google Apps Script สำหรับอัปโหลด (เว้นว่าง = ปิดการอัปโหลด)
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw4F0bouElg00hvU3tvvsKZcY6xfx60rx-h8JoLNPc9tynYHALTI8mkCgVFbUx20IYJ/exec';

// ================= Layout Settings =================
const canvasWidth = 540;
const canvasHeight = 960;
let totalPhotos = 3;          // 3 = เรียงแนวตั้ง 1 แถว, 4 = ตาราง 2x2
const padLeftRight = 25;
const padTop = 25;
const padBottom = 180;        // พื้นที่ด้านล่างตอน 3 ช็อต
const padBottom4 = 350;       // พื้นที่ด้านล่างตอน 4 ช็อต (เว้นไว้ใส่โลโก้/สติกเกอร์)
const gap = 15;

let cols, rows;
let photoWidth;
let photoHeight;
let photoPositions = [];      // พิกัดมุมซ้ายบนของแต่ละช็อต

// ================= DOM =================
const video = document.getElementById('webcam');
const cameraSectionWrapper = document.getElementById('camera-section-wrapper');
const editorLayout = document.getElementById('editor-layout');
const snapBtn = document.getElementById('snap-btn');
const countdownDisplay = document.getElementById('countdown-display');
const flashEffect = document.getElementById('flash-effect');

let canvas;
let stream;
let capturedPhotos = [];      // ภาพเต็มจากกล้อง (กลับด้านแล้ว) ยังไม่ครอป
let photoObjs = [];           // รูปถ่ายบน canvas
let currentFrameObj = null;
let currentFrame = null;      // config ของกรอบที่เลือกอยู่

// ================= สร้างปุ่มกรอบ / สติกเกอร์จาก CONFIG =================
function makeThumb(src, onClick) {
    const img = document.createElement('img');
    img.src = src;
    img.className = 'thumb-btn';
    img.alt = src.split('/').pop();
    img.loading = 'lazy';
    img.addEventListener('click', () => onClick(img));
    return img;
}

// กรอบที่มีช่องรูปใช้ได้เฉพาะจำนวนช็อตที่ตรงกัน
function frameFits(frame) {
    return !frame.slots || frame.slots.length === totalPhotos;
}

function makeEmptyNote(text) {
    const p = document.createElement('p');
    p.className = 'empty-note';
    p.textContent = text;
    return p;
}

function renderFrameList() {
    const list = document.getElementById('frame-list');
    list.innerHTML = '';
    if (FRAMES.length === 0) {
        list.appendChild(makeEmptyNote('No frames yet'));
        return;
    }
    FRAMES.forEach(frame => {
        const thumb = makeThumb(frame.src, () => addFrame(frame));
        thumb.dataset.slots = frame.slots ? frame.slots.length : '';
        list.appendChild(thumb);
    });
    updateFrameAvailability();
}

// ทำปุ่มกรอบที่ใช้กับจำนวนช็อตปัจจุบันไม่ได้ให้จางลง
function updateFrameAvailability() {
    document.querySelectorAll('#frame-list .thumb-btn').forEach(thumb => {
        const n = thumb.dataset.slots;
        const fits = !n || Number(n) === totalPhotos;
        thumb.classList.toggle('thumb-unavailable', !fits);
        thumb.title = fits ? '' : `กรอบนี้ใช้กับ ${n} ช็อต`;
    });
}

function renderStickerCategories() {
    const tabs = document.getElementById('category-tabs');
    const panels = document.getElementById('sticker-panels');
    tabs.innerHTML = '';
    panels.innerHTML = '';

    STICKER_CATEGORIES.forEach((cat, i) => {
        const btn = document.createElement('button');
        btn.className = 'cat-btn' + (i === 0 ? ' active' : '');
        btn.textContent = cat.label;
        btn.addEventListener('click', () => showCategory(cat.id, btn));
        tabs.appendChild(btn);

        const panel = document.createElement('div');
        panel.id = cat.id;
        panel.className = 'sticker-category';
        panel.style.display = i === 0 ? 'block' : 'none';

        const grid = document.createElement('div');
        grid.className = 'frame-thumbnails';
        if (cat.items.length === 0) {
            grid.appendChild(makeEmptyNote('No stickers yet'));
        } else {
            cat.items.forEach(src => grid.appendChild(makeThumb(src, () => addSticker(src))));
        }
        panel.appendChild(grid);
        panels.appendChild(panel);
    });
}

renderFrameList();
renderStickerCategories();

// คำนวณขนาด/ตำแหน่งรูป + ปรับแถบดำบนกล้องให้ตรงกับสัดส่วนใหม่
function updateLayout() {
    cols = (totalPhotos === 4) ? 2 : 1;
    rows = totalPhotos / cols;
    const bottom = (totalPhotos === 4) ? padBottom4 : padBottom;

    photoWidth = (canvasWidth - (padLeftRight * 2) - gap * (cols - 1)) / cols;
    photoHeight = (canvasHeight - padTop - bottom - gap * (rows - 1)) / rows;

    photoPositions = [];
    for (let i = 0; i < totalPhotos; i++) {
        photoPositions.push({
            x: padLeftRight + (i % cols) * (photoWidth + gap),
            y: padTop + Math.floor(i / cols) * (photoHeight + gap)
        });
    }

    // แถบดำบนกล้อง: ถ้าช่องกว้างกว่ากล้อง ตัดบน-ล่าง / ถ้าช่องแคบกว่า ตัดซ้าย-ขวา
    // ใช้ช่องที่ผอมที่สุด (เลย์เอาต์ปกติ หรือช่องของกรอบที่ใช้กับจำนวนช็อตนี้ได้)
    // จะได้เห็นในกล้องเท่าที่จะติดอยู่ในรูปจริงไม่ว่าจะเลือกกรอบไหน
    let targetRatio = photoWidth / photoHeight;
    FRAMES.forEach(f => {
        if (f.slots && f.slots.length === totalPhotos) {
            f.slots.forEach(s => { targetRatio = Math.min(targetRatio, s.w / s.h); });
        }
    });
    const camRatio = 640 / 480;
    let guideTB = 0, guideLR = 0;
    if (targetRatio > camRatio) {
        guideTB = ((1 - (camRatio / targetRatio)) / 2) * 100;
    } else {
        guideLR = ((1 - (targetRatio / camRatio)) / 2) * 100;
    }
    document.getElementById('guide-top').style.height = guideTB + '%';
    document.getElementById('guide-bottom').style.height = guideTB + '%';
    document.getElementById('guide-left').style.width = guideLR + '%';
    document.getElementById('guide-right').style.width = guideLR + '%';
}
updateLayout();

// ================= 0. ปุ่มเลือกจำนวนช็อต =================
document.querySelectorAll('.shot-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        totalPhotos = Number(btn.dataset.shots);
        document.querySelectorAll('.shot-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateLayout();
        updateFrameAvailability();
    });
});

// ================= 1. เปิดกล้อง =================
navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
    .then(s => {
        stream = s;
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play().catch(e => console.error('Play error:', e));
        };
    })
    .catch(err => {
        console.error('Camera Error:', err);
        alert('ไม่สามารถเปิดกล้องได้: ' + err.message);
    });

// ================= 2. ถ่ายรูป =================
snapBtn.addEventListener('click', () => {
    capturedPhotos = [];
    snapBtn.disabled = true;
    document.querySelectorAll('.shot-btn').forEach(b => b.disabled = true); // ล็อกปุ่มเลือกช็อต
    startCountdownForPhoto(1);
});

function startCountdownForPhoto(photoNumber) {
    let count = 5;
    countdownDisplay.style.display = 'block';
    countdownDisplay.innerText = count;
    snapBtn.innerText = `📸 Taking Photo ${photoNumber} / ${totalPhotos}...`;

    const timer = setInterval(() => {
        count--;
        if (count > 0) {
            countdownDisplay.innerText = count;
        } else if (count === 0) {
            countdownDisplay.innerText = 'Cheese! 📸';
        } else {
            clearInterval(timer);
            countdownDisplay.style.display = 'none';
            captureSinglePhoto();
            if (capturedPhotos.length < totalPhotos) {
                setTimeout(() => startCountdownForPhoto(capturedPhotos.length + 1), 1000);
            } else {
                goToEditor();
            }
        }
    }, 1000);
}

function captureSinglePhoto() {
    flashEffect.classList.add('flash-animate');
    setTimeout(() => flashEffect.classList.remove('flash-animate'), 500);

    // เก็บภาพเต็มจากกล้อง แล้วค่อยครอปตอนวางลงช่อง (ช่องของแต่ละกรอบสัดส่วนไม่เท่ากัน)
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    // กลับด้านเหมือนกระจก
    tempCtx.translate(tempCanvas.width, 0);
    tempCtx.scale(-1, 1);
    tempCtx.drawImage(video, 0, 0);
    capturedPhotos.push(tempCanvas.toDataURL('image/jpeg', 0.95));
}

// ================= 3. หน้าตกแต่ง =================
function goToEditor() {
    if (stream) stream.getTracks().forEach(track => track.stop());
    cameraSectionWrapper.style.display = 'none';
    editorLayout.style.display = 'flex';

    if (!canvas) {
        canvas = new fabric.Canvas('fabric-canvas', {
            width: canvasWidth, height: canvasHeight,
            backgroundColor: '#ffffff', preserveObjectStacking: true
        });
    } else {
        canvas.clear();
        canvas.backgroundColor = '#ffffff';
        currentFrameObj = null;
    }

    photoObjs = [];
    currentFrame = null;
    updateFrameAvailability();
    placePhotos(defaultSlots());
}

// ช่องรูปตามเลย์เอาต์ปกติ (ไม่มีกรอบ) ในหน่วยของ canvas
function defaultSlots() {
    return photoPositions.map(p => ({ x: p.x, y: p.y, w: photoWidth, h: photoHeight }));
}

// ช่องรูปของกรอบ แปลงจากพิกเซลบนไฟล์กรอบเป็นหน่วยของ canvas
function frameSlots(frame, img) {
    const sx = canvasWidth / img.width, sy = canvasHeight / img.height;
    return frame.slots.map(s => ({ x: s.x * sx, y: s.y * sy, w: s.w * sx, h: s.h * sy }));
}

// วางรูปถ่ายลงช่อง: ขยายให้เต็มช่อง (cover) แล้วตัดส่วนเกินด้วย clipPath
function placePhotos(slots) {
    photoObjs.forEach(o => canvas.remove(o));
    photoObjs = new Array(capturedPhotos.length);
    let loaded = 0;
    capturedPhotos.forEach((photoDataUrl, index) => {
        fabric.Image.fromURL(photoDataUrl, function (img) {
            const slot = slots[index];
            const scale = Math.max(slot.w / img.width, slot.h / img.height);
            img.set({
                scaleX: scale, scaleY: scale,
                left: slot.x + (slot.w - img.width * scale) / 2,
                top: slot.y + (slot.h - img.height * scale) / 2,
                clipPath: new fabric.Rect({
                    left: slot.x, top: slot.y, width: slot.w, height: slot.h,
                    absolutePositioned: true
                }),
                selectable: false, evented: false
            });
            photoObjs[index] = img;
            loaded++;
            if (loaded === capturedPhotos.length) {
                // ใส่รูปไว้ชั้นล่างสุดตามลำดับ กรอบและสติกเกอร์จะอยู่ด้านบน
                for (let i = photoObjs.length - 1; i >= 0; i--) {
                    canvas.add(photoObjs[i]); photoObjs[i].sendToBack();
                }
                canvas.renderAll();
            }
        });
    });
}

// กรอบรูป: อยู่เหนือรูปถ่าย ใต้สติกเกอร์
function addFrame(frame) {
    if (!frameFits(frame)) {
        alert(`กรอบนี้ใช้กับ ${frame.slots.length} ช็อต (ตอนนี้ถ่าย ${totalPhotos} ช็อต)`);
        return;
    }
    fabric.Image.fromURL(frame.src, function (img, isError) {
        if (isError || !img || !img.width) { alert('หาไฟล์กรอบไม่เจอ: ' + frame.src); return; }
        if (currentFrameObj) canvas.remove(currentFrameObj);
        // ย้ายรูปถ่ายเข้าช่องของกรอบ (หรือกลับเลย์เอาต์ปกติถ้ากรอบไม่มีช่อง)
        placePhotos(frame.slots ? frameSlots(frame, img) : defaultSlots());
        currentFrame = frame;
        img.set({
            left: 0, top: 0,
            scaleX: canvas.width / img.width, scaleY: canvas.height / img.height,
            selectable: false, evented: false
        });
        // ไว้ล่างสุดก่อน แล้วรูปถ่ายจะถูกแทรกไว้ใต้กรอบอีกที (สติกเกอร์อยู่บนกรอบเสมอ)
        canvas.add(img); img.moveTo(0);
        currentFrameObj = img; canvas.renderAll();
    }, { crossOrigin: 'anonymous' });
}

function removeFrame() {
    if (currentFrameObj) {
        canvas.remove(currentFrameObj); currentFrameObj = null;
        if (currentFrame && currentFrame.slots) placePhotos(defaultSlots());
        currentFrame = null;
        canvas.renderAll();
    }
}

// สติกเกอร์: อยู่บนสุด ลาก/ย่อ/หมุนได้
function addSticker(url) {
    fabric.Image.fromURL(url, function (img, isError) {
        if (isError || !img || !img.width) { alert('หาไฟล์สติกเกอร์ไม่เจอ: ' + url); return; }
        img.set({ scaleX: 0.25, scaleY: 0.25, transparentCorners: false, cornerColor: '#dbc7eb', cornerSize: 12, cornerStyle: 'circle' });
        canvas.add(img); img.center().setCoords(); canvas.setActiveObject(img);
    }, { crossOrigin: 'anonymous' });
}

function deleteSelected() {
    if (!canvas) return;
    const activeObject = canvas.getActiveObject();
    if (activeObject) canvas.remove(activeObject);
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
});

function showCategory(categoryId, btnElement) {
    document.querySelectorAll('.sticker-category').forEach(cat => cat.style.display = 'none');
    document.querySelectorAll('.cat-btn').forEach(btn => btn.classList.remove('active'));
    const target = document.getElementById(categoryId);
    if (target) {
        target.style.display = 'block';
        btnElement.classList.add('active');
    }
}

// ================= 4. บันทึกรูป (1080x1920) =================
document.getElementById('download-btn').addEventListener('click', () => {
    canvas.discardActiveObject().renderAll();
    const dataURL = canvas.toDataURL({ format: 'png', quality: 1, multiplier: 2 });
    const link = document.createElement('a');
    link.download = 'booth_photo.png'; link.href = dataURL; link.click();
});

// ================= 5. ถ่ายใหม่ =================
document.getElementById('retake-btn').addEventListener('click', () => {
    if (confirm('ถ่ายใหม่? รูปที่ตกแต่งไว้จะหายไป')) location.reload();
});

// ================= 6. อัปโหลด + QR Code =================
async function uploadToDrive() {
    const modal = document.getElementById('qr-modal');
    const qrDisplay = document.getElementById('qr-display');
    const linkArea = document.getElementById('qr-link-area');
    const title = document.getElementById('modal-title');

    modal.style.display = 'flex';
    linkArea.style.display = 'none';

    if (!SCRIPT_URL) {
        title.innerText = 'Not set up yet';
        qrDisplay.innerHTML = '<span style="font-size:14px;">ยังไม่ได้ตั้งค่า SCRIPT_URL ใน script.js</span>';
        linkArea.style.display = 'block';
        return;
    }

    title.innerText = 'Wait a second...';
    qrDisplay.innerHTML = '<div class="loading-spinner"></div><span>Uploading & Backing up...</span>';
    try {
        canvas.discardActiveObject().renderAll();
        const photoDataURL = canvas.toDataURL({ format: 'png', quality: 0.8, multiplier: 2 });

        // สำรองไฟล์ลงเครื่องก่อน เผื่ออัปโหลดไม่สำเร็จ
        const backupLink = document.createElement('a');
        backupLink.href = photoDataURL; backupLink.download = 'booth_backup_' + Date.now() + '.png'; backupLink.click();

        const payload = JSON.stringify({
            photoBase64: photoDataURL,
            sessionName: 'Booth_' + new Date().toISOString().replace(/[:.]/g, '-'),
            photoName: 'final_photo.png'
        });
        const response = await fetch(SCRIPT_URL, { method: 'POST', mode: 'cors', body: payload });
        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message);

        const qrImageUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(result.folderUrl);
        title.innerText = 'Success! ✨';
        qrDisplay.innerHTML = '<img src="' + qrImageUrl + '" style="width:180px;border-radius:10px;"><p style="font-size:14px;margin-top:10px;">สแกนเพื่อรับรูปของคุณ</p>';
    } catch (error) {
        console.error('Upload error:', error);
        title.innerText = 'Error ❌';
        qrDisplay.innerHTML = '<span style="color:red;font-size:14px;">Upload failed. แต่คุณมีไฟล์สำรองในเครื่องแล้ว!</span>';
    }
    linkArea.style.display = 'block';
}

function closeQRModal() { document.getElementById('qr-modal').style.display = 'none'; }
