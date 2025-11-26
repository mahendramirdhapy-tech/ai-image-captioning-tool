const express = require('express');
const multer = require('multer');
const axios = require('axios');
const { getCaptionFromImage } = require('../services/ai');
const { checkUsageLimit, getUserPlan } = require('../services/plan');
const { logger } = require('../utils/logger');

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

router.post('/caption', upload.single('image'), async (req, res) => {
  try {
    const userIdentifier = req.headers['x-user-id'] || req.ip || 'anonymous';
    const imageFile = req.file;
    const imageBase64 = req.body.imageBase64;

    // Validate input
    if (!imageFile && !imageBase64) {
      return res.status(400).json({
        error: 'Either image file or imageBase64 is required'
      });
    }

    // Check usage limits
    const planCheck = await checkUsageLimit(userIdentifier);
    if (!planCheck.allowed) {
      return res.status(429).json({
        error: 'Daily limit exceeded',
        plan: planCheck.plan,
        remaining: 0,
        resetTime: planCheck.resetTime
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

    // Get caption from AI service
    const caption = await getCaptionFromImage(base64String);
    
    // Return success response
    res.json({
      caption: caption,
      plan: planCheck.plan,
      remaining: planCheck.remaining,
      success: true
    });

    logger.info('Caption generated successfully', {
      userIdentifier,
      plan: planCheck.plan,
      remaining: planCheck.remaining
    });

  } catch (error) {
    logger.error('Error generating caption:', error);
    
    if (error.message.includes('Daily limit exceeded')) {
      return res.status(429).json({
        error: 'Daily limit exceeded',
        plan: 'free',
        remaining: 0
      });
    }

    res.status(500).json({
      error: 'Failed to generate caption',
      message: error.message
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

module.exports = router;
