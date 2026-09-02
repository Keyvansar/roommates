// Catalog seed data + seed helpers for the Shared Household Shopping PWA.
//
// This module is the single source of truth for the "default" household
// shopping catalog (6 categories, 74 Persian items) and exposes two
// seed helpers:
//   - seedDatabase(db)                  — full global reset (dev/demo).
//   - seedCatalogForHousehold(db, hid)  — per-household catalog reset that
//                                          preserves users, profiles and
//                                          memberships.
//
// All writes go through Prisma; the seed functions are idempotent (they
// wipe their target scope before inserting).

// `PrismaClient` is imported as a value (the class) which also serves as a
// type for the function signatures below. We additionally pull in the
// `ItemStatus` / `PointTier` types from the shared domain types module.
import { PrismaClient } from '@prisma/client'
import type { ItemStatus, PointTier } from '@/lib/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SeedProfile = {
  name: string
  avatarColor: string
  pin: string
}

export type CatalogItemSeed = {
  title: string
  tier: PointTier
  status?: 'depleted'
}

export type CatalogCategorySeed = {
  title: string
  icon: string
  sortOrder: number
  items: CatalogItemSeed[]
}

// ---------------------------------------------------------------------------
// Seed data — profiles
// ---------------------------------------------------------------------------

export const SEED_PROFILES: SeedProfile[] = [
  { name: 'سینا', avatarColor: '#0d9488', pin: '1234' },
  { name: 'مائده', avatarColor: '#d97706', pin: '5678' },
]

// ---------------------------------------------------------------------------
// Seed data — catalog (6 categories, 74 items)
// ---------------------------------------------------------------------------

export const CATALOG: CatalogCategorySeed[] = [
  {
    title: 'شوینده و بهداشتی',
    icon: 'Sparkles',
    sortOrder: 1,
    items: [
      { title: 'مایع ظرفشویی', tier: 1 },
      { title: 'قرص ماشین ظرفشویی', tier: 3 },
      { title: 'پودر لباسشویی', tier: 5, status: 'depleted' },
      { title: 'نرم‌کننده لباس', tier: 3 },
      { title: 'شوینده سطوح', tier: 1, status: 'depleted' },
      { title: 'وایتکس', tier: 3 },
      { title: 'اسپری شیشه‌پاک', tier: 1 },
      { title: 'دستمال کاغذی', tier: 3, status: 'depleted' },
      { title: 'دستمال توالت', tier: 5 },
      { title: 'پد بهداشتی', tier: 3 },
      { title: 'مسواک', tier: 1 },
      { title: 'خمیردندان', tier: 1, status: 'depleted' },
      { title: 'شامپو', tier: 3 },
      { title: 'نرم‌کننده مو', tier: 3 },
      { title: 'صابون', tier: 1 },
      { title: 'ژل بهداشتی دست', tier: 1 },
    ],
  },
  {
    title: 'خواربار و یخچال',
    icon: 'Refrigerator',
    sortOrder: 2,
    items: [
      { title: 'شیر', tier: 1 },
      { title: 'ماست', tier: 1, status: 'depleted' },
      { title: 'پنیر', tier: 3 },
      { title: 'خامه', tier: 1 },
      { title: 'کره', tier: 1 },
      { title: 'تخم‌مرغ', tier: 3 },
      { title: 'نان', tier: 1, status: 'depleted' },
      { title: 'روغن مایع', tier: 3 },
      { title: 'روغن جامد', tier: 5 },
      { title: 'برنج', tier: 5 },
      { title: 'ماکارونی', tier: 3 },
      { title: 'رشته', tier: 1 },
      { title: 'قند', tier: 3 },
      { title: 'شکر', tier: 3 },
      { title: 'چای', tier: 3, status: 'depleted' },
      { title: 'قهوه', tier: 3 },
      { title: 'نمک', tier: 1 },
      { title: 'رب گوجه', tier: 3 },
      { title: 'دوغ', tier: 1, status: 'depleted' },
    ],
  },
  {
    title: 'پروتئینی',
    icon: 'Beef',
    sortOrder: 3,
    items: [
      { title: 'گوشت چرخ‌کرده', tier: 5, status: 'depleted' },
      { title: 'گوشت گوسفندی', tier: 5 },
      { title: 'مغز مرغ', tier: 5 },
      { title: 'سینه مرغ', tier: 5 },
      { title: 'سوسیس و کالباس', tier: 3 },
      { title: 'تن ماهی', tier: 3 },
      { title: 'لوبیا چیتی', tier: 3 },
      { title: 'عدس', tier: 3 },
      { title: 'نخود', tier: 3 },
    ],
  },
  {
    title: 'میوه و سبزی',
    icon: 'Apple',
    sortOrder: 4,
    items: [
      { title: 'سیب', tier: 1 },
      { title: 'موز', tier: 1, status: 'depleted' },
      { title: 'پرتقال', tier: 1 },
      { title: 'لیمو', tier: 1 },
      { title: 'خیار', tier: 1 },
      { title: 'گوجه', tier: 1 },
      { title: 'پیاز', tier: 1 },
      { title: 'سیب‌زمینی', tier: 3 },
      { title: 'هویج', tier: 1 },
      { title: 'کاهو', tier: 1, status: 'depleted' },
      { title: 'سبزی خوردن', tier: 1 },
      { title: 'گوجه سبز', tier: 1 },
    ],
  },
  {
    title: 'تنقلات و نوشیدنی',
    icon: 'Cookie',
    sortOrder: 5,
    items: [
      { title: 'بیسکویت', tier: 1 },
      { title: 'شکلات', tier: 1 },
      { title: 'چیپس', tier: 1, status: 'depleted' },
      { title: 'پفک', tier: 1 },
      { title: 'آجیل', tier: 3 },
      { title: 'خرما', tier: 1 },
      { title: 'آب معدنی', tier: 1 },
      { title: 'نوشابه', tier: 3 },
      { title: 'تخمه', tier: 1 },
      { title: 'شکلات صبحانه', tier: 3 },
    ],
  },
  {
    title: 'ملزومات عمومی',
    icon: 'Package',
    sortOrder: 6,
    items: [
      { title: 'فویل آلومینیومی', tier: 3 },
      { title: 'نایلون فریزر', tier: 3 },
      { title: 'کیسه زباله', tier: 3, status: 'depleted' },
      { title: 'فیلتر آب', tier: 3 },
      { title: 'باتری', tier: 3 },
      { title: 'لامپ', tier: 3 },
      { title: 'شمع', tier: 1 },
      { title: 'کبریت', tier: 1 },
    ],
  },
]

const TOTAL_ITEMS = CATALOG.reduce((sum, cat) => sum + cat.items.length, 0)

// ---------------------------------------------------------------------------
// Historical demo purchases
// ---------------------------------------------------------------------------
// The four logs below are created both by seedDatabase() and by
// seedCatalogForHousehold() (the latter only when the household already has
// ≥ 2 profiles). They give the turn-balancing dashboard some history to show.

type HistoricalPurchase = {
  itemTitle: string
  pointTier: PointTier
  pointsAwarded: number
  profileIndex: 0 | 1
  daysAgo: number
}

const HISTORICAL_PURCHASES: HistoricalPurchase[] = [
  { itemTitle: 'برنج', pointTier: 5, pointsAwarded: 5, profileIndex: 0, daysAgo: 6 },
  { itemTitle: 'شیر', pointTier: 1, pointsAwarded: 1, profileIndex: 1, daysAgo: 4 },
  { itemTitle: 'روغن مایع', pointTier: 3, pointsAwarded: 3, profileIndex: 1, daysAgo: 3 },
  { itemTitle: 'تخم‌مرغ', pointTier: 3, pointsAwarded: 3, profileIndex: 0, daysAgo: 1 },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysAgoDate(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

function itemStatusFor(seed: CatalogItemSeed): ItemStatus {
  return seed.status === 'depleted' ? 'depleted' : 'in_stock'
}

// ---------------------------------------------------------------------------
// seedDatabase — global reset
// ---------------------------------------------------------------------------

/**
 * Wipe all profiles / categories / items / purchase logs and reseed from
 * SEED_PROFILES + CATALOG. Intended for dev / demo bootstrapping where no
 * household exists yet — everything is created with a null `householdId`.
 *
 * Also creates the 4 historical demo purchase logs (rice / milk / oil / eggs)
 * and stamps `lastBoughtAt` + `lastBoughtById` on the matching items.
 *
 * @returns counts of inserted profiles, categories and items.
 */
export async function seedDatabase(db: PrismaClient): Promise<{
  profiles: number
  categories: number
  items: number
}> {
  // 1) Wipe in dependency-safe order (PurchaseLog → Item → Category → Profile).
  await db.purchaseLog.deleteMany({})
  await db.item.deleteMany({})
  await db.category.deleteMany({})
  await db.profile.deleteMany({})

  // 2) Create demo profiles (no household binding for the global seed).
  const profiles: { id: string }[] = []
  for (const p of SEED_PROFILES) {
    const created = await db.profile.create({
      data: {
        name: p.name,
        avatarColor: p.avatarColor,
        pin: p.pin,
      },
      select: { id: true },
    })
    profiles.push(created)
  }

  // 3) Create categories + nested items (householdId = null).
  for (const cat of CATALOG) {
    await db.category.create({
      data: {
        title: cat.title,
        icon: cat.icon,
        sortOrder: cat.sortOrder,
        items: {
          create: cat.items.map((item) => ({
            title: item.title,
            pointTier: item.tier,
            status: itemStatusFor(item),
          })),
        },
      },
    })
  }

  // 4) Fetch created items so we can link historical purchase logs to them.
  const allItems = await db.item.findMany({})

  // 5) Create historical purchase logs + stamp item lastBought fields.
  for (const h of HISTORICAL_PURCHASES) {
    const item = allItems.find((i) => i.title === h.itemTitle)
    const buyer = profiles[h.profileIndex]
    if (!buyer) continue

    const purchasedAt = daysAgoDate(h.daysAgo)
    await db.purchaseLog.create({
      data: {
        itemId: item?.id ?? null,
        itemTitle: h.itemTitle,
        buyerId: buyer.id,
        pointTier: h.pointTier,
        pointsAwarded: h.pointsAwarded,
        purchasedAt,
        status: 'approved',
      },
    })

    if (item) {
      await db.item.update({
        where: { id: item.id },
        data: {
          lastBoughtAt: purchasedAt,
          lastBoughtById: buyer.id,
        },
      })
    }
  }

  return {
    profiles: profiles.length,
    categories: CATALOG.length,
    items: TOTAL_ITEMS,
  }
}

// ---------------------------------------------------------------------------
// seedCatalogForHousehold — per-household reset
// ---------------------------------------------------------------------------

/**
 * Wipe only the given household's items / categories / purchase logs and
 * reseed the catalog for it. Preserves users, profiles and memberships so
 * the household's social graph stays intact. If the household already has
 * 2+ profiles, the 4 historical demo purchase logs are recreated using the
 * two oldest profiles as buyers.
 *
 * @returns counts of inserted categories + items, plus the number of
 *          profiles found for the household.
 */
export async function seedCatalogForHousehold(
  db: PrismaClient,
  householdId: string,
): Promise<{
  categories: number
  items: number
  profiles: number
}> {
  // 1) Wipe only this household's catalog + logs (profiles / users /
  //    memberships are intentionally left untouched).
  await db.purchaseLog.deleteMany({ where: { householdId } })
  await db.item.deleteMany({ where: { householdId } })
  await db.category.deleteMany({ where: { householdId } })

  // 2) Load existing household profiles (oldest first) to reuse as buyers.
  const profiles = await db.profile.findMany({
    where: { householdId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  // 3) Create categories + items bound to this household.
  for (const cat of CATALOG) {
    await db.category.create({
      data: {
        householdId,
        title: cat.title,
        icon: cat.icon,
        sortOrder: cat.sortOrder,
        items: {
          create: cat.items.map((item) => ({
            householdId,
            title: item.title,
            pointTier: item.tier,
            status: itemStatusFor(item),
          })),
        },
      },
    })
  }

  // 4) Fetch created items so we can link the historical logs to them.
  const householdItems = await db.item.findMany({ where: { householdId } })

  // 5) Recreate historical purchase logs iff the household has 2+ profiles.
  if (profiles.length >= 2) {
    for (const h of HISTORICAL_PURCHASES) {
      const item = householdItems.find((i) => i.title === h.itemTitle)
      const buyer = profiles[h.profileIndex]
      if (!buyer) continue

      const purchasedAt = daysAgoDate(h.daysAgo)
      await db.purchaseLog.create({
        data: {
          householdId,
          itemId: item?.id ?? null,
          itemTitle: h.itemTitle,
          buyerId: buyer.id,
          pointTier: h.pointTier,
          pointsAwarded: h.pointsAwarded,
          purchasedAt,
          status: 'approved',
        },
      })

      if (item) {
        await db.item.update({
          where: { id: item.id },
          data: {
            lastBoughtAt: purchasedAt,
            lastBoughtById: buyer.id,
          },
        })
      }
    }
  }

  return {
    categories: CATALOG.length,
    items: TOTAL_ITEMS,
    profiles: profiles.length,
  }
}
