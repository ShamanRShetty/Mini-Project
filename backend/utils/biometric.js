/**
 * Biometric Utilities - FIXED WITH DEBUGGING
 * 
 * Uses face-api.js for actual face detection and recognition
 */

const faceapi = require('face-api.js');
const canvas = require('canvas');
const fs = require('fs');
const path = require('path');

// Patch nodejs environment for face-api.js
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

// Model paths
const MODEL_PATH = path.join(__dirname, '..', 'models', 'face-api-models');

// Load models once on startup
let modelsLoaded = false;
let modelLoadError = null;

/**
 * Load face recognition models
 */
async function loadModels() {
  if (modelsLoaded) {
    console.log('[BIOMETRIC] Models already loaded');
    return true;
  }
  
  console.log('[BIOMETRIC] Loading face recognition models from:', MODEL_PATH);
  
  try {
    // Check if model directory exists
    if (!fs.existsSync(MODEL_PATH)) {
      throw new Error(`Model directory not found: ${MODEL_PATH}`);
    }
    
    // List files in model directory for debugging
    const files = fs.readdirSync(MODEL_PATH);
    console.log('[BIOMETRIC] Files in model directory:', files);
    
    // Check for required model files
    const requiredFiles = [
      'tiny_face_detector_model-weights_manifest.json',
      'face_landmark_68_model-weights_manifest.json',
      'face_recognition_model-weights_manifest.json'
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.join(MODEL_PATH, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Required model file not found: ${file}`);
      }
    }
    
    // Load models
    console.log('[BIOMETRIC] Loading TinyFaceDetector...');
    await faceapi.nets.tinyFaceDetector.loadFromDisk(MODEL_PATH);
    
    console.log('[BIOMETRIC] Loading FaceLandmark68Net...');
    await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH);
    
    console.log('[BIOMETRIC] Loading FaceRecognitionNet...');
    await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH);
    
    modelsLoaded = true;
    modelLoadError = null;
    console.log('[BIOMETRIC] ✅ All models loaded successfully');
    return true;
    
  } catch (error) {
    modelsLoaded = false;
    modelLoadError = error;
    console.error('[BIOMETRIC] ❌ Failed to load models:', error.message);
    console.error('[BIOMETRIC] Full error:', error);
    return false;
  }
}

/**
 * Convert base64 image to Image object
 */
async function base64ToImage(base64Data) {
  try {
    console.log('[BIOMETRIC] Converting base64 to image...');
    
    // Remove base64 prefix if present
    let base64 = base64Data;
    if (base64.includes('base64,')) {
      base64 = base64.split('base64,')[1];
    }
    
    const buffer = Buffer.from(base64, 'base64');
    console.log('[BIOMETRIC] Image buffer size:', buffer.length, 'bytes');
    
    // Create image from buffer
    const img = await canvas.loadImage(buffer);
    console.log('[BIOMETRIC] Image loaded:', img.width, 'x', img.height);
    
    return img;
  } catch (error) {
    console.error('[BIOMETRIC] base64ToImage error:', error.message);
    throw error;
  }
}

/**
 * Load image from file path
 */
async function loadImageFromPath(imagePath) {
  try {
    // Handle both absolute and relative paths
    let fullPath = imagePath;
    
    if (!path.isAbsolute(imagePath)) {
      fullPath = path.join(__dirname, '..', imagePath);
    }
    
    console.log('[BIOMETRIC] Loading image from:', fullPath);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Image file not found: ${fullPath}`);
    }
    
    const img = await canvas.loadImage(fullPath);
    console.log('[BIOMETRIC] Image loaded:', img.width, 'x', img.height);
    
    return img;
  } catch (error) {
    console.error('[BIOMETRIC] loadImageFromPath error:', error.message);
    throw error;
  }
}

/**
 * Detect face and extract embedding (descriptor)
 * Returns 128-dimensional face embedding array
 */
async function extractFaceEmbedding(imageData) {
  console.log('[BIOMETRIC] ===== EXTRACTING FACE EMBEDDING =====');
  
  // Check if models are loaded
  if (!modelsLoaded) {
    console.log('[BIOMETRIC] Models not loaded, loading now...');
    const loaded = await loadModels();
    if (!loaded) {
      throw new Error(`Models failed to load: ${modelLoadError?.message || 'Unknown error'}`);
    }
  }
  
  try {
    let img;
    
    console.log('[BIOMETRIC] Image data type:', typeof imageData);
    
    // Handle different input types
    if (typeof imageData === 'string') {
      if (imageData.startsWith('data:') || imageData.startsWith('/9j/') || imageData.startsWith('iVBOR')) {
        // Base64 image
        console.log('[BIOMETRIC] Processing base64 image');
        img = await base64ToImage(imageData);
      } else {
        // File path
        console.log('[BIOMETRIC] Processing file path');
        img = await loadImageFromPath(imageData);
      }
    } else {
      throw new Error('Invalid image data format - must be base64 string or file path');
    }
    
    if (!img) {
      throw new Error('Failed to load image');
    }
    
    console.log('[BIOMETRIC] Detecting face with TinyFaceDetector...');
    
    // Detect face with landmarks and descriptor
    const detection = await faceapi
      .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({
        inputSize: 160,
        scoreThreshold: 0.5
      }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    
    if (!detection) {
      console.error('[BIOMETRIC] ❌ No face detected in image');
      throw new Error('No face detected in image. Please ensure the face is clearly visible and well-lit.');
    }
    
    console.log('[BIOMETRIC] ✅ Face detected! Box:', detection.detection.box);
    console.log('[BIOMETRIC] Face detection score:', detection.detection.score);
    console.log('[BIOMETRIC] Descriptor length:', detection.descriptor.length);
    
    // Convert Float32Array to regular array
    const embedding = Array.from(detection.descriptor);
    
    console.log('[BIOMETRIC] ✅ Embedding extracted successfully');
    console.log('[BIOMETRIC] First 5 values:', embedding.slice(0, 5));
    
    return embedding;
    
  } catch (error) {
    console.error('[BIOMETRIC] ❌ Face extraction error:', error.message);
    console.error('[BIOMETRIC] Error stack:', error.stack);
    throw error;
  }
}

/**
 * Compare two face embeddings using Euclidean distance
 */
function compareEmbeddings(embedding1, embedding2, threshold = 0.6) {
  console.log('[BIOMETRIC] Comparing embeddings...');
  
  if (!embedding1 || !embedding2) {
    throw new Error('Both embeddings are required');
  }
  
  if (embedding1.length !== 128 || embedding2.length !== 128) {
    throw new Error(`Invalid embedding dimensions: ${embedding1.length} and ${embedding2.length} (expected 128)`);
  }
  
  // Calculate Euclidean distance
  let sumSquares = 0;
  for (let i = 0; i < 128; i++) {
    const diff = embedding1[i] - embedding2[i];
    sumSquares += diff * diff;
  }
  const distance = Math.sqrt(sumSquares);
  
  // Convert distance to confidence (0-1 scale)
  const confidence = Math.max(0, 1 - (distance / 1.5));
  
  // Match if distance is below threshold
  const match = distance < threshold;
  
  console.log('[BIOMETRIC] Distance:', distance);
  console.log('[BIOMETRIC] Confidence:', confidence);
  console.log('[BIOMETRIC] Match:', match);
  
  return {
    match,
    confidence: parseFloat(confidence.toFixed(3)),
    distance: parseFloat(distance.toFixed(3))
  };
}

/**
 * Compare two face images
 */
exports.compareFaces = async (storedImagePath, capturedImageData) => {
  console.log('[BIOMETRIC] ===== COMPARING FACES =====');
  
  try {
    if (!storedImagePath) {
      console.log('[BIOMETRIC] No stored image path');
      return {
        match: false,
        confidence: 0,
        error: 'No stored biometric data'
      };
    }
    
    if (!capturedImageData) {
      console.log('[BIOMETRIC] No captured image data');
      return {
        match: false,
        confidence: 0,
        error: 'No captured image provided'
      };
    }
    
    console.log('[BIOMETRIC] Stored image:', storedImagePath);
    console.log('[BIOMETRIC] Captured image length:', capturedImageData.length);
    
    // Extract embeddings from both images
    console.log('[BIOMETRIC] Extracting stored embedding...');
    const storedEmbedding = await extractFaceEmbedding(storedImagePath);
    
    console.log('[BIOMETRIC] Extracting captured embedding...');
    const capturedEmbedding = await extractFaceEmbedding(capturedImageData);
    
    // Compare embeddings
    const result = compareEmbeddings(storedEmbedding, capturedEmbedding);
    
    console.log('[BIOMETRIC] ✅ Comparison complete');
    
    return {
      match: result.match,
      confidence: result.confidence,
      distance: result.distance,
      method: 'face-api.js',
      threshold: 0.6
    };
    
  } catch (error) {
    console.error('[BIOMETRIC] ❌ Comparison error:', error.message);
    return {
      match: false,
      confidence: 0,
      error: error.message
    };
  }
};

/**
 * Detect face in image
 */
exports.detectFace = async (imageData) => {
  try {
    const embedding = await extractFaceEmbedding(imageData);
    
    return {
      success: true,
      faceDetected: true,
      embedding: embedding,
      confidence: 0.95
    };
    
  } catch (error) {
    console.error('[BIOMETRIC] Detection error:', error.message);
    return {
      success: false,
      faceDetected: false,
      error: error.message
    };
  }
};

/**
 * Generate face embedding from image
 * THIS IS THE KEY FUNCTION FOR STORING IN DB
 */
exports.generateFaceEmbedding = async (imageData) => {
  console.log('[BIOMETRIC] ===== GENERATE FACE EMBEDDING =====');
  
  try {
    if (!imageData) {
      console.error('[BIOMETRIC] No image data provided');
      return null;
    }
    
    const embedding = await extractFaceEmbedding(imageData);
    
    if (!embedding || embedding.length !== 128) {
      console.error('[BIOMETRIC] Invalid embedding generated');
      return null;
    }
    
    console.log('[BIOMETRIC] ✅ Generated embedding with', embedding.length, 'dimensions');
    return embedding;
    
  } catch (error) {
    console.error('[BIOMETRIC] ❌ Generate embedding error:', error.message);
    console.error('[BIOMETRIC] Full error:', error);
    return null;
  }
};

/**
 * Compare embeddings (direct comparison)
 */
exports.compareEmbeddings = compareEmbeddings;

/**
 * Load models (can be called manually)
 */
exports.loadModels = loadModels;

/**
 * Check if models are loaded
 */
exports.areModelsLoaded = () => {
  return modelsLoaded;
};

/**
 * Get model load error (if any)
 */
exports.getModelLoadError = () => {
  return modelLoadError;
};

// Try to load models on module initialization
loadModels().catch(err => {
  console.error('[BIOMETRIC] Failed to load models on initialization:', err.message);
});

module.exports = exports;