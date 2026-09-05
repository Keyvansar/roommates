// Next.js Middleware: CSRF protection + Security headers
import { NextRequest, NextResponse } from 'next/server'
import { csrfMiddleware, setCSRFCookie, generateCSRFToken, CSRF_COOKIE_NAME } from '@/lib/csrf'

export async function middleware(request: NextRequest) {
  // 1. CSRF Protection for state-changing requests
  const csrfResponse = await csrfMiddleware(request)
  if (csrfResponse) {
    return csrfResponse
  }

  // 2. Set CSRF token cookie if not present (for GET requests or initial load)
  const response = NextResponse.next()
  const existingToken = request.cookies.get(CSRF_COOKIE_NAME)?.value
  
  if (!existingToken) {
    const newToken = generateCSRFToken()
    const cookieConfig = setCSRFCookie(newToken)
    response.cookies.set(cookieConfig.name, cookieConfig.value, cookieConfig.options)
  }

  // 3. Add security headers to all responses
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  
  // Content Security Policy
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' ws: wss: blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  response.headers.set('Content-Security-Policy', cspDirectives)
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.headers.set('X-DNS-Prefetch-Control', 'on')
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (robots.txt, sitemap.xml, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
