/**
 * Rutas de promociones y combos
 */

import { Router, Response, NextFunction } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.js';
import { ValidationError, NotFoundError, ApiError } from '../utils/errors.js';

const router = Router();
const prisma = new PrismaClient();

// Schemas de validación
const promotionCreateSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1, 'Nombre requerido'),
  description: z.string().optional(),
  type: z.enum([
    'PERCENTAGE',
    'FIXED_AMOUNT',
    'BUY_X_GET_Y',
    'SECOND_UNIT_DISCOUNT',
    'BUNDLE_PRICE',
    'FREE_SHIPPING',
    'COUPON',
    'FLASH_SALE',
    'LOYALTY',
  ]),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FIXED_PRICE']).default('PERCENTAGE'),
  discountValue: z.number().min(0),
  buyQuantity: z.number().int().min(1).optional(),
  getQuantity: z.number().int().min(1).optional(),
  minPurchase: z.number().min(0).optional(),
  maxDiscount: z.number().min(0).optional(),
  applyTo: z
    .enum(['ALL_PRODUCTS', 'SPECIFIC_PRODUCTS', 'CATEGORIES', 'BRANDS', 'CART_TOTAL'])
    .default('SPECIFIC_PRODUCTS'),
  categoryIds: z.array(z.string()).optional(),
  brandIds: z.array(z.string()).optional(),
  productIds: z.array(z.string()).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  maxUses: z.number().int().min(1).optional(),
  maxUsesPerCustomer: z.number().int().min(1).optional(),
  isActive: z.boolean().default(true),
  priority: z.number().int().default(0),
  stackable: z.boolean().default(false),
  metadata: z.any().optional(),
});

const promotionUpdateSchema = promotionCreateSchema.partial();

const comboCreateSchema = z.object({
  code: z.string().min(1, 'Código requerido'),
  name: z.string().min(1, 'Nombre requerido'),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  regularPrice: z.number().min(0),
  comboPrice: z.number().min(0),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().min(1).default(1),
      })
    )
    .min(2, 'El combo debe tener al menos 2 productos'),
});

const comboUpdateSchema = comboCreateSchema.partial();

// =============================================
// PROMOCIONES
// =============================================

/**
 * GET /api/promotions
 * Listar promociones
 */
router.get(
  '/',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { isActive, type, page = '1', pageSize = '50' } = req.query;
      const tenantId = req.user!.tenantId;
      const skip = (parseInt(page as string) - 1) * parseInt(pageSize as string);
      const take = parseInt(pageSize as string);

      const where: Record<string, unknown> = { tenantId };

      if (isActive !== undefined) {
        where.isActive = isActive === 'true';
      }

      if (type) {
        where.type = type;
      }

      const [promotions, total] = await Promise.all([
        prisma.promotion.findMany({
          where,
          include: {
            applicableProducts: {
              include: {
                product: { select: { id: true, name: true, sku: true } },
              },
            },
            _count: { select: { saleItems: true } },
          },
          skip,
          take,
          orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        }),
        prisma.promotion.count({ where }),
      ]);

      res.json({
        success: true,
        data: promotions,
        pagination: {
          page: parseInt(page as string),
          pageSize: parseInt(pageSize as string),
          total,
          totalPages: Math.ceil(total / parseInt(pageSize as string)),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/promotions/active
 * Obtener promociones activas aplicables ahora
 */
router.get(
  '/active',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const now = new Date();
      const currentDay = now.getDay(); // 0-6
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM

      const promotions = await prisma.promotion.findMany({
        where: {
          tenantId,
          isActive: true,
          OR: [
            { startDate: null },
            { startDate: { lte: now } },
          ],
          AND: [
            {
              OR: [
                { endDate: null },
                { endDate: { gte: now } },
              ],
            },
          ],
        },
        include: {
          applicableProducts: {
            include: {
              product: { select: { id: true, name: true, sku: true, barcode: true } },
            },
          },
        },
        orderBy: { priority: 'desc' },
      });

      // Filtrar por día de la semana y hora
      const activePromotions = promotions.filter((promo) => {
        // Verificar día de la semana
        if (promo.daysOfWeek && promo.daysOfWeek.length > 0) {
          if (!promo.daysOfWeek.includes(currentDay)) {
            return false;
          }
        }

        // Verificar horario
        if (promo.startTime && currentTime < promo.startTime) {
          return false;
        }
        if (promo.endTime && currentTime > promo.endTime) {
          return false;
        }

        // Verificar usos máximos
        if (promo.maxUses && promo.currentUses >= promo.maxUses) {
          return false;
        }

        return true;
      });

      res.json({ success: true, data: activePromotions });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/promotions/:id
 * Obtener promoción por ID
 */
router.get(
  '/:id',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const promotion = await prisma.promotion.findFirst({
        where: {
          id: req.params.id,
          tenantId: req.user!.tenantId,
        },
        include: {
          applicableProducts: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!promotion) {
        throw new NotFoundError('Promoción');
      }

      res.json({ success: true, data: promotion });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/promotions
 * Crear promoción
 */
router.post(
  '/',
  authenticate,
  authorize('settings:edit'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validation = promotionCreateSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError('Datos inválidos', validation.error.errors);
      }

      const data = validation.data;
      const tenantId = req.user!.tenantId;

      // Verificar código único
      if (data.code) {
        const existing = await prisma.promotion.findUnique({
          where: { tenantId_code: { tenantId, code: data.code } },
        });
        if (existing) {
          throw ApiError.conflict('Ya existe una promoción con ese código');
        }
      }

      const { productIds, ...promotionData } = data;

      const promotion = await prisma.promotion.create({
        data: {
          tenantId,
          ...promotionData,
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
          applicableProducts: productIds
            ? {
                create: productIds.map((productId) => ({
                  productId,
                })),
              }
            : undefined,
        },
        include: {
          applicableProducts: {
            include: { product: true },
          },
        },
      });

      res.status(201).json({ success: true, data: promotion });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/promotions/:id
 * Actualizar promoción
 */
router.put(
  '/:id',
  authenticate,
  authorize('settings:edit'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validation = promotionUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError('Datos inválidos', validation.error.errors);
      }

      const data = validation.data;
      const tenantId = req.user!.tenantId;

      const existing = await prisma.promotion.findFirst({
        where: { id: req.params.id, tenantId },
      });

      if (!existing) {
        throw new NotFoundError('Promoción');
      }

      // Verificar código único si cambió
      if (data.code && data.code !== existing.code) {
        const codeExists = await prisma.promotion.findUnique({
          where: { tenantId_code: { tenantId, code: data.code } },
        });
        if (codeExists) {
          throw ApiError.conflict('Ya existe una promoción con ese código');
        }
      }

      const { productIds, ...promotionData } = data;

      // Actualizar promoción y productos
      const promotion = await prisma.$transaction(async (tx) => {
        // Si hay productIds, actualizar relaciones
        if (productIds !== undefined) {
          await tx.promotionProduct.deleteMany({
            where: { promotionId: req.params.id },
          });

          if (productIds.length > 0) {
            await tx.promotionProduct.createMany({
              data: productIds.map((productId) => ({
                promotionId: req.params.id,
                productId,
              })),
            });
          }
        }

        return tx.promotion.update({
          where: { id: req.params.id },
          data: {
            ...promotionData,
            startDate: data.startDate ? new Date(data.startDate) : undefined,
            endDate: data.endDate ? new Date(data.endDate) : undefined,
          },
          include: {
            applicableProducts: {
              include: { product: true },
            },
          },
        });
      });

      res.json({ success: true, data: promotion });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/promotions/:id
 * Eliminar promoción
 */
router.delete(
  '/:id',
  authenticate,
  authorize('settings:edit'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;

      const existing = await prisma.promotion.findFirst({
        where: { id: req.params.id, tenantId },
      });

      if (!existing) {
        throw new NotFoundError('Promoción');
      }

      // Desactivar en lugar de eliminar si tiene usos
      if (existing.currentUses > 0) {
        await prisma.promotion.update({
          where: { id: req.params.id },
          data: { isActive: false },
        });
        return res.json({
          success: true,
          message: 'Promoción desactivada (tiene ventas asociadas)',
        });
      }

      await prisma.promotion.delete({
        where: { id: req.params.id },
      });

      res.json({ success: true, message: 'Promoción eliminada' });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================
// COMBOS
// =============================================

/**
 * GET /api/promotions/combos
 * Listar combos
 */
router.get(
  '/combos',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { isActive } = req.query;
      const tenantId = req.user!.tenantId;

      const where: Record<string, unknown> = { tenantId };

      if (isActive !== undefined) {
        where.isActive = isActive === 'true';
      }

      const combos = await prisma.combo.findMany({
        where,
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true, imageUrl: true } },
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      res.json({ success: true, data: combos });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/promotions/combos/active
 * Obtener combos activos aplicables ahora
 */
router.get(
  '/combos/active',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const now = new Date();

      const combos = await prisma.combo.findMany({
        where: {
          tenantId,
          isActive: true,
          OR: [
            { startDate: null },
            { startDate: { lte: now } },
          ],
          AND: [
            {
              OR: [
                { endDate: null },
                { endDate: { gte: now } },
              ],
            },
          ],
        },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, barcode: true, imageUrl: true },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      res.json({ success: true, data: combos });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/promotions/combos/:id
 * Obtener combo por ID
 */
router.get(
  '/combos/:id',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const combo = await prisma.combo.findFirst({
        where: {
          id: req.params.id,
          tenantId: req.user!.tenantId,
        },
        include: {
          items: {
            include: { product: true },
          },
        },
      });

      if (!combo) {
        throw new NotFoundError('Combo');
      }

      res.json({ success: true, data: combo });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/promotions/combos
 * Crear combo
 */
router.post(
  '/combos',
  authenticate,
  authorize('settings:edit'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validation = comboCreateSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError('Datos inválidos', validation.error.errors);
      }

      const data = validation.data;
      const tenantId = req.user!.tenantId;

      // Verificar código único
      const existing = await prisma.combo.findUnique({
        where: { tenantId_code: { tenantId, code: data.code } },
      });
      if (existing) {
        throw ApiError.conflict('Ya existe un combo con ese código');
      }

      const { items, ...comboData } = data;

      const combo = await prisma.combo.create({
        data: {
          tenantId,
          ...comboData,
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
          },
        },
        include: {
          items: {
            include: { product: true },
          },
        },
      });

      res.status(201).json({ success: true, data: combo });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/promotions/combos/:id
 * Actualizar combo
 */
router.put(
  '/combos/:id',
  authenticate,
  authorize('settings:edit'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const validation = comboUpdateSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ValidationError('Datos inválidos', validation.error.errors);
      }

      const data = validation.data;
      const tenantId = req.user!.tenantId;

      const existing = await prisma.combo.findFirst({
        where: { id: req.params.id, tenantId },
      });

      if (!existing) {
        throw new NotFoundError('Combo');
      }

      // Verificar código único si cambió
      if (data.code && data.code !== existing.code) {
        const codeExists = await prisma.combo.findUnique({
          where: { tenantId_code: { tenantId, code: data.code } },
        });
        if (codeExists) {
          throw ApiError.conflict('Ya existe un combo con ese código');
        }
      }

      const { items, ...comboData } = data;

      const combo = await prisma.$transaction(async (tx) => {
        // Actualizar items si se proporcionaron
        if (items !== undefined) {
          await tx.comboItem.deleteMany({
            where: { comboId: req.params.id },
          });

          if (items.length > 0) {
            await tx.comboItem.createMany({
              data: items.map((item) => ({
                comboId: req.params.id,
                productId: item.productId,
                quantity: item.quantity,
              })),
            });
          }
        }

        return tx.combo.update({
          where: { id: req.params.id },
          data: {
            ...comboData,
            startDate: data.startDate ? new Date(data.startDate) : undefined,
            endDate: data.endDate ? new Date(data.endDate) : undefined,
          },
          include: {
            items: {
              include: { product: true },
            },
          },
        });
      });

      res.json({ success: true, data: combo });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/promotions/combos/:id
 * Eliminar combo
 */
router.delete(
  '/combos/:id',
  authenticate,
  authorize('settings:edit'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;

      const existing = await prisma.combo.findFirst({
        where: { id: req.params.id, tenantId },
        include: { _count: { select: { saleItems: true } } },
      });

      if (!existing) {
        throw new NotFoundError('Combo');
      }

      // Desactivar en lugar de eliminar si tiene ventas
      if (existing._count.saleItems > 0) {
        await prisma.combo.update({
          where: { id: req.params.id },
          data: { isActive: false },
        });
        return res.json({
          success: true,
          message: 'Combo desactivado (tiene ventas asociadas)',
        });
      }

      await prisma.combo.delete({
        where: { id: req.params.id },
      });

      res.json({ success: true, message: 'Combo eliminado' });
    } catch (error) {
      next(error);
    }
  }
);

// =============================================
// CÁLCULO DE PROMOCIONES
// =============================================

/**
 * POST /api/promotions/calculate
 * Calcular promociones aplicables a un carrito
 */
router.post(
  '/calculate',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { items, customerId } = req.body;

      if (!items || !Array.isArray(items)) {
        throw ApiError.badRequest('Items requeridos');
      }

      const tenantId = req.user!.tenantId;
      const now = new Date();
      const currentDay = now.getDay();
      const currentTime = now.toTimeString().slice(0, 5);

      // Obtener promociones activas
      const promotions = await prisma.promotion.findMany({
        where: {
          tenantId,
          isActive: true,
          OR: [{ startDate: null }, { startDate: { lte: now } }],
        },
        include: {
          applicableProducts: true,
        },
        orderBy: { priority: 'desc' },
      });

      // Filtrar promociones aplicables
      const applicablePromotions = promotions.filter((promo) => {
        if (promo.daysOfWeek?.length && !promo.daysOfWeek.includes(currentDay)) {
          return false;
        }
        if (promo.startTime && currentTime < promo.startTime) return false;
        if (promo.endTime && currentTime > promo.endTime) return false;
        if (promo.endDate && now > promo.endDate) return false;
        if (promo.maxUses && promo.currentUses >= promo.maxUses) return false;
        return true;
      });

      // Obtener información de productos para verificar categorías y marcas
      const productIds = items.map((item: { productId: string }) => item.productId);
      const productsInfo = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          tenantId,
        },
        select: {
          id: true,
          categoryId: true,
          brandId: true,
        },
      });

      const productMap = new Map(productsInfo.map((p) => [p.id, p]));

      // Calcular descuentos por item
      const calculatedItems = items.map(
        (item: { productId: string; quantity: number; unitPrice: number }) => {
          let bestDiscount = 0;
          let appliedPromotion = null;

          const productInfo = productMap.get(item.productId);

          for (const promo of applicablePromotions) {
            // Verificar si el producto está en la promoción
            let isApplicable = false;

            switch (promo.applyTo) {
              case 'ALL_PRODUCTS':
                isApplicable = true;
                break;
              case 'SPECIFIC_PRODUCTS':
                isApplicable = promo.applicableProducts.some(
                  (p) => p.productId === item.productId
                );
                break;
              case 'CATEGORIES':
                isApplicable =
                  !!productInfo?.categoryId &&
                  !!promo.categoryIds?.length &&
                  promo.categoryIds.includes(productInfo.categoryId);
                break;
              case 'BRANDS':
                isApplicable =
                  !!productInfo?.brandId &&
                  !!promo.brandIds?.length &&
                  promo.brandIds.includes(productInfo.brandId);
                break;
              case 'CART_TOTAL':
                // Se maneja después con el total del carrito
                isApplicable = false;
                break;
            }

            if (!isApplicable) continue;

            let discount = 0;

            switch (promo.type) {
              case 'PERCENTAGE':
                discount =
                  item.unitPrice *
                  item.quantity *
                  (Number(promo.discountValue) / 100);
                break;

              case 'FIXED_AMOUNT':
                discount = Number(promo.discountValue) * item.quantity;
                break;

              case 'BUY_X_GET_Y':
                if (promo.buyQuantity && promo.getQuantity) {
                  const sets = Math.floor(
                    item.quantity / (promo.buyQuantity + promo.getQuantity)
                  );
                  discount = sets * promo.getQuantity * item.unitPrice;
                }
                break;

              case 'SECOND_UNIT_DISCOUNT':
                if (item.quantity >= 2) {
                  const discountedUnits = Math.floor(item.quantity / 2);
                  discount =
                    discountedUnits *
                    item.unitPrice *
                    (Number(promo.discountValue) / 100);
                }
                break;
            }

            // Aplicar máximo de descuento si existe
            if (promo.maxDiscount) {
              discount = Math.min(discount, Number(promo.maxDiscount));
            }

            // Guardar mejor descuento (promociones no acumulables)
            if (discount > bestDiscount && !promo.stackable) {
              bestDiscount = discount;
              appliedPromotion = {
                id: promo.id,
                name: promo.name,
                type: promo.type,
              };
            } else if (promo.stackable) {
              bestDiscount += discount;
            }
          }

          return {
            ...item,
            discount: bestDiscount,
            promotion: appliedPromotion,
            subtotal: item.unitPrice * item.quantity - bestDiscount,
          };
        }
      );

      const totalDiscount = calculatedItems.reduce(
        (sum: number, item: { discount: number }) => sum + item.discount,
        0
      );

      res.json({
        success: true,
        data: {
          items: calculatedItems,
          totalDiscount,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
