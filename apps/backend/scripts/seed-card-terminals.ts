/**
 * Script para crear terminales de tarjeta de sistema en todos los tenants
 *
 * Uso: npx tsx scripts/seed-card-terminals.ts [--dry-run]
 *
 * Ejemplo:
 *   npx tsx scripts/seed-card-terminals.ts --dry-run
 *   npx tsx scripts/seed-card-terminals.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Terminales de sistema predefinidos
const SYSTEM_TERMINALS = [
  { name: 'Posnet', code: 'POSNET' },
  { name: 'Lapos', code: 'LAPOS' },
  { name: 'Payway', code: 'PAYWAY' },
  { name: 'Getnet', code: 'GETNET' },
  { name: 'Clover', code: 'CLOVER' },
  { name: 'NaranjaX', code: 'NARANJAX' },
  { name: 'Ualá', code: 'UALA' },
  { name: 'Viumi Macro', code: 'VIUMI' },
];

async function seedCardTerminals(dryRun: boolean = false) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('💳 Seed de Terminales de Tarjeta de Sistema');
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

    // Verificar qué terminales ya existen para este tenant
    const existingTerminals = await prisma.cardTerminal.findMany({
      where: { tenantId: tenant.id },
      select: { code: true },
    });

    const existingCodes = new Set(existingTerminals.map((t) => t.code));

    for (const terminalData of SYSTEM_TERMINALS) {
      if (existingCodes.has(terminalData.code)) {
        console.log(`   ⏭️  ${terminalData.name} (${terminalData.code}) - ya existe`);
        totalExisting++;
        continue;
      }

      if (dryRun) {
        console.log(`   🔵 ${terminalData.name} (${terminalData.code}) - SE CREARÍA`);
        totalCreated++;
      } else {
        await prisma.cardTerminal.create({
          data: {
            tenantId: tenant.id,
            name: terminalData.name,
            code: terminalData.code,
            isActive: true,
            isSystem: true,
            requiresAuthCode: true,
            requiresVoucherNumber: true,
            requiresCardBrand: false,
            requiresLastFour: false,
            requiresInstallments: true,
            requiresBatchNumber: true,
          },
        });
        console.log(`   ✅ ${terminalData.name} (${terminalData.code}) - creado`);
        totalCreated++;
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 Resumen:');
  console.log(`   - Tenants procesados: ${tenants.length}`);
  console.log(`   - Terminales existentes: ${totalExisting}`);
  console.log(`   - Terminales ${dryRun ? 'a crear' : 'creados'}: ${totalCreated}`);
  console.log(`${'='.repeat(60)}\n`);

  if (dryRun && totalCreated > 0) {
    console.log('Para aplicar los cambios, ejecutar sin --dry-run\n');
  }
}

// Main
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

seedCardTerminals(dryRun)
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
