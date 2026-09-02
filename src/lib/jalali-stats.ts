// Jalali month helper for stats aggregation.
import { format } from 'date-fns-jalali'

const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
]

export function formatJalaliMonth(d: Date): string {
  const iso = format(d, 'yyyy-MM', {})
  const [y, m] = iso.split('-').map(Number)
  const monthName = JALALI_MONTHS[(m - 1) % 12] ?? ''
  return `${monthName} ${toFa(y)}`
}

function toFa(n: number | string): string {
  return String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
}
