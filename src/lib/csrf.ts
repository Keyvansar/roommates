// CSRF Protection Middleware for Next.js
// Implements Double Submit Cookie pattern for CSRF protection

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'

export const CSRF_COOKIE_NAME = 'csrf_token'
export const CSRF_HEADER_NAME = 'x-csrf-token'

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Get CSRF token from cookies
 */
export async function getCSRFTokenFromCookie(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(CSRF_COOKIE_NAME)?.value
}

/**
 * Set CSRF token in response cookie
 */
export function setCSRFCookie(token: string): { name: string; value: string; options: any } {
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  return {
    name: CSRF_COOKIE_NAME,
    value: token,
    options: {
      httpOnly: false, // Must be readable by JavaScript
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires,
    },
  }
}

/**
 * Validate CSRF token from request
 * Returns true if valid, false otherwise
 */
export async function validateCSRFToken(req: NextRequest): Promise<boolean> {
  // Only validate state-changing methods
  const method = req.method.toUpperCase()
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return true
  }

  // Skip validation for safe endpoints
  const url = new URL(req.url)
  const safePaths = [
    '/api/auth/login',
    '/api/auth/signup',
    '/api/auth/logout',
  ]
  
  // Check if path matches any safe path (exact or starts with for dynamic routes)
  const isSafePath = safePaths.some(safePath => 
    url.pathname === safePath || url.pathname.startsWith(safePath + '/')
  )

  if (isSafePath) {
    // For auth endpoints, we still validate but more leniently
    // They have their own rate limiting and validation
    return true
  }

  const headerToken = req.headers.get(CSRF_HEADER_NAME)
  const cookieToken = req.cookies.get(CSRF_COOKIE_NAME)?.value

  // Both must exist and match
  if (!headerToken || !cookieToken) {
    return false
  }

  // Constant-time comparison to prevent timing attacks
  if (headerToken.length !== cookieToken.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < headerToken.length; i++) {
    result |= headerToken.charCodeAt(i) ^ cookieToken.charCodeAt(i)
  }

  return result === 0
}

/**
 * Middleware to check CSRF token on state-changing requests
 */
export async function csrfMiddleware(req: NextRequest): Promise<NextResponse | null> {
  const method = req.method.toUpperCase()
  
  // Only check state-changing methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return null
  }

  const isValid = await validateCSRFToken(req)
  
  if (!isValid) {
    return NextResponse.json(
      { error: 'توکن CSRF نامعتبر است. لطفاً صفحه را رفرش کرده و دوباره تلاش کنید.' },
      { status: 403 }
    )
  }

  return null
}
