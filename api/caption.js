const express = require('express');
const multer = require('multer');
const { getCaptionFromImage } = require('../services/ai');
const { checkUsageLimit } = require('../services/plan');
const { logger } = require('../utils/logger');

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// CORS middleware
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-User-Id');
  next();
});

router.post('/caption', upload.single('image'), async (req, res) => {
  try {
    // Generate user identifier
    const userIdentifier = req.headers['x-user-id'] || 
                          req.ip || 
                          `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.info('Caption request received', { userIdentifier });

    const imageFile = req.file;
    const imageBase64 = req.body.imageBase64;

    // Validate input
    if (!imageFile && !imageBase64) {
      return res.status(400).json({
        error: 'Either image file or imageBase64 is required',
        success: false
      });
    }

    // Check usage limits
    const planCheck = await checkUsageLimit(userIdentifier);
    if (!planCheck.allowed) {
      return res.status(429).json({
        error: 'Daily limit exceeded. Upgrade to paid plan for unlimited access.',
        plan: planCheck.plan,
        remaining: 0,
        success: false
      });
    }

    let base64String;
    
    if (imageFile) {
      // Convert uploaded file to base64
      base64String = imageFile.buffer.toString('base64');
      const mimeType = imageFile.mimetype;
      base64String = `data:${mimeType};base64,${base64String}`;
    } else {
      // Use provided base64 string
      base64String = imageBase64;
      if (!base64String.startsWith('data:image/')) {
        base64String = `data:image/jpeg;base64,${base64String}`;
      }
    }

    logger.info('Getting caption from AI service...');

    // Get caption from AI service
    const caption = await getCaptionFromImage(base64String);
    
    logger.info('Caption generated successfully');

    // Return success response
    res.json({
      caption: caption,
      plan: planCheck.plan,
      remaining: planCheck.remaining,
      success: true
    });

  } catch (error) {
    logger.error('Error generating caption:', error);
    
    if (error.message.includes('Daily limit exceeded')) {
      return res.status(429).json({
        error: 'Daily limit exceeded',
        plan: 'free',
        remaining: 0,
        success: false
      });
    }

    if (error.message.includes('AI service is temporarily unavailable')) {
      return res.status(503).json({
        error: 'AI service is temporarily unavailable. Please try again in a few moments.',
        success: false
      });
    }

    res.status(500).json({
      error: 'Failed to generate caption: ' + error.message,
      success: false
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'AI Image Captioning'
  });
});

// Handle OPTIONS for CORS
router.options('/caption', (req, res) => {
  res.status(200).end();
});

module.exports = router;
