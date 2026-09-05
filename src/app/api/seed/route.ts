import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { seedDatabase, seedCatalogForHousehold } from '@/lib/catalog'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

interface SeedBody {
  confirm?: boolean
}

export async function POST(req: NextRequest) {
  // Rate limit: 3 resets per IP per hour (prevents DoS via repeated resets)
  const ip = getClientIP(req)
  const rl = checkRateLimit(`seed:${ip}`, 3, 60 * 60 * 1000)
  if (rl.limited) {
    return NextResponse.json(
      { error: 'بازنشانی بیش از حد انجام شده. یک ساعت بعد تلاش کنید.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    )
  }

  let body: SeedBody = {}
  try {
    body = (await req.json().catch(() => ({}))) as SeedBody
  } catch {
    body = {}
  }

  if (!body.confirm)
    return NextResponse.json({ error: 'تأیید بازنشانی لازم است' }, { status: 400 })

  const ctx = await getCurrentUser({ withHousehold: true })

  // SECURITY FIX: Require authentication for ALL seed resets (including demo/global).
  // Unauthenticated users can no longer wipe the global demo catalog.
  if (!ctx) {
    return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 })
  }

  if (!ctx.household) {
    // Authenticated but no household — nothing to reset.
    return NextResponse.json({ error: 'خانه‌ای برای بازنشانی وجود ندارد' }, { status: 400 })
  }

  // Logged in — reset only the active household's catalog. Preserves the
  // household's social graph (users, profiles, memberships) intact.
  await seedCatalogForHousehold(db, ctx.household.id)
  return NextResponse.json({ ok: true, scope: 'household', householdId: ctx.household.id })
}
