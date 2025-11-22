/**
 * Biometric Utilities
 * 
 * Placeholder implementation for biometric (face) verification.
 * In production, you would integrate with:
 * - AWS Rekognition
 * - Azure Face API
 * - Google Cloud Vision
 * - Open source: face-api.js, OpenCV
 * 
 * Current implementation:
 * - Simple placeholder that simulates face matching
 * - Compares image data strings for exact match
 * - Returns mock confidence score
 * 
 * To implement real biometric:
 * 1. Install face recognition library
 * 2. Replace compareFaces with actual comparison
 * 3. Store face embeddings (feature vectors) in database
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Compare two face images
 * 
 * PLACEHOLDER IMPLEMENTATION
 * In production, replace with actual face recognition
 * 
 * @param {string} storedImagePath - Path to stored face image
 * @param {string} capturedImageData - Base64 encoded captured image
 * @returns {object} { match: boolean, confidence: number }
 */
exports.compareFaces = async (storedImagePath, capturedImageData) => {
  try {
    // If no stored image, cannot verify
    if (!storedImagePath) {
      return {
        match: false,
        confidence: 0,
        error: 'No stored biometric data'
      };
    }

    // If no captured image, cannot verify
    if (!capturedImageData) {
      return {
        match: false,
        confidence: 0,
        error: 'No captured image provided'
      };
    }

    // ========================================
    // PLACEHOLDER IMPLEMENTATION
    // ========================================
    
    // In real implementation, you would:
    // 1. Load stored image and extract face embedding
    // 2. Extract face embedding from captured image
    // 3. Compare embeddings using cosine similarity or Euclidean distance
    // 4. Return match if similarity above threshold

    // For demo purposes, generate a pseudo-random confidence
    // based on hash of the captured image data
    // This makes the result deterministic for same input
    const hash = crypto
      .createHash('md5')
      .update(capturedImageData.substring(0, 100))
      .digest('hex');
    
    // Convert first 2 hex chars to number 0-255, then to 0-1
    const pseudoConfidence = parseInt(hash.substring(0, 2), 16) / 255;
    
    // Bias toward higher confidence for demo (add 0.3, cap at 1.0)
    const confidence = Math.min(1.0, pseudoConfidence + 0.3);
    
    // Match if confidence >= 0.7
    const match = confidence >= 0.7;

    console.log(`[BIOMETRIC] Placeholder comparison - confidence: ${confidence.toFixed(2)}, match: ${match}`);

    return {
      match,
      confidence: parseFloat(confidence.toFixed(2)),
      method: 'placeholder',
      note: 'This is a placeholder implementation for development'
    };

  } catch (error) {
    console.error('Biometric comparison error:', error);
    return {
      match: false,
      confidence: 0,
      error: error.message
    };
  }
};

/**
 * Extract face from image (placeholder)
 * 
 * @param {string} imageData - Base64 encoded image
 * @returns {object} { success: boolean, faceDetected: boolean }
 */
exports.detectFace = async (imageData) => {
  try {
    // Placeholder: Check if image data looks valid
    if (!imageData || imageData.length < 100) {
      return {
        success: false,
        faceDetected: false,
        error: 'Invalid image data'
      };
    }

    // In real implementation:
    // 1. Decode base64 image
    // 2. Use face detection library to find faces
    // 3. Return face bounding box and landmarks

    // Placeholder: Assume face is always detected for valid images
    return {
      success: true,
      faceDetected: true,
      confidence: 0.95,
      faceCount: 1,
      note: 'Placeholder implementation'
    };

  } catch (error) {
    console.error('Face detection error:', error);
    return {
      success: false,
      faceDetected: false,
      error: error.message
    };
  }
};

/**
 * Generate face embedding (feature vector) placeholder
 * 
 * @param {string} imageData - Base64 encoded image
 * @returns {number[]} Array of 128 numbers (face embedding)
 */
exports.generateFaceEmbedding = async (imageData) => {
  try {
    // In real implementation:
    // 1. Decode image
    // 2. Detect face
    // 3. Extract face embedding using neural network

    // Placeholder: Generate deterministic pseudo-random embedding
    // based on image data hash
    const hash = crypto
      .createHash('sha256')
      .update(imageData.substring(0, 500))
      .digest('hex');
    
    // Convert hash to 128 numbers
    const embedding = [];
    for (let i = 0; i < 128; i++) {
      const hexPair = hash.substring((i * 2) % 64, ((i * 2) % 64) + 2);
      embedding.push(parseInt(hexPair, 16) / 255);
    }

    return embedding;

  } catch (error) {
    console.error('Generate embedding error:', error);
    return null;
  }
};

/**
 * Compare two face embeddings using cosine similarity
 * 
 * @param {number[]} embedding1 - First embedding
 * @param {number[]} embedding2 - Second embedding
 * @returns {number} Similarity score 0-1
 */
exports.compareEmbeddings = (embedding1, embedding2) => {
  if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
    return 0;
  }

  // Cosine similarity
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  
  return Math.max(0, Math.min(1, similarity)); // Clamp to 0-1
};

/**
 * Save face image to disk
 * 
 * @param {string} imageData - Base64 encoded image
 * @param {string} beneficiaryId - Beneficiary ID for filename
 * @returns {string} Path to saved file
 */
exports.saveFaceImage = async (imageData, beneficiaryId) => {
  try {
    // Remove base64 prefix if present
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    
    // Create buffer from base64
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Generate filename
    const timestamp = Date.now();
    const filename = `face_${beneficiaryId}_${timestamp}.jpg`;
    const uploadPath = path.join(__dirname, '..', 'uploads', filename);
    
    // Ensure uploads directory exists
    const uploadsDir = path.dirname(uploadPath);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Write file
    fs.writeFileSync(uploadPath, buffer);
    
    console.log(`[BIOMETRIC] Saved face image: ${filename}`);
    
    return filename;

  } catch (error) {
    console.error('Save face image error:', error);
    throw error;
  }
};

/**
 * Load face image from disk
 * 
 * @param {string} filename - Filename of stored image
 * @returns {string} Base64 encoded image data
 */
exports.loadFaceImage = async (filename) => {
  try {
    const filepath = path.join(__dirname, '..', 'uploads', filename);
    
    if (!fs.existsSync(filepath)) {
      throw new Error('Face image not found');
    }
    
    const buffer = fs.readFileSync(filepath);
    return buffer.toString('base64');

  } catch (error) {
    console.error('Load face image error:', error);
    throw error;
  }
};

// Export all functions
module.exports = exports;