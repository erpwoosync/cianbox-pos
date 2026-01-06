/**
 * Script para migrar pagos con tarjeta existentes a CardVoucher
 *
 * Busca pagos que tengan:
 * - cardTerminalId (terminal no integrado)
 * - mpPaymentId con método MP_POINT (Mercado Pago Point)
 *
 * Y crea el CardVoucher correspondiente si no existe.
 *
 * Uso: npx tsx scripts/migrate-payments-to-vouchers.ts [--dry-run]
 */

import { PrismaClient, PaymentMethod } from '@prisma/client';

const prisma = new PrismaClient();

async function migratePaymentsToVouchers(dryRun: boolean = false) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('💳 Migración de Pagos a CardVouchers');
  console.log(`Modo: ${dryRun ? 'DRY-RUN (solo mostrar)' : 'EJECUTAR'}`);
  console.log(`${'='.repeat(60)}\n`);

  // Buscar pagos que deberían tener CardVoucher
  const payments = await prisma.payment.findMany({
    where: {
      OR: [
        // Pagos con terminal de tarjeta no integrado
        { cardTerminalId: { not: null } },
        // Pagos de MP Point
        {
          AND: [
            { method: PaymentMethod.MP_POINT },
            { mpPaymentId: { not: null } },
          ],
        },
      ],
    },
    include: {
      sale: {
        select: {
          id: true,
          tenantId: true,
          saleDate: true,
          saleNumber: true,
        },
      },
      cardTerminal: true,
      cardVoucher: true, // Para verificar si ya existe
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Encontrados ${payments.length} pagos con tarjeta`);

  // Filtrar los que ya tienen CardVoucher
  const paymentsWithoutVoucher = payments.filter((p) => !p.cardVoucher);
  const paymentsWithVoucher = payments.filter((p) => p.cardVoucher);

  console.log(`  - ${paymentsWithVoucher.length} ya tienen CardVoucher (se omiten)`);
  console.log(`  - ${paymentsWithoutVoucher.length} necesitan CardVoucher\n`);

  if (paymentsWithoutVoucher.length === 0) {
    console.log('✅ No hay pagos pendientes de migrar\n');
    return;
  }

  let created = 0;
  let failed = 0;

  for (const payment of paymentsWithoutVoucher) {
    const isCardTerminal = payment.cardTerminalId !== null;
    const isMpPoint = payment.method === PaymentMethod.MP_POINT && payment.mpPaymentId !== null;

    if (!isCardTerminal && !isMpPoint) {
      continue; // No debería pasar, pero por seguridad
    }

    const source = isCardTerminal ? 'CARD_TERMINAL' : 'MERCADO_PAGO';
    const tenantId = payment.sale.tenantId;

    // Buscar cardBrandId si hay cardBrand
    let cardBrandId: string | null = null;
    if (payment.cardBrand) {
      const cardBrand = await prisma.cardBrand.findFirst({
        where: {
          tenantId,
          OR: [
            { code: payment.cardBrand.toUpperCase() },
            { name: { contains: payment.cardBrand, mode: 'insensitive' } },
          ],
        },
      });
      cardBrandId = cardBrand?.id || null;
    }

    if (dryRun) {
      console.log(`🔵 SE CREARÍA: ${payment.sale.saleNumber} - ${source} - $${payment.amount}`);
      created++;
    } else {
      try {
        await prisma.cardVoucher.create({
          data: {
            tenantId,
            paymentId: payment.id,
            source,
            cardTerminalId: payment.cardTerminalId,
            cardBrandId,
            cardLastFour: payment.cardLastFour,
            voucherNumber: payment.voucherNumber,
            batchNumber: payment.batchNumber,
            authorizationCode: payment.authorizationCode,
            installments: payment.installments || 1,
            mpPaymentId: payment.mpPaymentId,
            saleDate: payment.sale.saleDate,
            amount: payment.amount,
            status: 'PENDING',
          },
        });
        console.log(`✅ Creado: ${payment.sale.saleNumber} - ${source} - $${payment.amount}`);
        created++;
      } catch (error) {
        console.error(`❌ Error en ${payment.sale.saleNumber}:`, error);
        failed++;
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 Resumen:');
  console.log(`   - Total pagos con tarjeta: ${payments.length}`);
  console.log(`   - Ya tenían voucher: ${paymentsWithVoucher.length}`);
  console.log(`   - CardVouchers ${dryRun ? 'a crear' : 'creados'}: ${created}`);
  if (failed > 0) {
    console.log(`   - Errores: ${failed}`);
  }
  console.log(`${'='.repeat(60)}\n`);

  if (dryRun && created > 0) {
    console.log('Para aplicar los cambios, ejecutar sin --dry-run\n');
  }
}

// Main
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

migratePaymentsToVouchers(dryRun)
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
