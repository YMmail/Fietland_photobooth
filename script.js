// ================= CONFIG: รายการรูป (ตอนนี้ว่างไว้ก่อน) =================
// เพิ่ม path ของไฟล์กรอบ (ควรเป็น PNG พื้นใส ขนาด 1080x1920) ตรงนี้ เช่น
// const FRAMES = ['frames/frame1.png', 'frames/frame2.png'];
const FRAMES = [];

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
let capturedPhotos = [];
let currentFrameObj = null;

// ================= สร้างปุ่มกรอบ / สติกเกอร์จาก CONFIG =================
function makeThumb(src, onClick) {
    const img = document.createElement('img');
    img.src = src;
    img.className = 'thumb-btn';
    img.alt = src.split('/').pop();
    img.loading = 'lazy';
    img.addEventListener('click', () => onClick(src));
    return img;
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
    FRAMES.forEach(src => list.appendChild(makeThumb(src, addFrame)));
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
            cat.items.forEach(src => grid.appendChild(makeThumb(src, addSticker)));
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
    const targetRatio = photoWidth / photoHeight;
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

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = photoWidth;
    tempCanvas.height = photoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    // กลับด้านเหมือนกระจก
    tempCtx.translate(tempCanvas.width, 0);
    tempCtx.scale(-1, 1);

    // ครอปตรงกลางให้ได้สัดส่วนเท่าช่องรูป
    const targetRatio = photoWidth / photoHeight;
    const videoRatio = video.videoWidth / video.videoHeight;
    let sWidth, sHeight, sx, sy;
    if (targetRatio > videoRatio) {
        sWidth = video.videoWidth; sHeight = sWidth / targetRatio;
        sx = 0; sy = (video.videoHeight - sHeight) / 2;
    } else {
        sHeight = video.videoHeight; sWidth = sHeight * targetRatio;
        sy = 0; sx = (video.videoWidth - sWidth) / 2;
    }
    tempCtx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, photoWidth, photoHeight);
    capturedPhotos.push(tempCanvas.toDataURL('image/png'));
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

    let loadedImages = 0;
    capturedPhotos.forEach((photoDataUrl, index) => {
        fabric.Image.fromURL(photoDataUrl, function (img) {
            img.set({
                left: photoPositions[index].x, top: photoPositions[index].y,
                selectable: false, evented: false
            });
            canvas.add(img); img.sendToBack();
            loadedImages++;
            if (loadedImages === totalPhotos) canvas.renderAll();
        });
    });
}

// กรอบรูป: อยู่เหนือรูปถ่าย ใต้สติกเกอร์
function addFrame(url) {
    fabric.Image.fromURL(url, function (img, isError) {
        if (isError || !img || !img.width) { alert('หาไฟล์กรอบไม่เจอ: ' + url); return; }
        if (currentFrameObj) canvas.remove(currentFrameObj);
        img.set({
            left: 0, top: 0,
            scaleX: canvas.width / img.width, scaleY: canvas.height / img.height,
            selectable: false, evented: false
        });
        canvas.add(img); img.moveTo(totalPhotos);
        currentFrameObj = img; canvas.renderAll();
    }, { crossOrigin: 'anonymous' });
}

function removeFrame() {
    if (currentFrameObj) { canvas.remove(currentFrameObj); currentFrameObj = null; canvas.renderAll(); }
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
