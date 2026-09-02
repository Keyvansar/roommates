'use client'

/**
 * Full-screen centered splash shown while the app is bootstrapping (Zustand
 * hydration, `useMe` initial fetch). Uses a cart emoji + a Persian loading
 * string so users see something friendly while the network round-trips.
 */
export function LoadingSplash() {
  return (
    <div className="app-shell items-center justify-center gap-3 text-center">
      <div className="text-5xl" role="img" aria-label="سبد خرید">
        🛒
      </div>
      <p className="text-muted-foreground text-sm">در حال بارگذاری هم‌خانه‌یاب…</p>
    </div>
  )
}
