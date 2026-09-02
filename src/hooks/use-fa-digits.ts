'use client'

import { useCallback } from 'react'
import { useAppearance } from '@/components/appearance-provider'

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']

/**
 * Returns a formatter that converts a number or string of digits into Persian
 * (Farsi) numerals when the user has enabled `faDigits` in their appearance
 * settings, otherwise returns the original Latin digits.
 */
export function useFaDigits(): (input: number | string) => string {
  const { faDigits } = useAppearance()

  return useCallback(
    (input: number | string) => {
      const str = String(input)
      if (!faDigits) return str
      let out = ''
      for (let i = 0; i < str.length; i++) {
        const ch = str[i]
        if (ch >= '0' && ch <= '9') out += FA_DIGITS[Number(ch)]
        else out += ch
      }
      return out
    },
    [faDigits],
  )
}
