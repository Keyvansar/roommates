'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useProfiles, useUpdateLog } from '@/hooks/use-data'
import { useFaDigits } from '@/hooks/use-fa-digits'
import { useTierMeta } from '@/hooks/use-tier-meta'
import type { PointTier, PurchaseLogDTO } from '@/lib/types'
import { cn } from '@/lib/utils'

const TIERS: PointTier[] = [1, 3, 5]

interface LogEditDialogProps {
  /** The log being edited. When null the dialog renders nothing. */
  log: PurchaseLogDTO | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Dialog for editing a purchase log. Lets the caller fix the item title,
 * reassign the buyer (picked from the household's profiles) and adjust the
 * point tier. On submit it calls `useUpdateLog`; the dialog closes itself
 * and the parent list refreshes thanks to the mutation's invalidations.
 */
export function LogEditDialog({ log, open, onOpenChange }: LogEditDialogProps) {
  const profilesQuery = useProfiles()
  const update = useUpdateLog()
  const tierMeta = useTierMeta()
  const fa = useFaDigits()

  const [title, setTitle] = useState('')
  const [buyerId, setBuyerId] = useState<string>('')
  const [tier, setTier] = useState<PointTier>(1)
  const [err, setErr] = useState<string | null>(null)

  // Sync local form state with the incoming log whenever the dialog opens or
  // the target log changes.
  useEffect(() => {
    if (!open || !log) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTitle(log.itemTitle)
    setBuyerId(log.buyerId)
    setTier(log.pointTier)
    setErr(null)
  }, [open, log])

  const handleSubmit = () => {
    if (!log) return
    setErr(null)
    if (!title.trim()) { setErr('نام کالا را وارد کنید'); return }
    if (!buyerId) { setErr('خریدار را انتخاب کنید'); return }

    update.mutate(
      { id: log.id, itemTitle: title.trim(), buyerId, pointTier: tier },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ویرایش خرید</DialogTitle>
          <DialogDescription>نام کالا، خریدار و تیر امتیاز را اصلاح کنید.</DialogDescription>
        </DialogHeader>

        {!log ? null : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="log-title">نام کالا</Label>
              <Input
                id="log-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="log-buyer">خریدار</Label>
              <Select value={buyerId} onValueChange={setBuyerId} disabled={profilesQuery.isLoading}>
                <SelectTrigger id="log-buyer" className="w-full">
                  <SelectValue placeholder={profilesQuery.isLoading ? 'در حال بارگذاری…' : 'یک خریدار'} />
                </SelectTrigger>
                <SelectContent>
                  {profilesQuery.data?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span
                        aria-hidden
                        className="inline-block size-2 rounded-full"
                        style={{ backgroundColor: p.avatarColor }}
                      />
                      <span>{p.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>تیر امتیاز</Label>
              <div className="grid grid-cols-3 gap-2">
                {TIERS.map((t) => {
                  const meta = tierMeta[t]
                  const isActive = tier === t
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTier(t)}
                      aria-pressed={isActive}
                      className={cn(
                        'tap-scale flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-2.5 text-center transition-colors',
                        isActive ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-accent/40',
                      )}
                      style={isActive ? { borderColor: meta.color } : undefined}
                    >
                      <span
                        aria-hidden
                        className="inline-block size-2.5 rounded-full"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span className="text-sm font-medium">{meta.label}</span>
                      <span className="text-muted-foreground text-xs tabular-nums">{fa(meta.points)} امتیاز</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {err && <p className="text-destructive text-xs">{err}</p>}
          </div>
        )}

        <DialogFooter className="flex-row gap-2 sm:justify-stretch">
          <DialogClose asChild>
            <Button variant="outline" className="flex-1">انصراف</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={update.isPending} className="flex-1">
            {update.isPending ? 'در حال ذخیره…' : 'ذخیره'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
