import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const MAX_REASON = 500

interface FlagBody {
  reason?: string
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getCurrentUser({ withHousehold: true })
  if (!ctx) return NextResponse.json({ error: 'احراز هویت لازم است' }, { status: 401 })
  if (!ctx.household) return NextResponse.json({ error: 'خانه فعال یافت نشد' }, { status: 404 })
  if (!ctx.profile) return NextResponse.json({ error: 'پروفایل خانه یافت نشد' }, { status: 400 })

  let body: FlagBody
  try {
    body = (await req.json()) as FlagBody
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است' }, { status: 400 })
  }

  const reason = (body.reason ?? '').trim()
  if (!reason) return NextResponse.json({ error: 'دلیل گزارش را وارد کنید' }, { status: 400 })
  if (reason.length > MAX_REASON)
    return NextResponse.json({ error: `دلیل گزارش نباید بیش از ${MAX_REASON} کاراکتر باشد` }, { status: 400 })

  const log = await db.purchaseLog.findUnique({ where: { id } })
  if (!log) return NextResponse.json({ error: 'رکورد یافت نشد' }, { status: 404 })
  if (log.householdId !== ctx.household.id)
    return NextResponse.json({ error: 'این رکورد متعلق به خانه شما نیست' }, { status: 403 })

  // Can't flag your own purchase.
  if (log.buyerId === ctx.profile.id)
    return NextResponse.json({ error: 'نمی‌توانید خرید خودتان را گزارش دهید' }, { status: 400 })

  // Prevent duplicate open flags by the same reporter on the same log.
  const existing = await db.flag.findFirst({
    where: { purchaseLogId: id, reporterId: ctx.profile.id, status: 'open' },
    select: { id: true },
  })
  if (existing) return NextResponse.json({ error: 'گزارش قبلی شما هنوز باز است' }, { status: 400 })

  const flag = await db.flag.create({
    data: {
      householdId: ctx.household.id,
      purchaseLogId: id,
      reporterId: ctx.profile.id,
      reason,
      status: 'open',
    },
  })

  // Mark the log as flagged so the queue shows it.
  await db.purchaseLog.update({ where: { id }, data: { status: 'flagged' } })

  return NextResponse.json({ ok: true, flag: { id: flag.id } }, { status: 201 })
}
