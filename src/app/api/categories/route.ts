import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await getCurrentUser({ withHousehold: true })

  // Anonymous / demo mode: return the global demo categories (householdId
  // null) that ship with the seed.
  if (!ctx || !ctx.household) {
    const cats = await db.category.findMany({
      where: { householdId: null },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      select: { id: true, title: true, icon: true, sortOrder: true },
    })
    return NextResponse.json({
      categories: cats.map((c) => ({ id: c.id, title: c.title, icon: c.icon, sortOrder: c.sortOrder })),
    })
  }

  const cats = await db.category.findMany({
    where: { householdId: ctx.household.id },
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    select: { id: true, title: true, icon: true, sortOrder: true },
  })

  return NextResponse.json({
    categories: cats.map((c) => ({ id: c.id, title: c.title, icon: c.icon, sortOrder: c.sortOrder })),
  })
}

interface CreateBody {
  title?: string
  icon?: string
  sortOrder?: number
}

export async function POST(req: NextRequest) {
  const ctx = await getCurrentUser({ withHousehold: true })
  if (!ctx) return NextResponse.json({ error: 'برای ساخت دسته باید وارد شوید' }, { status: 401 })

  let body: CreateBody
  try {
    body = (await req.json()) as CreateBody
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است' }, { status: 400 })
  }

  const title = (body.title ?? '').trim()
  if (!title) return NextResponse.json({ error: 'نام دسته را وارد کنید' }, { status: 400 })
  const icon = (body.icon ?? 'Package').trim() || 'Package'

  // Auto-attach to the active household. If there is no active household
  // (shouldn't happen post-auth, but be defensive), fall back to demo
  // (householdId null) so the catalog at least persists.
  const householdId = ctx.household?.id ?? null

  // Auto sortOrder — append after the current max in this scope.
  const maxRow = await db.category.findFirst({
    where: { householdId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })
  const sortOrder = body.sortOrder ?? (maxRow ? maxRow.sortOrder + 1 : 1)

  const cat = await db.category.create({
    data: { householdId, title, icon, sortOrder },
  })

  return NextResponse.json(
    { category: { id: cat.id, title: cat.title, icon: cat.icon, sortOrder: cat.sortOrder } },
    { status: 201 },
  )
}
