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
 */
async function getCaptionFromImage(imageBase64) {
  if (!OPENROUTER_API_KEY) {
    logger.error('OpenRouter API key not configured');
    throw new Error('OpenRouter API key not configured. Please check environment variables.');
  }

  const prompt = `Please describe this image in detail. Be specific about objects, people, colors, setting, and any text visible. Provide a comprehensive caption that would be useful for someone who cannot see the image. Keep the description concise but informative.`;

  let lastError = '';

  // Try models in order until one succeeds
  for (const model of FREE_MODELS) {
    try {
      logger.info(`Trying model: ${model}`);
      const caption = await tryModel(model, imageBase64, prompt);
      logger.info(`Success with model: ${model}`);
      return caption;
    } catch (error) {
      lastError = error.message;
      logger.warn(`Model ${model} failed: ${error.message}`);
      // Continue to next model
    }
  }

  // All models failed
  logger.error('All AI models failed:', lastError);
  throw new Error('AI service is temporarily unavailable. Try again.');
}

/**
 * Try a specific model for caption generation
 */
async function tryModel(model, imageBase64, prompt) {
  return new Promise(async (resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Model timeout after ${TIMEOUT}ms`));
    }, TIMEOUT);

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
          max_tokens: 300,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://ai-caption-tool.vercel.app',
            'X-Title': 'AI Image Captioning Tool'
          },
          timeout: TIMEOUT
        }
      );

      clearTimeout(timeoutId);

      if (response.data && 
          response.data.choices && 
          response.data.choices[0] && 
          response.data.choices[0].message && 
          response.data.choices[0].message.content) {
        
        const caption = response.data.choices[0].message.content.trim();
        if (caption && caption.length > 0) {
          resolve(caption);
        } else {
          reject(new Error('Empty response from AI model'));
        }
      } else {
        reject(new Error('Invalid response format from AI model'));
      }
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.code === 'ECONNABORTED') {
        reject(new Error(`Model timeout after ${TIMEOUT}ms`));
      } else if (error.response) {
        const status = error.response.status;
        const errorMsg = error.response.data?.error?.message || error.response.statusText;
        reject(new Error(`API error (${status}): ${errorMsg}`));
      } else if (error.request) {
        reject(new Error('No response received from AI service'));
      } else {
        reject(new Error(`Request failed: ${error.message}`));
      }
    }
  });
}

module.exports = {
  getCaptionFromImage
};
