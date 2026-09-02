import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { seedDatabase, seedCatalogForHousehold } from '@/lib/catalog'

export const dynamic = 'force-dynamic'

interface SeedBody {
  confirm?: boolean
}

export async function POST(req: NextRequest) {
  let body: SeedBody = {}
  try {
    body = (await req.json().catch(() => ({}))) as SeedBody
  } catch {
    body = {}
  }

  if (!body.confirm)
    return NextResponse.json({ error: 'تأیید بازنشانی لازم است' }, { status: 400 })

  const ctx = await getCurrentUser({ withHousehold: true })

  if (!ctx || !ctx.household) {
    // Anonymous / demo mode — reset the global catalog (householdId null).
    await seedDatabase(db)
    return NextResponse.json({ ok: true, scope: 'demo' })
  }

  // Logged in — reset only the active household's catalog. Preserves the
  // household's social graph (users, profiles, memberships) intact.
  await seedCatalogForHousehold(db, ctx.household.id)
  return NextResponse.json({ ok: true, scope: 'household', householdId: ctx.household.id })
}
