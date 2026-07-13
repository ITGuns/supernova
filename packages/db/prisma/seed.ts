import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // Phase 1 seeds reference data (system Roles + Permissions, default TaxGroups, a demo Organization/Store).
  // Phase 6 seeds realistic demo catalog/inventory/orders.
  console.log('Nova seed: no-op placeholder — implemented in Phase 1 (reference) and Phase 6 (demo).');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
