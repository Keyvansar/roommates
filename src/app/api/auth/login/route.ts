import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, createSession, setSessionCookie, deleteSession, readSessionToken } from '@/lib/auth'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'
import { loginSchema } from '@/lib/validators' // ✅ Added Zod import here
import { checkLockoutStatus, recordFailedAttempt, resetFailedAttempts } from '@/lib/account-lockout'

export const dynamic = 'force-dynamic'

interface LoginBody {
  email?: string
  password?: string
}

export async function POST(req: NextRequest) {
  // Rate limit: 10 login attempts per IP per 15 minutes
  const ip = getClientIP(req)
  const rl = checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000)
  if (rl.limited) {
    return NextResponse.json(
      { error: 'تلاش‌های زیادی انجام شده. بعداً دوباره تلاش کنید.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    )
  }

  let body: LoginBody
  try {
    body = (await req.json()) as LoginBody
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است' }, { status: 400 })
  }

  // ✅ Zod Validation Block
  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]
    const errorMessage = firstError?.message ?? 'اطلاعات وارد شده معتبر نیست'
    return NextResponse.json({ error: errorMessage }, { status: 400 })
  }

  // Extract variables and format the email to lowercase
  const email = parsed.data.email.toLowerCase()
  const password = parsed.data.password

  // SECURITY FIX: Check account lockout status
  const lockoutStatus = await checkLockoutStatus(email)
  if (lockoutStatus.isLocked) {
    const minutesRemaining = Math.ceil((lockoutStatus.remainingLockTime || 0) / 60000)
    return NextResponse.json(
      { error: `حساب کاربری به دلیل تلاش‌های ناموفق قفل شده است. لطفاً ${minutesRemaining} دقیقه دیگر تلاش کنید.` },
      { status: 423 }
    )
  }

  const user = await db.user.findUnique({ where: { email } })

  // Generic message — never reveal whether the email exists.
  const invalid = NextResponse.json({ error: 'ایمیل یا رمز عبور نادرست است' }, { status: 401 })

  if (!user) {
    // Record failed attempt even for non-existent users (prevents enumeration)
    await recordFailedAttempt(email)
    return invalid
  }
  
  if (!verifyPassword(password, user.passwordHash)) {
    // Record failed attempt
    const lockoutResult = await recordFailedAttempt(email)
    if (lockoutResult.isLocked) {
      return NextResponse.json(
        { error: 'حساب کاربری به دلیل تلاش‌های ناموفق متعدد قفل شد. لطفاً ۱۵ دقیقه دیگر تلاش کنید.' },
        { status: 423 }
      )
    }
    return invalid
  }

  // SECURITY FIX: Reset failed attempts on successful login
  await resetFailedAttempts(email)

  // SECURITY FIX: Clean up old sessions for this user before creating a new one
  // to prevent session accumulation. Keep at most 5 sessions per user.
  const oldSessions = await db.session.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, token: true },
  })
  if (oldSessions.length >= 5) {
    // Delete all but the 4 most recent (we'll add 1 new = 5 total)
    const toDelete = oldSessions.slice(0, oldSessions.length - 4)
    if (toDelete.length > 0) {
      await db.session.deleteMany({ where: { id: { in: toDelete.map((s) => s.id) } } })
    }
  }
  // Also delete expired sessions
  await db.session.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } }).catch(() => { })

  // Delete the old session cookie if one exists (prevents stale sessions)
  const oldToken = await readSessionToken()
  if (oldToken) await deleteSession(oldToken)

  // Find the first membership for an active household
  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    orderBy: { joinedAt: 'asc' },
    include: { household: true },
  })
  const active = memberships.find((m) => m.household !== null)

  const session = await createSession(user.id, active?.householdId)
  await setSessionCookie(session.token)

  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, avatarColor: user.avatarColor },
    householdId: active?.householdId ?? null,
    role: active?.role ?? null,
  })
}