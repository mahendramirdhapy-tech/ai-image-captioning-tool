const { logger } = require('../utils/logger');

// In-memory storage for usage tracking (for demo purposes)
// In production, use Redis or database
const usageStore = new Map();

const DAILY_FREE_LIMIT = 5;
const RESET_TIME_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check if user can make another request based on their plan
 */
function checkUsageLimit(userIdentifier) {
  const now = Date.now();
  const userKey = `usage:${userIdentifier}`;
  const planKey = `plan:${userIdentifier}`;
  
  // Get or initialize user usage data
  let userUsage = usageStore.get(userKey) || {
    count: 0,
    firstRequest: now,
    lastReset: now
  };

  // Get user plan (default to free)
  let userPlan = usageStore.get(planKey) || {
    type: 'free',
    // For paid users, you would store subscription info here
  };

  // Check if we need to reset daily count
  if (now - userUsage.lastReset > RESET_TIME_MS) {
    userUsage.count = 0;
    userUsage.lastReset = now;
    userUsage.firstRequest = now;
    logger.info(`Reset usage for user: ${userIdentifier}`);
  }

  const planType = userPlan.type;
  const allowed = planType === 'paid' || userUsage.count < DAILY_FREE_LIMIT;
  const remaining = planType === 'paid' ? 'unlimited' : Math.max(0, DAILY_FREE_LIMIT - userUsage.count);

  if (allowed && planType === 'free') {
    userUsage.count++;
    usageStore.set(userKey, userUsage);
  }

  const resetTime = new Date(userUsage.lastReset + RESET_TIME_MS);

  return {
    allowed,
    plan: planType,
    remaining,
    resetTime: resetTime.toISOString(),
    totalUsed: userUsage.count
  };
}

/**
 * Get user plan information
 */
function getUserPlan(userIdentifier) {
  const planKey = `plan:${userIdentifier}`;
  return usageStore.get(planKey) || { type: 'free' };
}

/**
 * Upgrade user to paid plan (simplified - in production, integrate with payment system)
 */
function upgradeToPaid(userIdentifier) {
  const planKey = `plan:${userIdentifier}`;
  usageStore.set(planKey, { type: 'paid' });
  logger.info(`User upgraded to paid: ${userIdentifier}`);
  return { success: true, plan: 'paid' };
}

module.exports = {
  checkUsageLimit,
  getUserPlan,
  upgradeToPaid,
  DAILY_FREE_LIMIT
};
