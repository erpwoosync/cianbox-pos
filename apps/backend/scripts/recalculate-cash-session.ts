/**
 * Script para recalcular los totales de una sesión de caja
 *
 * Uso: npx tsx scripts/recalculate-cash-session.ts <sessionId> [--dry-run]
 *
 * Ejemplo:
 *   npx tsx scripts/recalculate-cash-session.ts cmjh8007t000fpjs286f8qc0z --dry-run
 *   npx tsx scripts/recalculate-cash-session.ts cmjh8007t000fpjs286f8qc0z
 */

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface RecalculatedTotals {
  salesCount: number;
  salesTotal: number;
  refundsCount: number;
  refundsTotal: number;
  totalCash: number;
  totalDebit: number;
  totalCredit: number;
  totalQr: number;
  totalMpPoint: number;
  totalTransfer: number;
  totalOther: number;
}

async function recalculateCashSession(sessionId: string, dryRun: boolean = false) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Recalculando sesión de caja: ${sessionId}`);
  console.log(`Modo: ${dryRun ? 'DRY-RUN (solo mostrar, no actualizar)' : 'EJECUTAR'}`);
  console.log(`${'='.repeat(60)}\n`);

  // Obtener sesión con todas las ventas y movimientos
  const session = await prisma.cashSession.findUnique({
    where: { id: sessionId },
    include: {
      sales: {
        include: { payments: true },
      },
      movements: true,
      pointOfSale: true,
      user: { select: { name: true, email: true } },
    },
  });

  if (!session) {
    console.error(`ERROR: Sesión no encontrada: ${sessionId}`);
    process.exit(1);
  }

  console.log(`Sesión encontrada:`);
  console.log(`  - Número: ${session.sessionNumber}`);
  console.log(`  - POS: ${session.pointOfSale.name} (${session.pointOfSale.code})`);
  console.log(`  - Usuario: ${session.user.name} (${session.user.email})`);
  console.log(`  - Estado: ${session.status}`);
  console.log(`  - Apertura: $${Number(session.openingAmount).toLocaleString()}`);
  console.log(`  - Ventas vinculadas: ${session.sales.length}`);
  console.log(`  - Movimientos: ${session.movements.length}`);

  // Calcular totales correctos
  const calculated: RecalculatedTotals = {
    salesCount: 0,
    salesTotal: 0,
    refundsCount: 0,
    refundsTotal: 0,
    totalCash: 0,
    totalDebit: 0,
    totalCredit: 0,
    totalQr: 0,
    totalMpPoint: 0,
    totalTransfer: 0,
    totalOther: 0,
  };

  console.log(`\n--- Procesando ventas ---\n`);

  for (const sale of session.sales) {
    const saleTotal = Number(sale.total);
    const isRefund = saleTotal < 0 || sale.status === 'REFUNDED';

    if (sale.status === 'COMPLETED') {
      if (isRefund) {
        // Es una venta de devolución (total negativo)
        calculated.refundsCount++;
        calculated.refundsTotal += Math.abs(saleTotal);
        console.log(`  [DEVOLUCIÓN] ${sale.saleNumber}: $${saleTotal.toLocaleString()}`);
      } else {
        // Venta normal
        calculated.salesCount++;
        calculated.salesTotal += saleTotal;
        console.log(`  [VENTA] ${sale.saleNumber}: $${saleTotal.toLocaleString()}`);
      }

      // Procesar pagos
      for (const payment of sale.payments) {
        if (payment.status !== 'COMPLETED') continue;

        const amount = Number(payment.amount);
        console.log(`    - ${payment.method}: $${amount.toLocaleString()}`);

        switch (payment.method) {
          case 'CASH':
            calculated.totalCash += amount;
            break;
          case 'DEBIT_CARD':
            calculated.totalDebit += amount;
            break;
          case 'CREDIT_CARD':
            calculated.totalCredit += amount;
            break;
          case 'QR':
            calculated.totalQr += amount;
            break;
          case 'MP_POINT':
            calculated.totalMpPoint += amount;
            break;
          case 'TRANSFER':
            calculated.totalTransfer += amount;
            break;
          case 'CREDIT': // Crédito de devolución
          case 'GIFTCARD':
          case 'VOUCHER':
          default:
            calculated.totalOther += amount;
        }
      }
    } else if (sale.status === 'CANCELLED') {
      console.log(`  [ANULADA] ${sale.saleNumber}: $${saleTotal.toLocaleString()} (ignorada)`);
    } else {
      console.log(`  [${sale.status}] ${sale.saleNumber}: $${saleTotal.toLocaleString()}`);
    }
  }

  // Mostrar comparación
  console.log(`\n--- Comparación de totales ---\n`);
  console.log(`${'Campo'.padEnd(20)} ${'Actual'.padStart(15)} ${'Calculado'.padStart(15)} ${'Diferencia'.padStart(15)}`);
  console.log(`${'-'.repeat(65)}`);

  const fields: Array<{ name: string; dbField: keyof typeof session; calcField: keyof RecalculatedTotals }> = [
    { name: 'salesCount', dbField: 'salesCount', calcField: 'salesCount' },
    { name: 'salesTotal', dbField: 'salesTotal', calcField: 'salesTotal' },
    { name: 'refundsCount', dbField: 'refundsCount', calcField: 'refundsCount' },
    { name: 'refundsTotal', dbField: 'refundsTotal', calcField: 'refundsTotal' },
    { name: 'totalCash', dbField: 'totalCash', calcField: 'totalCash' },
    { name: 'totalDebit', dbField: 'totalDebit', calcField: 'totalDebit' },
    { name: 'totalCredit', dbField: 'totalCredit', calcField: 'totalCredit' },
    { name: 'totalQr', dbField: 'totalQr', calcField: 'totalQr' },
    { name: 'totalMpPoint', dbField: 'totalMpPoint', calcField: 'totalMpPoint' },
    { name: 'totalTransfer', dbField: 'totalTransfer', calcField: 'totalTransfer' },
    { name: 'totalOther', dbField: 'totalOther', calcField: 'totalOther' },
  ];

  let hasDiscrepancy = false;

  for (const field of fields) {
    const actual = Number(session[field.dbField] || 0);
    const calc = calculated[field.calcField];
    const diff = calc - actual;

    if (Math.abs(diff) > 0.01) {
      hasDiscrepancy = true;
      console.log(`${field.name.padEnd(20)} ${actual.toLocaleString().padStart(15)} ${calc.toLocaleString().padStart(15)} ${diff.toLocaleString().padStart(15)} ⚠️`);
    } else {
      console.log(`${field.name.padEnd(20)} ${actual.toLocaleString().padStart(15)} ${calc.toLocaleString().padStart(15)} ${diff.toLocaleString().padStart(15)} ✓`);
    }
  }

  // Calcular suma de métodos de pago
  const sumPaymentMethods =
    calculated.totalCash +
    calculated.totalDebit +
    calculated.totalCredit +
    calculated.totalQr +
    calculated.totalMpPoint +
    calculated.totalTransfer +
    calculated.totalOther;

  console.log(`\n--- Validación ---`);
  console.log(`Suma métodos de pago: $${sumPaymentMethods.toLocaleString()}`);
  console.log(`Sales Total (neto):   $${(calculated.salesTotal - calculated.refundsTotal).toLocaleString()}`);

  if (!hasDiscrepancy) {
    console.log(`\n✅ No hay discrepancias. La sesión tiene los totales correctos.`);
    return;
  }

  console.log(`\n⚠️  Se encontraron discrepancias.`);

  if (dryRun) {
    console.log(`\n[DRY-RUN] Para aplicar los cambios, ejecuta sin --dry-run`);
    return;
  }

  // Aplicar corrección
  console.log(`\nAplicando corrección...`);

  await prisma.cashSession.update({
    where: { id: sessionId },
    data: {
      salesCount: calculated.salesCount,
      salesTotal: new Prisma.Decimal(calculated.salesTotal),
      refundsCount: calculated.refundsCount,
      refundsTotal: new Prisma.Decimal(calculated.refundsTotal),
      totalCash: new Prisma.Decimal(calculated.totalCash),
      totalDebit: new Prisma.Decimal(calculated.totalDebit),
      totalCredit: new Prisma.Decimal(calculated.totalCredit),
      totalQr: new Prisma.Decimal(calculated.totalQr),
      totalMpPoint: new Prisma.Decimal(calculated.totalMpPoint),
      totalTransfer: new Prisma.Decimal(calculated.totalTransfer),
      totalOther: new Prisma.Decimal(calculated.totalOther),
    },
  });

  console.log(`\n✅ Sesión actualizada correctamente.`);
}

// Main
const args = process.argv.slice(2);
const sessionId = args[0];
const dryRun = args.includes('--dry-run');

if (!sessionId) {
  console.log(`
Uso: npx tsx scripts/recalculate-cash-session.ts <sessionId> [--dry-run]

Opciones:
  --dry-run    Solo mostrar los cambios, no aplicarlos

Ejemplo:
  npx tsx scripts/recalculate-cash-session.ts cmjh8007t000fpjs286f8qc0z --dry-run
  npx tsx scripts/recalculate-cash-session.ts cmjh8007t000fpjs286f8qc0z
`);
  process.exit(1);
}

recalculateCashSession(sessionId, dryRun)
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
