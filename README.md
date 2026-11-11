# webphotobooth

Photobooth แบบเกาหลี (9:16): ถ่าย 3 ช็อต (หรือ 4 ช็อตแบบ 2x2) → ตกแต่งด้วยกรอบ/สติกเกอร์ → เซฟ PNG 1080x1920 หรืออัปโหลดขึ้น Google Drive แล้วรับ QR Code

## ไฟล์
- `index.html` — โครงหน้าเว็บ
- `style.css` — สไตล์
- `script.js` — ลอจิกทั้งหมด (กล้อง, Fabric.js canvas, เซฟ, อัปโหลด)

## เพิ่มกรอบ / สติกเกอร์
แก้ส่วน CONFIG บนสุดของ `script.js`

**กรอบ** เป็น PNG ขนาด 1080x1920 ที่เจาะช่องรูปให้โปร่งใส แล้วบอกพิกัดช่อง (พิกเซลบนไฟล์กรอบ) ใน `slots`
เรียงตามลำดับช็อต จำนวนช่องต้องเท่ากับจำนวนช็อต (กรอบ 4 ช่องจะใช้ได้เฉพาะตอนถ่าย 4 ช็อต)
```js
const FRAMES = [
  { src: 'frames/unlock-multiskills.png',
    slots: [ { x: 92, y: 127, w: 397, h: 643 }, /* ... */ ] },
  { src: 'frames/overlay.png' },   // ไม่มี slots = ทับเฉย ๆ ใช้ได้ทุกจำนวนช็อต
];
```
รูปถ่ายจะถูกขยายให้เต็มช่องแล้วครอปตรงกลางอัตโนมัติ

**สติกเกอร์**
```js
const STICKER_CATEGORIES = [
  { id: 'cat-1', label: '✨ deco', items: ['stickers/deco/heart.png'] },
];
```
ชื่อไฟล์ต้องตรงตัวพิมพ์เล็ก/ใหญ่ (`.png` ≠ `.PNG`) เมื่อขึ้นเซิร์ฟเวอร์จริง

## อัปโหลด + QR
ตั้งค่า URL ของ Google Apps Script ไว้ใน `SCRIPT_URL` (ต้องตอบกลับ `{status:'success', folderUrl}`)
ถ้าเว้นว่าง ปุ่ม Get QR จะแจ้งว่ายังไม่ได้ตั้งค่า

## การรัน
ต้องเปิดผ่าน `https://` หรือ `localhost` (กล้องจะไม่ทำงานบน `file://`) เช่น
```bash
python3 -m http.server 8000
```
