import { PrismaClient } from '@prisma/client'
import { seedDatabase } from '../src/lib/catalog'

const db = new PrismaClient()
async function main() {
  console.log('🌱 Seeding database...')
  const result = await seedDatabase(db)
  console.log(`✓ ${result.profiles} profiles, ${result.categories} categories, ${result.items} items`)
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
