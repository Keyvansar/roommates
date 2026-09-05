'use client'

import { QueryProvider } from '@/components/query-provider'
import { AppShell } from '@/components/app-shell'

export default function Home() {
  return (
    <QueryProvider>
      <AppShell />
    </QueryProvider>
  )
}
