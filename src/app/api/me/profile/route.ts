import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, verifyPassword, hashPassword } from '@/lib/auth'
import { AVATAR_COLORS } from '@/app/api/auth/signup/route'

export const dynamic = 'force-dynamic'

interface ProfilePatchBody {
  name?: string
  avatarColor?: string
  avatarEmoji?: string | null
  currentPassword?: string
  newPassword?: string
}

export async function PATCH(req: NextRequest) {
  const ctx = await getCurrentUser({ withHousehold: true })
  if (!ctx) return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 })

  let body: ProfilePatchBody
  try {
    body = (await req.json()) as ProfilePatchBody
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است' }, { status: 400 })
  }

  const updates: {
    name?: string
    avatarColor?: string
    avatarEmoji?: string | null
    passwordHash?: string
  } = {}

  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name) return NextResponse.json({ error: 'نام نمی‌تواند خالی باشد' }, { status: 400 })
    updates.name = name
  }

  if (body.avatarColor !== undefined) {
    if (!AVATAR_COLORS.includes(body.avatarColor))
      return NextResponse.json({ error: 'رنگ آواتار معتبر نیست' }, { status: 400 })
    updates.avatarColor = body.avatarColor
  }

  if (body.avatarEmoji !== undefined) {
    if (body.avatarEmoji === null) {
      updates.avatarEmoji = null
    } else {
      const emoji = body.avatarEmoji.trim()
      // Allow up to 4 grapheme units (here we just check char length).
      if (emoji.length === 0) {
        updates.avatarEmoji = null
      } else if (emoji.length > 4) {
        return NextResponse.json({ error: 'آواتار حداکثر ۴ کاراکتر باشد' }, { status: 400 })
      } else {
        updates.avatarEmoji = emoji
      }
    }
  }

  // Password change requires the current password to be re-verified.
  if (body.newPassword !== undefined) {
    if (!body.currentPassword)
      return NextResponse.json({ error: 'رمز فعلی را وارد کنید' }, { status: 400 })
    if (!verifyPassword(body.currentPassword, ctx.user.passwordHash))
      return NextResponse.json({ error: 'رمز فعلی نادرست است' }, { status: 401 })
    if (body.newPassword.length < 6)
      return NextResponse.json({ error: 'رمز جدید باید حداقل ۶ کاراکتر باشد' }, { status: 400 })
    updates.passwordHash = hashPassword(body.newPassword)
  }

  await db.user.update({ where: { id: ctx.user.id }, data: updates })

  // If the user's name / color / emoji changed, mirror the change into the
  // active household's Profile (if any) so the dashboard stays consistent.
  if (ctx.household && (updates.name || updates.avatarColor || updates.avatarEmoji !== undefined)) {
    const profileUpdate: { name?: string; avatarColor?: string; avatarEmoji?: string | null } = {}
    if (updates.name) profileUpdate.name = updates.name
    if (updates.avatarColor) profileUpdate.avatarColor = updates.avatarColor
    if (updates.avatarEmoji !== undefined) profileUpdate.avatarEmoji = updates.avatarEmoji

    const profile = await db.profile.findFirst({
      where: { householdId: ctx.household.id, userId: ctx.user.id },
    })
    if (profile) {
      await db.profile.update({ where: { id: profile.id }, data: profileUpdate })
    }
  }

  return NextResponse.json({ ok: true })
}
