'use client'

import { useEffect, useState } from 'react'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
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
import { useCategories, useCreateItem } from '@/hooks/use-data'
import { useFaDigits } from '@/hooks/use-fa-digits'
import { useTierMeta } from '@/hooks/use-tier-meta'
import type { PointTier } from '@/lib/types'
import { cn } from '@/lib/utils'

const TIERS: PointTier[] = [1, 3, 5]

interface AddItemSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Optional pre-selected category id (e.g. when adding from inside a category). */
  defaultCategoryId?: string
  /** Called after a successful create so the caller can close + reset state. */
  onCreated?: () => void
}

/**
 * Bottom drawer for adding a new item to the household catalog. The user
 * supplies a title, picks a category from the active household's categories
 * and chooses a point tier (3 buttons, each styled with the household's
 * tier label, point value and color). On submit we call `useCreateItem`.
 */
export function AddItemSheet({ open, onOpenChange, defaultCategoryId, onCreated }: AddItemSheetProps) {
  const categoriesQuery = useCategories()
  const create = useCreateItem()
  const tierMeta = useTierMeta()
  const fa = useFaDigits()

  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState<string>(defaultCategoryId ?? '')
  const [tier, setTier] = useState<PointTier>(1)
  const [err, setErr] = useState<string | null>(null)

  // Keep the category select in sync when a default is provided / changes.
  useEffect(() => {
    if (defaultCategoryId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCategoryId(defaultCategoryId)
    }
  }, [defaultCategoryId])

  // If categories load after mount and there's no selection yet, pick the first.
  useEffect(() => {
    if (!categoryId && categoriesQuery.data && categoriesQuery.data.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCategoryId(categoriesQuery.data[0].id)
    }
  }, [categoryId, categoriesQuery.data])

  const reset = () => {
    setTitle('')
    setTier(1)
    setErr(null)
    // Keep the last selected category as the default for the next add.
  }

  const handleSubmit = () => {
    setErr(null)
    if (!title.trim()) { setErr('نام کالا را وارد کنید'); return }
    if (!categoryId) { setErr('دسته را انتخاب کنید'); return }

    create.mutate(
      { title: title.trim(), categoryId, pointTier: tier },
      {
        onSuccess: () => {
          reset()
          onCreated?.()
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88vh]">
        <DrawerHeader className="pb-1">
          <DrawerTitle>افزودن کالای جدید</DrawerTitle>
          <DrawerDescription>یک کالا به کاتالوگ خانه اضافه کنید.</DrawerDescription>
        </DrawerHeader>

        <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-4 pb-2">
          <div className="space-y-1.5">
            <Label htmlFor="add-item-title">نام کالا</Label>
            <Input
              id="add-item-title"
              type="text"
              placeholder="مثلاً شیر پرچرب"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-item-category">دسته</Label>
            <Select value={categoryId} onValueChange={setCategoryId} disabled={categoriesQuery.isLoading}>
              <SelectTrigger id="add-item-category" className="w-full">
                <SelectValue placeholder={categoriesQuery.isLoading ? 'در حال بارگذاری…' : 'یک دسته انتخاب کنید'} />
              </SelectTrigger>
              <SelectContent>
                {categoriesQuery.data?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
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
                      'tap-scale flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 text-center transition-colors',
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

        <DrawerFooter className="flex-row gap-2 pt-2">
          <DrawerClose asChild>
            <Button variant="outline" className="flex-1">انصراف</Button>
          </DrawerClose>
          <Button onClick={handleSubmit} disabled={create.isPending} className="flex-1">
            {create.isPending ? 'در حال ذخیره…' : 'افزودن'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
