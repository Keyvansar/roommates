import { signupSchema } from '@/lib/validators'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  hashPassword,
  createSession,
  setSessionCookie,
  newInviteCode,
  ensureProfileForUser,
} from '@/lib/auth'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Avatar color palette — cycled deterministically by user count so the
// second roommate in a household doesn't land on the same color as the
// first. Keeps the dashboard avatars visually distinct.
export const AVATAR_COLORS = [
  '#0d9488', // teal-600
  '#d97706', // amber-600
  '#dc2626', // red-600
  '#7c3aed', // violet-600
  '#2563eb', // blue-600
  '#059669', // emerald-600
  '#db2777', // pink-600
  '#65a30d', // lime-600
  '#0891b2', // cyan-600
  '#ea580c', // orange-600
  '#9333ea', // purple-600
  '#ca8a04', // yellow-600
]

export function pickColor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length]
}

const HOUSEHOLD_CAPACITY = 2
const MAX_OWNED_HOUSEHOLDS = 5

interface SignupBody {
  name?: string
  email?: string
  password?: string
  householdName?: string
  inviteCode?: string
}

export async function POST(req: NextRequest) {
  // Rate limit: 5 signups per IP per 15 minutes
  const ip = getClientIP(req)
  const rl = checkRateLimit(`signup:${ip}`, 5, 15 * 60 * 1000)
  if (rl.limited) {
    return NextResponse.json(
      { error: 'تلاش‌های زیادی انجام شده. بعداً دوباره تلاش کنید.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    )
  }

  let body: SignupBody
  try {
    body = (await req.json()) as SignupBody
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است' }, { status: 400 })
  }

  // Validate input using Zod
  const parsed = signupSchema.safeParse(body)
  if (!parsed.success) {
    // Safely get the first error message (using .issues for Zod v4 compatibility)
    const firstError = parsed.error.issues[0]
    const errorMessage = firstError?.message ?? 'اطلاعات وارد شده معتبر نیست'
    return NextResponse.json({ error: errorMessage }, { status: 400 })
  }

  // ✅ FIX: Extract the validated variables here so the rest of the code can use them!
  const { name, password, householdName } = parsed.data
  const email = parsed.data.email.toLowerCase()
  const inviteCode = (parsed.data.inviteCode ?? '').toUpperCase()

  // SECURITY FIX: Don't reveal if email is already registered (user enumeration).
  // Instead of returning 409 with "already registered", silently log in the
  // existing user if the password matches, or return a generic error.
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    // Generic error — don't leak that the email exists
    return NextResponse.json({ error: 'ثبت‌نام ناموفق بود. اطلاعات را بررسی کنید.' }, { status: 400 })
  }

  const userCount = await db.user.count()
  const avatarColor = pickColor(userCount)

  const passwordHash = hashPassword(password)

  if (inviteCode) {
    // Join an existing household via invite code.
    const household = await db.household.findUnique({ where: { inviteCode } })
    if (!household) return NextResponse.json({ error: 'کد دعوت نامعتبر است' }, { status: 404 })

    const memberCount = await db.membership.count({ where: { householdId: household.id } })
    if (memberCount >= HOUSEHOLD_CAPACITY)
      return NextResponse.json({ error: 'ظرفیت خانه تکمیل است' }, { status: 409 })

    const user = await db.user.create({ data: { email, name, passwordHash, avatarColor } })
    await db.membership.create({
      data: { userId: user.id, householdId: household.id, role: 'MEMBER' },
    })
    // Re-pick color based on the household's existing member count so the
    // newcomer lands on a distinct color from existing members.
    const houseColor = pickColor(memberCount)
    if (houseColor !== avatarColor) {
      await db.user.update({ where: { id: user.id }, data: { avatarColor: houseColor } })
      user.avatarColor = houseColor
    }
    await ensureProfileForUser({ userId: user.id, householdId: household.id, name, avatarColor: user.avatarColor })

    // Make sure the household has a settings row.
    await db.householdSetting.upsert({
      where: { householdId: household.id },
      update: {},
      create: { householdId: household.id },
    })

    const session = await createSession(user.id, household.id)
    await setSessionCookie(session.token)

    return NextResponse.json(
      { ok: true, user: { id: user.id, email: user.email, name: user.name, avatarColor: user.avatarColor }, householdId: household.id, role: 'MEMBER' },
      { status: 201 },
    )
  }

  // Create a brand new household as OWNER.
  if (!householdName)
    return NextResponse.json({ error: 'نام خانه را وارد کنید' }, { status: 400 })

  // Create the user first so we can compute the real owned-count below.
  const user = await db.user.create({ data: { email, name, passwordHash, avatarColor } })

  const ownedByUser = await db.household.count({ where: { ownerId: user.id } })
  if (ownedByUser >= MAX_OWNED_HOUSEHOLDS) {
    await db.user.delete({ where: { id: user.id } })
    return NextResponse.json({ error: 'حداکثر تعداد خانه‌ها ساخته شده' }, { status: 409 })
  }

  const household = await db.household.create({
    data: { name: householdName, ownerId: user.id, inviteCode: newInviteCode() },
  })
  await db.membership.create({ data: { userId: user.id, householdId: household.id, role: 'OWNER' } })
  await db.householdSetting.create({ data: { householdId: household.id } })
  await ensureProfileForUser({ userId: user.id, householdId: household.id, name, avatarColor: user.avatarColor })

  const session = await createSession(user.id, household.id)
  await setSessionCookie(session.token)

  return NextResponse.json(
    { ok: true, user: { id: user.id, email: user.email, name: user.name, avatarColor: user.avatarColor }, householdId: household.id, role: 'OWNER' },
    { status: 201 },
  )
}