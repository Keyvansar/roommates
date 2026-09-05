import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { formatJalaliDateTime } from '@/lib/jalali'

export const dynamic = 'force-dynamic'

const RANGES = ['all', '3m', '1m'] as const
type Range = (typeof RANGES)[number]

function rangeStart(range: Range): Date | null {
  if (range === 'all') return null
  const days = range === '1m' ? 30 : 90
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - days)
  return d
}

const STATUS_LABELS: Record<string, string> = {
  approved: 'تأییدشده',
  flagged: 'گزارش‌شده',
  rejected: 'ردشده',
  pending: 'در انتظار',
}

function csvEscape(value: string): string {
  const v = value ?? ''
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}

export async function GET(req: NextRequest) {
  const ctx = await getCurrentUser({ withHousehold: true })
  const url = new URL(req.url)
  const rangeParam = (url.searchParams.get('range') ?? 'all') as Range
  const range: Range = RANGES.includes(rangeParam) ? rangeParam : 'all'

  const householdId = ctx?.household?.id ?? null
  const since = rangeStart(range)

  const where: { householdId: string | null; deletedAt: Date | null; purchasedAt?: { gte: Date } } = {
    householdId,
    deletedAt: null,
  }
  if (since) where.purchasedAt = { gte: since }

  const logs = await db.purchaseLog.findMany({
    where,
    orderBy: { purchasedAt: 'desc' },
    take: 500,
    include: {
      buyer: { select: { name: true, avatarColor: true } },
      item: { select: { category: { select: { title: true } } } },
    },
  })

  const headers = ['تاریخ', 'خریدار', 'کالا', 'دسته', 'تیر امتیاز', 'امتیاز', 'وضعیت']
  const rows = logs.map((l) => [
    formatJalaliDateTime(l.purchasedAt),
    l.buyer?.name ?? '—',
    l.itemTitle,
    l.item?.category?.title ?? '',
    String(l.pointTier),
    String(l.pointsAwarded),
    STATUS_LABELS[l.status] ?? l.status,
  ].map(csvEscape).join(','))

  // UTF-8 BOM so Excel detects the encoding for Persian text.
  const BOM = '\uFEFF'
  const csv = BOM + [headers.map(csvEscape).join(','), ...rows].join('\r\n')

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="purchase-logs.csv"',
      'Cache-Control': 'no-store',
    },
  })
}
