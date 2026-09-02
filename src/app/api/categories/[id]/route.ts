import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface PatchBody {
  title?: string
  icon?: string
  sortOrder?: number
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getCurrentUser({ withHousehold: true })
  if (!ctx) return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 })

  let body: PatchBody
  try {
    body = (await req.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است' }, { status: 400 })
  }

  const category = await db.category.findUnique({ where: { id } })
  if (!category) return NextResponse.json({ error: 'دسته یافت نشد' }, { status: 404 })

  // Authorization: the category must belong to the user's active household
  // (or be a demo null-household category, in which case any authed user
  // can edit it).
  if (category.householdId !== null && (!ctx.household || category.householdId !== ctx.household.id))
    return NextResponse.json({ error: 'این دسته متعلق به خانه شما نیست' }, { status: 403 })

  // Auto-attach demo categories (householdId null) to the active household
  // when an authed user edits them. This keeps the shared catalog from
  // leaking edits across households.
  let attachHouseholdId: string | null = category.householdId
  if (category.householdId === null && ctx.household) {
    attachHouseholdId = ctx.household.id
  }

  const updates: { title?: string; icon?: string; sortOrder?: number; householdId?: string | null } = {}
  if (body.title !== undefined) {
    const t = body.title.trim()
    if (!t) return NextResponse.json({ error: 'نام دسته نمی‌تواند خالی باشد' }, { status: 400 })
    updates.title = t
  }
  if (body.icon !== undefined) {
    updates.icon = body.icon.trim() || 'Package'
  }
  if (body.sortOrder !== undefined) {
    if (typeof body.sortOrder !== 'number')
      return NextResponse.json({ error: 'sortOrder باید عدد باشد' }, { status: 400 })
    updates.sortOrder = body.sortOrder
  }
  if (attachHouseholdId !== category.householdId) {
    updates.householdId = attachHouseholdId
  }

  const cat = await db.category.update({ where: { id }, data: updates })
  return NextResponse.json({
    category: { id: cat.id, title: cat.title, icon: cat.icon, sortOrder: cat.sortOrder },
  })
}

interface DeleteBody {
  moveTo?: string
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getCurrentUser({ withHousehold: true })
  if (!ctx) return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 })

  let body: DeleteBody = {}
  try {
    body = (await req.json().catch(() => ({}))) as DeleteBody
  } catch {
    body = {}
  }

  const category = await db.category.findUnique({ where: { id } })
  if (!category) return NextResponse.json({ error: 'دسته یافت نشد' }, { status: 404 })

  if (category.householdId !== null && (!ctx.household || category.householdId !== ctx.household.id))
    return NextResponse.json({ error: 'این دسته متعلق به خانه شما نیست' }, { status: 403 })

  // Find the user's catalog scope (active household or demo null).
  const scopeHouseholdId = ctx.household?.id ?? null

  // Refuse to delete the last category in scope — the dashboard expects
  // at least one category to host items.
  const siblingCount = await db.category.count({ where: { householdId: scopeHouseholdId } })
  if (siblingCount <= 1)
    return NextResponse.json({ error: 'حداقل باید یک دسته وجود داشته باشد' }, { status: 400 })

  // Determine the destination category — explicit body.moveTo, otherwise
  // the first remaining category in scope (excluding the one we're deleting).
  let moveToId = body.moveTo?.trim()
  if (!moveToId) {
    const fallback = await db.category.findFirst({
      where: { householdId: scopeHouseholdId, id: { not: id } },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      select: { id: true },
    })
    if (!fallback)
      return NextResponse.json({ error: 'دسته مقصد یافت نشد' }, { status: 400 })
    moveToId = fallback.id
  } else {
    const dest = await db.category.findUnique({ where: { id: moveToId } })
    if (!dest || (dest.householdId !== scopeHouseholdId))
      return NextResponse.json({ error: 'دسته مقصد نامعتبر است' }, { status: 400 })
  }

  // Re-parent items + cascade their purchase logs implicitly (logs
  // reference itemId, which is preserved).
  await db.item.updateMany({
    where: { categoryId: id },
    data: { categoryId: moveToId },
  })

  await db.category.delete({ where: { id } })

  return NextResponse.json({ ok: true, movedItemsTo: moveToId })
}
