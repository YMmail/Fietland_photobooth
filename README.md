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
ตั้งค่า URL ของ Google Apps Script ไว้ใน `SCRIPT_URL` (ต้องตอบกลับ `{status:'success', folderUrl}`)
ถ้าเว้นว่าง ปุ่ม Get QR จะแจ้งว่ายังไม่ได้ตั้งค่า

## การรัน
ต้องเปิดผ่าน `https://` หรือ `localhost` (กล้องจะไม่ทำงานบน `file://`) เช่น
```bash
python3 -m http.server 8000
```
