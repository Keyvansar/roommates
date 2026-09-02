// Jalali (Persian solar) date utilities using date-fns-jalali.
import { format, formatDistanceToNow } from 'date-fns-jalali'
import { faIR } from 'date-fns/locale'

const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
]

const jalaliFa = {
  ...faIR,
  localize: {
    ...faIR.localize,
    month: (n: number) => JALALI_MONTHS[n] ?? '',
  },
}

export function toFaDigits(input: string | number): string {
  const map = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
  return String(input).replace(/\d/g, (d) => map[Number(d)])
}

export function formatJalaliDateTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return toFaDigits(format(d, 'd MMMM yyyy - HH:mm', { locale: jalaliFa }))
}

export function formatJalaliDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return toFaDigits(format(d, 'd MMMM yyyy', { locale: jalaliFa }))
}

export function formatJalaliShort(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return toFaDigits(format(d, 'yyyy/MM/dd', { locale: jalaliFa }))
}

export function formatRelativeFa(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return toFaDigits(formatDistanceToNow(d, { addSuffix: true, locale: jalaliFa }))
}

export function formatTimeFa(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return toFaDigits(format(d, 'HH:mm', { locale: jalaliFa }))
}
