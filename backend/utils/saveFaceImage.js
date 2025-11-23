const fs = require('fs');
const path = require('path');

exports.saveFaceImage = (base64String, beneficiaryId) => {
  try {
    // Remove base64 prefix
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');

    // Create filename
    const fileName = `${beneficiaryId}_${Date.now()}.jpg`;

    // Path to save file
    const filePath = path.join(__dirname, '..', 'uploads', 'faces', fileName);

    // Write to file
    fs.writeFileSync(filePath, base64Data, 'base64');

    // Return URL path (front-end will use this)
    return `/uploads/faces/${fileName}`;
  } catch (err) {
    console.error("Failed to save face image:", err);
    return null;
  }
};
