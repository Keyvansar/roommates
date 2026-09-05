'use client'

import { useEffect, useState } from 'react'
import { Smartphone, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

// `beforeinstallprompt` is not in the default DOM lib types; declare a
// minimal shape that's enough for our usage below.
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  prompt(): Promise<void>
}

const DISMISS_KEY = 'hamkhaneh-install-dismissed-at'
const SUPPRESS_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const m = window.matchMedia('(display-mode: standalone)')
  // iOS Safari exposes `navigator.standalone` instead.
  return m.matches || (window.navigator as unknown as { standalone?: boolean }).standalone === true
}

function readDismissedAt(): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY)
    return raw ? Number(raw) || 0 : 0
  } catch {
    return 0
  }
}

function computeSuppressedUntil(): number {
  const at = readDismissedAt()
  return at > 0 && Date.now() < at + SUPPRESS_MS ? at + SUPPRESS_MS : 0
}

/**
 * PWA install prompt. Listens for `beforeinstallprompt` (Chrome/Edge/Android)
 * and shows a gradient banner with a Smartphone icon and an install button.
 * If the user dismisses the banner we record the timestamp in localStorage
 * and suppress it for 7 days. If the app is already running in standalone
 * mode the banner is never shown.
 *
 * The "should the banner be visible" decision is derived in render (not
 * stored as state) to keep the render pure and avoid setState-in-effect.
 */
export function InstallPrompt() {
  // `useState` lazily reads the suppression state so SSR/hydration stays
  // consistent and the banner only mounts on the client.
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [suppressedUntil, setSuppressedUntil] = useState<number>(computeSuppressedUntil)
  const [installed, setInstalled] = useState<boolean>(false)

  // Detect standalone mode + listen for install / beforeinstallprompt events.
  useEffect(() => {
    // Refresh `installed` after mount — we can't read `window` during SSR.
    setInstalled(isStandalone())

    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      const evt = e as BeforeInstallPromptEvent
      setDeferred(evt)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    const onStandaloneChange = () => setInstalled(isStandalone())

    window.addEventListener('beforeinstallprompt', onBeforeInstall as EventListener)
    window.addEventListener('appinstalled', onInstalled)
    window.matchMedia('(display-mode: standalone)').addEventListener('change', onStandaloneChange)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall as EventListener)
      window.removeEventListener('appinstalled', onInstalled)
      window.matchMedia('(display-mode: standalone)').removeEventListener('change', onStandaloneChange)
    }
  }, [])

  // Derived: whether the banner should be visible.
  const show = !installed && !!deferred && Date.now() >= suppressedUntil

  const handleInstall = async () => {
    if (!deferred) return
    await deferred.prompt()
    const choice = await deferred.userChoice
    if (choice.outcome === 'accepted') setInstalled(true)
    setDeferred(null)
  }

  const handleDismiss = () => {
    const now = Date.now()
    try { window.localStorage.setItem(DISMISS_KEY, String(now)) } catch { /* */ }
    setSuppressedUntil(now + SUPPRESS_MS)
  }

  if (!show) return null

  return (
    <div className="mx-auto w-full max-w-2xl px-3">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-l from-primary/15 via-primary/10 to-transparent p-4 shadow-sm">
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="بستن"
          className="text-muted-foreground hover:bg-background/60 absolute top-2 left-2 rounded-md p-1 transition-colors"
        >
          <X className="size-4" />
        </button>
        <div className="flex items-center gap-3">
          <div className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
            <Smartphone className="size-5" />
          </div>
          <div className="flex-1 space-y-0.5">
            <p className="text-sm font-semibold">نصب اپلیکیشن هم‌خانه‌یاب</p>
            <p className="text-muted-foreground text-xs">
              برای دسترسی سریع‌تر و تجربه تمام‌صفحه، آن را روی صفحه خانه نصب کنید.
            </p>
          </div>
          <Button type="button" size="sm" onClick={handleInstall}>
            نصب
          </Button>
        </div>
      </div>
    </div>
  )
}
