const axios = require('axios');
const { logger } = require('../utils/logger');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Free models in priority order
const FREE_MODELS = [
  'meta-llama/llama-3.1-8b-instruct:free',
  'google/gemma-2-9b-it:free', 
  'mistralai/mistral-7b-instruct:free',
  'openrouter/auto'
];

const TIMEOUT = 10000; // 10 seconds

/**
 * Generate caption from image using OpenRouter AI models with fallback
 * @param {string} imageBase64 - Base64 encoded image
 * @returns {Promise<string>} - Generated caption
 */
async function getCaptionFromImage(imageBase64) {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured');
  }

  const prompt = `Please describe this image in detail. Be specific about objects, people, colors, setting, and any text visible. Provide a comprehensive caption that would be useful for someone who cannot see the image.`;

  // Try models in order until one succeeds
  for (const model of FREE_MODELS) {
    try {
      logger.info(`Trying model: ${model}`);
      const caption = await tryModel(model, imageBase64, prompt);
      logger.info(`Success with model: ${model}`);
      return caption;
    } catch (error) {
      logger.warn(`Model ${model} failed:`, error.message);
      // Continue to next model
    }
  }

  // All models failed
  throw new Error('AI service is temporarily unavailable. Try again.');
}

/**
 * Try a specific model for caption generation
 */
async function tryModel(model, imageBase64, prompt) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const response = await axios.post(
      `${OPENROUTER_BASE_URL}/chat/completions`,
      {
        model: model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageBase64
                }
              }
            ]
          }
        ],
        max_tokens: 300
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://ai-caption-tool.vercel.app',
          'X-Title': 'AI Image Captioning Tool'
        },
        signal: controller.signal,
        timeout: TIMEOUT
      }
    );

    clearTimeout(timeoutId);

    if (response.data.choices && response.data.choices[0]) {
      return response.data.choices[0].message.content.trim();
    } else {
      throw new Error('Invalid response from AI model');
    }
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error(`Model ${model} timeout after ${TIMEOUT}ms`);
    }
    
    if (error.response) {
      throw new Error(`Model ${model} API error: ${error.response.status} - ${error.response.data?.error?.message || 'Unknown error'}`);
    }
    
    throw new Error(`Model ${model} failed: ${error.message}`);
  }
}

module.exports = {
  getCaptionFromImage
};
