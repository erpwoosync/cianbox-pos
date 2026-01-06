/**
 * Script para crear marcas de tarjeta de sistema en todos los tenants
 *
 * Uso: npx tsx scripts/seed-card-brands.ts [--dry-run]
 *
 * Ejemplo:
 *   npx tsx scripts/seed-card-brands.ts --dry-run
 *   npx tsx scripts/seed-card-brands.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Marcas de tarjeta del sistema predefinidas
const SYSTEM_CARD_BRANDS = [
  { name: 'Visa', code: 'VISA' },
  { name: 'Mastercard', code: 'MC' },
  { name: 'American Express', code: 'AMEX' },
  { name: 'Naranja', code: 'NARANJA' },
  { name: 'Cabal', code: 'CABAL' },
  { name: 'Maestro', code: 'MAESTRO' },
  { name: 'Tarjeta Shopping', code: 'SHOPPING' },
  { name: 'Tarjeta Nevada', code: 'NEVADA' },
  { name: 'Diners Club', code: 'DINERS' },
  { name: 'Argencard', code: 'ARGENCARD' },
  { name: 'Nativa', code: 'NATIVA' },
  { name: 'Tarjeta Sol', code: 'SOL' },
];

async function seedCardBrands(dryRun: boolean = false) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('💳 Seed de Marcas de Tarjeta de Sistema');
  console.log(`Modo: ${dryRun ? 'DRY-RUN (solo mostrar)' : 'EJECUTAR'}`);
  console.log(`${'='.repeat(60)}\n`);

  // Obtener todos los tenants activos
  const tenants = await prisma.tenant.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true, slug: true },
  });

  console.log(`Encontrados ${tenants.length} tenant(s) activo(s)\n`);

  let totalCreated = 0;
  let totalExisting = 0;

  for (const tenant of tenants) {
    console.log(`\n📦 Tenant: ${tenant.name} (${tenant.slug})`);

    // Verificar qué marcas ya existen para este tenant
    const existingBrands = await prisma.cardBrand.findMany({
      where: { tenantId: tenant.id },
      select: { code: true },
    });

    const existingCodes = new Set(existingBrands.map((b) => b.code));

    for (const brandData of SYSTEM_CARD_BRANDS) {
      if (existingCodes.has(brandData.code)) {
        console.log(`   ⏭️  ${brandData.name} (${brandData.code}) - ya existe`);
        totalExisting++;
        continue;
      }

      if (dryRun) {
        console.log(`   🔵 ${brandData.name} (${brandData.code}) - SE CREARÍA`);
        totalCreated++;
      } else {
        await prisma.cardBrand.create({
          data: {
            tenantId: tenant.id,
            name: brandData.name,
            code: brandData.code,
            isActive: true,
            isSystem: true,
          },
        });
        console.log(`   ✅ ${brandData.name} (${brandData.code}) - creado`);
        totalCreated++;
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 Resumen:');
  console.log(`   - Tenants procesados: ${tenants.length}`);
  console.log(`   - Marcas existentes: ${totalExisting}`);
  console.log(`   - Marcas ${dryRun ? 'a crear' : 'creadas'}: ${totalCreated}`);
  console.log(`${'='.repeat(60)}\n`);

  if (dryRun && totalCreated > 0) {
    console.log('Para aplicar los cambios, ejecutar sin --dry-run\n');
  }
}

// Main
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

seedCardBrands(dryRun)
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
