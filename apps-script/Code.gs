/**
 * Google Apps Script สำหรับรับรูปจากเว็บ Photobooth แล้วเซฟลง Google Drive
 *
 * วิธีใช้: ก๊อปไฟล์นี้ทั้งหมดไปวางแทนโค้ดเดิมในโปรเจกต์ Apps Script
 * แล้ว Deploy เป็นเวอร์ชันใหม่ (ดูขั้นตอนใน README.md)
 *
 * ส่งกลับ: { status: 'success', fileUrl, fileId, folderUrl }
 *   fileUrl = ลิงก์ไปที่รูปโดยตรง (เว็บเอาไปทำ QR)
 */

// ชื่อโฟลเดอร์ใน My Drive ที่จะเก็บรูป (ไม่มีจะสร้างให้เอง)
const FOLDER_NAME = 'Photobooth';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const base64 = String(data.photoBase64 || '').split(',').pop();
    if (!base64) throw new Error('No photo data');

    const fileName = data.fileName || ('Booth_' + new Date().getTime() + '.png');
    const blob = Utilities.newBlob(Utilities.base64Decode(base64), 'image/png', fileName);

    const folder = getFolder_();
    const file = folder.createFile(blob);
    // ให้ใครก็ได้ที่มีลิงก์ (คนที่สแกน QR) เปิดดูและดาวน์โหลดได้
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return json_({
      status: 'success',
      fileId: file.getId(),
      fileUrl: 'https://drive.google.com/file/d/' + file.getId() + '/view',
      folderUrl: folder.getUrl()
    });
  } catch (err) {
    return json_({ status: 'error', message: String(err) });
  }
}

function getFolder_() {
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
