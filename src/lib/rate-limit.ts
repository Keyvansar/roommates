// Simple in-memory rate limiter for Next.js API routes.
// Uses a sliding window approach: tracks request timestamps per identifier.
// Not distributed (won't work across multiple server instances) but sufficient
// for the single-process sandbox environment.

import { LRUCache } from 'lru-cache'

interface RateLimitEntry {
  timestamps: number[]
}

// Use LRU cache with max entries to prevent memory leaks
// Max 10,000 unique identifiers, TTL of 1 hour for cleanup
const store = new LRUCache<string, RateLimitEntry>({
  max: 10000,
  ttl: 60 * 60 * 1000, // 1 hour
  updateAgeOnGet: false,
})

/**
 * Check if a request should be rate-limited.
 * @param identifier - unique key (e.g., IP address or email)
 * @param maxRequests - maximum requests allowed in the window
 * @param windowMs - time window in milliseconds
 * @returns { limited: boolean, remaining: number, resetAt: number }
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number
): { limited: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = store.get(identifier) ?? { timestamps: [] }

  // Remove expired timestamps
  const valid = entry.timestamps.filter((ts) => now - ts < windowMs)

  if (valid.length >= maxRequests) {
    const oldest = valid[0]
    const resetAt = oldest + windowMs
    store.set(identifier, { timestamps: valid })
    return { limited: true, remaining: 0, resetAt }
  }

  valid.push(now)
  store.set(identifier, { timestamps: valid })
  return { limited: false, remaining: maxRequests - valid.length, resetAt: now + windowMs }
}

/** Get client IP from request headers (respecting common proxy headers) */
export function getClientIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const realIP = req.headers.get('x-real-ip')
  if (realIP) return realIP
  return 'unknown'
}

// LRU cache handles automatic cleanup via TTL, no need for manual interval
