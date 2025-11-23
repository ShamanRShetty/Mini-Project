const fs = require('fs');
const path = require('path');

/**
 * Save face image to disk and return file path
 */
exports.saveFaceImage = (base64String, beneficiaryId) => {
  try {
    // Remove base64 prefix
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');

    // Create uploads/faces directory if it doesn't exist
    const uploadDir = path.join(__dirname, '..', 'uploads', 'faces');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Create filename
    const fileName = `${beneficiaryId}_${Date.now()}.jpg`;
    const filePath = path.join(uploadDir, fileName);

    // Write file
    fs.writeFileSync(filePath, base64Data, 'base64');

    console.log('[SAVE_FACE] Saved face image:', fileName);

    // Return relative path (for database storage)
    return `/uploads/faces/${fileName}`;
  } catch (err) {
    console.error('[SAVE_FACE] Failed to save face image:', err);
    return null;
  }
};

module.exports = exports;