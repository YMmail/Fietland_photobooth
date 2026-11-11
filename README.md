# webphotobooth

Photobooth แบบเกาหลี (9:16) ทำงานเป็น 4 ขั้น:

1. **Frame** – เลือกกรอบ (กลุ่ม 3 cuts / 4 cuts)
2. **Photo** – กล้องเปลี่ยนสัดส่วนตามช่องของกรอบที่เลือก นับถอยหลังถ่ายจนครบทุกช่อง
3. **Decorate** – ติดสติกเกอร์ ปุ่ม Retake อยู่ซ้าย
4. **Save** – เซฟ PNG 1080x1920 ลงเครื่อง + อัปโหลดขึ้น Google Drive แล้วแสดง QR

## ไฟล์
- `index.html` — โครงหน้าเว็บ (แต่ละขั้นเป็น `<section>`)
- `style.css` — สไตล์
- `script.js` — ลอจิกทั้งหมด (กล้อง, Fabric.js canvas, เซฟ, อัปโหลด)
- `frames/` — ไฟล์กรอบที่เจาะช่องโปร่งใสแล้ว
- `ui/bg.png` — พื้นหลังเว็บ

## เพิ่มกรอบ / สติกเกอร์
แก้ส่วน CONFIG บนสุดของ `script.js`

**กรอบสีพื้น** สร้างด้วย `plainFrame(ชื่อ, สี, จำนวนช็อต)` (3 ช็อต = ช่อง 4:3, 4 ช็อต = ช่อง 3:2)

**กรอบจากไฟล์รูป** เป็น PNG 1080x1920 ที่เจาะช่องรูปให้โปร่งใส แล้วบอกพิกัดช่อง (พิกเซลบนไฟล์กรอบ) ใน `slots`
เรียงตามลำดับช็อต สัดส่วนของช่องจะเป็นสัดส่วนกล้องตอนถ่าย
```js
{ name: 'Unlock Multiskills', cuts: 4, color: '#0d0b2e',
  src: 'frames/unlock-multiskills.png',
  slots: [ { x: 92, y: 127, w: 397, h: 643 }, /* ... */ ] },
```

**สติกเกอร์**
```js
const STICKER_CATEGORIES = [
  { id: 'cat-1', label: '✨ deco', items: ['stickers/deco/heart.png'] },
];
```
ชื่อไฟล์ต้องตรงตัวพิมพ์เล็ก/ใหญ่ (`.png` ≠ `.PNG`) เมื่อขึ้นเซิร์ฟเวอร์จริง

## อัปโหลด + QR
กด Save Image แล้วเว็บจะส่งรูปไปที่ Google Apps Script (`SCRIPT_URL` ใน `script.js`)
สคริปต์เซฟรูปลงโฟลเดอร์ Drive ที่ตั้งไว้ใน `FOLDER_ID` (ชื่อไฟล์ `01_Fietland.png`, `02_Fietland.png`, ...) แล้วส่งลิงก์ของรูปกลับมา เว็บเอาลิงก์นั้นไปทำ QR

โค้ดฝั่ง Apps Script อยู่ที่ `apps-script/Code.gs` วิธีอัปเดต:
1. เปิดโปรเจกต์ Apps Script เดิม (script.google.com) แล้ววางโค้ดจาก `Code.gs` แทนของเดิม กด Save
2. **Deploy → Manage deployments** → กดดินสอ (Edit) ที่ deployment เดิม
3. ช่อง Version เลือก **New version**, Execute as: **Me**, Who has access: **Anyone** → **Deploy**
4. ถ้าระบบขอสิทธิ์ ให้กด Authorize

แก้ deployment เดิมแบบนี้ URL จะไม่เปลี่ยน ไม่ต้องแก้ `SCRIPT_URL`
(ถ้ากด New deployment จะได้ URL ใหม่ ต้องเอาไปใส่ใน `SCRIPT_URL` ด้วย)

## การรัน
ต้องเปิดผ่าน `https://` หรือ `localhost` (กล้องจะไม่ทำงานบน `file://`) เช่น
```bash
python3 -m http.server 8000
```
