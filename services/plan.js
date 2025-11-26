const { logger } = require('../utils/logger');

// In-memory storage for usage tracking
const usageStore = new Map();

const DAILY_FREE_LIMIT = 5;
const RESET_TIME_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check if user can make another request based on their plan
 */
function checkUsageLimit(userIdentifier) {
  try {
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
    let userPlan = usageStore.get(planKey) || { type: 'free' };

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

    logger.info(`Usage check for ${userIdentifier}`, {
      plan: planType,
      allowed,
      remaining,
      totalUsed: userUsage.count
    });

    return {
      allowed,
      plan: planType,
      remaining,
      resetTime: resetTime.toISOString(),
      totalUsed: userUsage.count
    };
  } catch (error) {
    logger.error('Error in checkUsageLimit:', error);
    // In case of error, allow the request
    return {
      allowed: true,
      plan: 'free',
      remaining: DAILY_FREE_LIMIT,
      resetTime: new Date(Date.now() + RESET_TIME_MS).toISOString(),
      totalUsed: 0
    };
  }
}

/**
 * Get user plan information
 */
function getUserPlan(userIdentifier) {
  const planKey = `plan:${userIdentifier}`;
  return usageStore.get(planKey) || { type: 'free' };
}

/**
 * Upgrade user to paid plan
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
