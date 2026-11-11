/**
 * Google Apps Script สำหรับรับรูปจากเว็บ Photobooth แล้วเซฟลง Google Drive
 *
 * วิธีใช้: ก๊อปไฟล์นี้ทั้งหมดไปวางแทนโค้ดเดิมในโปรเจกต์ Apps Script
 * แล้ว Deploy เป็นเวอร์ชันใหม่ (ดูขั้นตอนใน README.md)
 *
 * ชื่อไฟล์: 01_Fietland.png, 02_Fietland.png, ... (เลขต่อจากไฟล์ล่าสุดในโฟลเดอร์)
 * ส่งกลับ: { status: 'success', fileName, fileUrl, fileId, folderUrl }
 *   fileUrl = ลิงก์ไปที่รูปโดยตรง (เว็บเอาไปทำ QR)
 */

// โฟลเดอร์ปลายทาง: https://drive.google.com/drive/folders/1hJY_-Qd3FR6z-TxjiqThJD7Twn51yNHv
const FOLDER_ID = '1hJY_-Qd3FR6z-TxjiqThJD7Twn51yNHv';
const NAME_SUFFIX = '_Fietland';

function doPost(e) {
  // ล็อกไว้กันสองเครื่องกดเซฟพร้อมกันแล้วได้เลขซ้ำ
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const data = JSON.parse(e.postData.contents);
    const base64 = String(data.photoBase64 || '').split(',').pop();
    if (!base64) throw new Error('No photo data');

    const folder = DriveApp.getFolderById(FOLDER_ID);
    const fileName = nextFileName_(folder);
    const blob = Utilities.newBlob(Utilities.base64Decode(base64), 'image/png', fileName);

    const file = folder.createFile(blob);
    // ให้ใครก็ได้ที่มีลิงก์ (คนที่สแกน QR) เปิดดูและดาวน์โหลดได้
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return json_({
      status: 'success',
      fileName: fileName,
      fileId: file.getId(),
      fileUrl: 'https://drive.google.com/file/d/' + file.getId() + '/view',
      folderUrl: folder.getUrl()
    });
  } catch (err) {
    return json_({ status: 'error', message: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// หาเลขที่มากที่สุดของไฟล์ "NN_Fietland..." ในโฟลเดอร์ แล้ว +1 (เลข 2 หลัก: 01, 02, ... 99, 100)
function nextFileName_(folder) {
  const pattern = new RegExp('^(\\d+)' + NAME_SUFFIX);
  let max = 0;
  const files = folder.getFiles();
  while (files.hasNext()) {
    const m = files.next().getName().match(pattern);
    if (m) max = Math.max(max, Number(m[1]));
  }
  const n = max + 1;
  return (n < 10 ? '0' + n : String(n)) + NAME_SUFFIX + '.png';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
