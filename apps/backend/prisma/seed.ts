/**
 * Seed de datos iniciales para Cianbox POS
 * Ejecutar: npx prisma db seed
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de datos...\n');

  // ==============================================
  // 1. AGENCY USER (Super Admin)
  // ==============================================
  console.log('👤 Creando usuario de agencia...');

  const agencyPasswordHash = await bcrypt.hash('Admin2024!', 12);

  const agencyUser = await prisma.agencyUser.upsert({
    where: { email: 'admin@cianboxpos.com' },
    update: {},
    create: {
      email: 'admin@cianboxpos.com',
      passwordHash: agencyPasswordHash,
      name: 'Administrador POS',
      status: 'ACTIVE',
    },
  });
  console.log(`   ✅ Agency user: ${agencyUser.email}`);

  // ==============================================
  // 2. DATABASE SERVER (Default)
  // ==============================================
  console.log('\n🗄️  Creando servidor de base de datos por defecto...');

  const dbServer = await prisma.databaseServer.upsert({
    where: { name: 'DB Principal' },
    update: {},
    create: {
      name: 'DB Principal',
      host: '172.16.1.62',
      port: 5432,
      database: 'cianbox_pos',
      username: 'cianbox_pos',
      password: 'encrypted:placeholder', // En producción usar encriptación real
      sslEnabled: false,
      maxConnections: 100,
      isDefault: true,
      isActive: true,
      region: 'ar-central',
      description: 'Servidor principal de base de datos',
      healthStatus: 'HEALTHY',
    },
  });
  console.log(`   ✅ DB Server: ${dbServer.name} (${dbServer.host})`);

  // ==============================================
  // 3. AGENCY SETTINGS
  // ==============================================
  console.log('\n⚙️  Creando configuración de agencia...');

  const agencySettings = await prisma.agencySettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      appName: 'Cianbox POS',
    },
  });
  console.log(`   ✅ App Name: ${agencySettings.appName}`);

  // ==============================================
  // 4. DEMO TENANT
  // ==============================================
  console.log('\n🏢 Creando tenant demo...');

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Demo Store S.A.',
      slug: 'demo',
      taxId: '30-12345678-9',
      plan: 'PRO',
      status: 'ACTIVE',
      databaseServerId: dbServer.id,
      settings: {
        currency: 'ARS',
        timezone: 'America/Argentina/Buenos_Aires',
        dateFormat: 'DD/MM/YYYY',
        ticketHeader: 'Demo Store\nAv. Corrientes 1234\nCABA - Argentina',
        ticketFooter: 'Gracias por su compra!',
      },
    },
  });
  console.log(`   ✅ Tenant: ${tenant.name} (${tenant.slug})`);

  // ==============================================
  // 5. ROLES
  // ==============================================
  console.log('\n🔐 Creando roles...');

  const roles = [
    {
      name: 'Administrador',
      description: 'Acceso total al sistema',
      isSystem: true,
      permissions: ['*'],
    },
    {
      name: 'Supervisor',
      description: 'Supervisión de operaciones',
      isSystem: true,
      permissions: [
        'pos:sell',
        'pos:discount',
        'pos:cancel',
        'pos:refund',
        'pos:view_reports',
        'inventory:view',
        'customers:view',
        'customers:edit',
        'cash:open',
        'cash:close',
        'cash:count',
        'cash:movements',
      ],
    },
    {
      name: 'Cajero',
      description: 'Operaciones de caja',
      isSystem: true,
      permissions: [
        'pos:sell',
        'pos:discount:limited', // Descuento limitado
        'cash:open',
        'cash:close',
        'cash:count', // Arqueo de caja
        'customers:view',
      ],
    },
  ];

  const createdRoles: Record<string, string> = {};

  for (const roleData of roles) {
    const role = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: roleData.name } },
      update: {},
      create: {
        tenantId: tenant.id,
        ...roleData,
      },
    });
    createdRoles[role.name] = role.id;
    console.log(`   ✅ Rol: ${role.name}`);
  }

  // ==============================================
  // 6. BRANCH (Sucursal)
  // ==============================================
  console.log('\n🏪 Creando sucursal...');

  const branch = await prisma.branch.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'SUC-001' } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: 'SUC-001',
      name: 'Casa Central',
      address: 'Av. Corrientes 1234',
      city: 'Buenos Aires',
      state: 'CABA',
      zipCode: '1043',
      phone: '+54 11 4567-8900',
      email: 'contacto@demostore.com',
      isDefault: true,
      isActive: true,
    },
  });
  console.log(`   ✅ Sucursal: ${branch.name} (${branch.code})`);

  // ==============================================
  // 7. PRICE LIST (Lista de precios)
  // ==============================================
  console.log('\n💰 Creando lista de precios...');

  const priceList = await prisma.priceList.create({
    data: {
      tenantId: tenant.id,
      name: 'Lista Minorista',
      description: 'Precios para venta minorista',
      currency: 'ARS',
      isDefault: true,
      isActive: true,
    },
  });
  console.log(`   ✅ Lista de precios: ${priceList.name}`);

  // ==============================================
  // 8. POINT OF SALE (Punto de venta)
  // ==============================================
  console.log('\n🖥️  Creando punto de venta...');

  const pointOfSale = await prisma.pointOfSale.upsert({
    where: { tenantId_branchId_code: { tenantId: tenant.id, branchId: branch.id, code: 'CAJA-01' } },
    update: {},
    create: {
      tenantId: tenant.id,
      branchId: branch.id,
      code: 'CAJA-01',
      name: 'Caja Principal',
      description: 'Punto de venta principal',
      priceListId: priceList.id,
      isActive: true,
      settings: {
        printTicket: true,
        openCashDrawer: true,
        allowNegativeStock: false,
        requireCustomer: false,
      },
    },
  });
  console.log(`   ✅ Punto de venta: ${pointOfSale.name} (${pointOfSale.code})`);

  // ==============================================
  // 9. ADMIN USER
  // ==============================================
  console.log('\n👤 Creando usuario administrador...');

  const adminPasswordHash = await bcrypt.hash('Admin2024!', 12);

  const adminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@demo.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@demo.com',
      passwordHash: adminPasswordHash,
      name: 'Administrador Demo',
      pin: '1234',
      status: 'ACTIVE',
      roleId: createdRoles['Administrador'],
      branchId: branch.id,
    },
  });
  console.log(`   ✅ Usuario: ${adminUser.name} (${adminUser.email})`);

  // ==============================================
  // 10. SAMPLE CATEGORIES
  // ==============================================
  console.log('\n📂 Creando categorías de ejemplo...');

  const categories = [
    { code: 'BEB', name: 'Bebidas', sortOrder: 1 },
    { code: 'ALI', name: 'Alimentos', sortOrder: 2 },
    { code: 'LIM', name: 'Limpieza', sortOrder: 3 },
    { code: 'PER', name: 'Perfumería', sortOrder: 4 },
  ];

  const createdCategories: Record<string, string> = {};

  for (const catData of categories) {
    const category = await prisma.category.create({
      data: {
        tenantId: tenant.id,
        code: catData.code,
        name: catData.name,
        sortOrder: catData.sortOrder,
        isActive: true,
      },
    });
    createdCategories[category.code!] = category.id;
    console.log(`   ✅ Categoría: ${category.name}`);
  }

  // ==============================================
  // 11. SAMPLE BRANDS
  // ==============================================
  console.log('\n🏷️  Creando marcas de ejemplo...');

  const brands = [
    { name: 'Coca-Cola' },
    { name: 'Pepsi' },
    { name: 'Quilmes' },
    { name: 'Arcor' },
  ];

  const createdBrands: Record<string, string> = {};

  for (const brandData of brands) {
    const brand = await prisma.brand.create({
      data: {
        tenantId: tenant.id,
        name: brandData.name,
        isActive: true,
      },
    });
    createdBrands[brand.name] = brand.id;
    console.log(`   ✅ Marca: ${brand.name}`);
  }

  // ==============================================
  // 12. SAMPLE PRODUCTS
  // ==============================================
  console.log('\n📦 Creando productos de ejemplo...');

  const products = [
    { sku: 'BEB-001', barcode: '7790895000010', name: 'Coca-Cola 500ml', category: 'BEB', brand: 'Coca-Cola', price: 1500 },
    { sku: 'BEB-002', barcode: '7790895000027', name: 'Coca-Cola 1.5L', category: 'BEB', brand: 'Coca-Cola', price: 2500 },
    { sku: 'BEB-003', barcode: '7790895000034', name: 'Coca-Cola 2.25L', category: 'BEB', brand: 'Coca-Cola', price: 3200 },
    { sku: 'BEB-004', barcode: '7791813421016', name: 'Pepsi 500ml', category: 'BEB', brand: 'Pepsi', price: 1400 },
    { sku: 'BEB-005', barcode: '7792798000012', name: 'Quilmes 1L', category: 'BEB', brand: 'Quilmes', price: 2800 },
    { sku: 'ALI-001', barcode: '7790580393010', name: 'Galletitas Arcor Dulces', category: 'ALI', brand: 'Arcor', price: 1200 },
    { sku: 'ALI-002', barcode: '7790580393027', name: 'Caramelos Arcor', category: 'ALI', brand: 'Arcor', price: 800 },
  ];

  for (const prodData of products) {
    const product = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        sku: prodData.sku,
        barcode: prodData.barcode,
        name: prodData.name,
        categoryId: createdCategories[prodData.category],
        brandId: createdBrands[prodData.brand],
        basePrice: prodData.price,
        taxRate: 21,
        taxIncluded: true,
        trackStock: true,
        unitOfMeasure: 'UN',
        isActive: true,
      },
    });

    // Crear precio en lista de precios
    await prisma.productPrice.create({
      data: {
        productId: product.id,
        priceListId: priceList.id,
        price: prodData.price,
      },
    });

    // Crear stock inicial
    await prisma.productStock.create({
      data: {
        productId: product.id,
        branchId: branch.id,
        quantity: 100,
        reserved: 0,
        available: 100,
      },
    });

    console.log(`   ✅ Producto: ${product.name} - $${prodData.price}`);
  }

  // ==============================================
  // 13. CARD TERMINALS (Terminales de Tarjetas no integrados)
  // ==============================================
  console.log('\n💳 Creando terminales de tarjeta de sistema...');

  const systemTerminals = [
    { name: 'Posnet', code: 'POSNET' },
    { name: 'Lapos', code: 'LAPOS' },
    { name: 'Payway', code: 'PAYWAY' },
    { name: 'Getnet', code: 'GETNET' },
    { name: 'Clover', code: 'CLOVER' },
    { name: 'NaranjaX', code: 'NARANJAX' },
    { name: 'Ualá', code: 'UALA' },
    { name: 'Viumi Macro', code: 'VIUMI' },
  ];

  for (const terminalData of systemTerminals) {
    const terminal = await prisma.cardTerminal.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: terminalData.code } },
      update: {},
      create: {
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
    console.log(`   ✅ Terminal: ${terminal.name} (${terminal.code})`);
  }

  // ==============================================
  // 14. SAMPLE PROMOTION
  // ==============================================
  console.log('\n🎉 Creando promoción de ejemplo...');

  const promotion = await prisma.promotion.create({
    data: {
      tenantId: tenant.id,
      code: 'PROMO2X1',
      name: '2x1 en Bebidas',
      description: 'Llevá 2 bebidas y pagá 1',
      type: 'BUY_X_GET_Y',
      discountType: 'PERCENTAGE',
      discountValue: 50,
      buyQuantity: 2,
      getQuantity: 1,
      applyTo: 'CATEGORIES',
      categoryIds: [createdCategories['BEB']],
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
      isActive: true,
      priority: 1,
      stackable: false,
      metadata: { event: 'VERANO_2024' },
    },
  });
  console.log(`   ✅ Promoción: ${promotion.name}`);

  // ==============================================
  // RESUMEN FINAL
  // ==============================================
  console.log('\n' + '='.repeat(50));
  console.log('✅ SEED COMPLETADO EXITOSAMENTE');
  console.log('='.repeat(50));
  console.log('\n📋 Credenciales de acceso:');
  console.log('\n   🔑 AGENCIA (Super Admin):');
  console.log('      Email: admin@cianboxpos.com');
  console.log('      Password: Admin2024!');
  console.log('\n   🔑 TENANT DEMO (Admin):');
  console.log('      Tenant: demo');
  console.log('      Email: admin@demo.com');
  console.log('      Password: Admin2024!');
  console.log('      PIN: 1234');
  console.log('\n');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error en seed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
