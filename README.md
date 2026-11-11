# webphotobooth

Photobooth แบบเกาหลี (9:16): ถ่าย 3 ช็อต (หรือ 4 ช็อตแบบ 2x2) → ตกแต่งด้วยกรอบ/สติกเกอร์ → เซฟ PNG 1080x1920 หรืออัปโหลดขึ้น Google Drive แล้วรับ QR Code

## ไฟล์
- `index.html` — โครงหน้าเว็บ
- `style.css` — สไตล์
- `script.js` — ลอจิกทั้งหมด (กล้อง, Fabric.js canvas, เซฟ, อัปโหลด)

## เพิ่มกรอบ / สติกเกอร์
แก้ส่วน CONFIG บนสุดของ `script.js`:
```js
const FRAMES = ['frames/frame1.png'];
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
