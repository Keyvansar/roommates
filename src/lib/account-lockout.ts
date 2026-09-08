import { PrismaClient } from '@prisma/client';
import { LRUCache } from 'lru-cache';

const prisma = new PrismaClient();

// Configuration constants
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const FAILED_ATTEMPT_TTL_MS = 30 * 60 * 1000; // 30 minutes

// LRU Cache for failed login attempts (memory-efficient)
const failedAttemptsCache = new LRUCache<string, number[]>({
  max: 10000,
  ttl: FAILED_ATTEMPT_TTL_MS,
});

// LRU Cache for locked accounts (memory-efficient)
const lockedAccountsCache = new LRUCache<string, number>({
  max: 10000,
  ttl: LOCKOUT_DURATION_MS,
});

export interface LockoutStatus {
  isLocked: boolean;
  remainingLockTime?: number;
  failedAttempts: number;
}

/**
 * Record a failed login attempt
 */
export async function recordFailedAttempt(identifier: string): Promise<LockoutStatus> {
  const now = Date.now();
  
  // Get existing attempts from cache
  const existingAttempts = failedAttemptsCache.get(identifier) || [];
  const updatedAttempts = [...existingAttempts, now];
  
  // Store updated attempts in cache
  failedAttemptsCache.set(identifier, updatedAttempts);
  
  // Check if lockout threshold reached
  if (updatedAttempts.length >= MAX_FAILED_ATTEMPTS) {
    // Lock the account
    const lockExpiry = now + LOCKOUT_DURATION_MS;
    lockedAccountsCache.set(identifier, lockExpiry);
    
    // Log to database for audit trail
    await logLockoutEvent(identifier, 'LOCKED', updatedAttempts.length);
    
    return {
      isLocked: true,
      remainingLockTime: LOCKOUT_DURATION_MS,
      failedAttempts: updatedAttempts.length,
    };
  }
  
  return {
    isLocked: false,
    failedAttempts: updatedAttempts.length,
  };
}

/**
 * Check if an account is currently locked
 */
export async function checkLockoutStatus(identifier: string): Promise<LockoutStatus> {
  const now = Date.now();
  
  // Check cache first
  const lockExpiry = lockedAccountsCache.get(identifier);
  if (lockExpiry && lockExpiry > now) {
    return {
      isLocked: true,
      remainingLockTime: lockExpiry - now,
      failedAttempts: failedAttemptsCache.get(identifier)?.length || 0,
    };
  }
  
  // If lock expired, remove it
  if (lockExpiry) {
    lockedAccountsCache.delete(identifier);
    await logLockoutEvent(identifier, 'UNLOCKED', 0);
  }
  
  const failedAttempts = failedAttemptsCache.get(identifier)?.length || 0;
  
  return {
    isLocked: false,
    failedAttempts,
  };
}

/**
 * Reset failed attempts on successful login
 */
export async function resetFailedAttempts(identifier: string): Promise<void> {
  failedAttemptsCache.delete(identifier);
  lockedAccountsCache.delete(identifier);
  
  await logLockoutEvent(identifier, 'RESET', 0);
}

/**
 * Manually unlock an account (for admin use)
 */
export async function manualUnlock(identifier: string): Promise<void> {
  failedAttemptsCache.delete(identifier);
  lockedAccountsCache.delete(identifier);
  
  await logLockoutEvent(identifier, 'MANUAL_UNLOCK', 0);
}

/**
 * Log lockout events to database for audit trail
 */
async function logLockoutEvent(
  identifier: string,
  eventType: 'LOCKED' | 'UNLOCKED' | 'RESET' | 'MANUAL_UNLOCK',
  attemptCount: number
): Promise<void> {
  try {
    await prisma.securityLog.create({
      data: {
        eventType,
        identifier,
        metadata: {
          attemptCount,
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('Failed to log lockout event:', error);
  }
}

/**
 * Get lockout statistics for monitoring
 */
export async function getLockoutStats(): Promise<{
  totalLocked: number;
  totalFailedAttempts: number;
  recentLockouts: Array<{
    identifier: string;
    lockedAt: string;
    remainingTime?: number;
  }>;
}> {
  const now = Date.now();
  const recentLockouts: Array<{ identifier: string; lockedAt: string; remainingTime?: number }> = [];
  
  // Iterate through locked accounts
  for (const [identifier, lockExpiry] of lockedAccountsCache.entries()) {
    if (lockExpiry > now) {
      recentLockouts.push({
        identifier,
        lockedAt: new Date(now).toISOString(),
        remainingTime: lockExpiry - now,
      });
    }
  }
  
  let totalFailedAttempts = 0;
  for (const attempts of failedAttemptsCache.values()) {
    totalFailedAttempts += attempts.length;
  }
  
  return {
    totalLocked: recentLockouts.length,
    totalFailedAttempts,
    recentLockouts,
  };
}
