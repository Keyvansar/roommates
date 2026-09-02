import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, createSession, setSessionCookie } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface LoginBody {
  email?: string
  password?: string
}

export async function POST(req: NextRequest) {
  let body: LoginBody
  try {
    body = (await req.json()) as LoginBody
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است' }, { status: 400 })
  }

  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''

  if (!email || !password)
    return NextResponse.json({ error: 'ایمیل و رمز عبور را وارد کنید' }, { status: 400 })

  const user = await db.user.findUnique({ where: { email } })

  // Generic message — never reveal whether the email exists.
  const invalid = NextResponse.json({ error: 'ایمیل یا رمز عبور نادرست است' }, { status: 401 })

  if (!user) return invalid
  if (!verifyPassword(password, user.passwordHash)) return invalid

  // Find the first membership for an active household (household must
  // still exist; in practice onDelete: Cascade guarantees this).
  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    orderBy: { joinedAt: 'asc' },
    include: { household: true },
  })
  const active = memberships.find((m) => m.household !== null)
  if (!active) {
    // User exists but has no households. Still log them in — they can
    // create / join a household from the dashboard.
    const session = await createSession(user.id, undefined)
    await setSessionCookie(session.token)
    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, avatarColor: user.avatarColor },
      householdId: null,
      role: null,
    })
  }

  const session = await createSession(user.id, active.householdId)
  await setSessionCookie(session.token)

  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, avatarColor: user.avatarColor },
    householdId: active.householdId,
    role: active.role,
  })
}
