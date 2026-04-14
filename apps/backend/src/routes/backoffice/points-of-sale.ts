import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authorize, AuthenticatedRequest } from '../../middleware/auth.js';
import { ApiError } from '../../utils/errors.js';
import prisma from '../../lib/prisma.js';

const router = Router();

// =============================================
// POINTS OF SALE (Puntos de Venta / Cajas)
// =============================================

// Listar puntos de venta
router.get('/points-of-sale', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    const pointsOfSale = await prisma.pointOfSale.findMany({
      where: { tenantId },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        priceList: { select: { id: true, name: true, currency: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: pointsOfSale,
    });
  } catch (error) {
    next(error);
  }
});

// Obtener punto de venta por ID
router.get('/points-of-sale/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    const pointOfSale = await prisma.pointOfSale.findFirst({
      where: { id, tenantId },
      include: {
        branch: { select: { id: true, name: true, code: true } },
        priceList: { select: { id: true, name: true, currency: true } },
      },
    });

    if (!pointOfSale) {
      throw new ApiError(404, 'NOT_FOUND', 'Punto de venta no encontrado');
    }

    res.json({
      success: true,
      data: pointOfSale,
    });
  } catch (error) {
    next(error);
  }
});

// Crear punto de venta
const createPointOfSaleSchema = z.object({
  branchId: z.string().min(1, 'La sucursal es requerida'),
  code: z.string().optional(), // Ahora es opcional, se autogenera si no se proporciona
  name: z.string().min(1, 'El nombre es requerido'),
  description: z.string().optional(),
  priceListId: z.string().optional(),
  isActive: z.boolean().optional().default(true),
  surchargeDisplayMode: z.enum(['SEPARATE_ITEM', 'DISTRIBUTED']).nullable().optional(),
  cianboxPointOfSaleId: z.number().int().positive().nullable().optional(),
});

// Función para generar código de POS automático
// Formato: {BRANCH_CODE}-CAJA-{NUMBER} para unicidad global en Mercado Pago
async function generatePOSCode(tenantId: string, branchId: string): Promise<string> {
  // Obtener el código de la sucursal
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, tenantId },
    select: { code: true },
  });

  const branchCode = branch?.code || 'SUC';

  // Contar cuántos POS hay en la sucursal para la numeración local
  const countInBranch = await prisma.pointOfSale.count({
    where: { tenantId, branchId },
  });

  // Generar código: {BRANCH_CODE}-CAJA-01, {BRANCH_CODE}-CAJA-02, etc.
  const nextNumber = countInBranch + 1;
  let code = `${branchCode}-CAJA-${nextNumber.toString().padStart(2, '0')}`;

  // Verificar que no exista a nivel TENANT (no solo sucursal) - importante para MP
  let attempts = 0;
  while (attempts < 100) {
    const exists = await prisma.pointOfSale.findFirst({
      where: { tenantId, code }, // Sin branchId para unicidad global
    });
    if (!exists) break;
    attempts++;
    code = `${branchCode}-CAJA-${(nextNumber + attempts).toString().padStart(2, '0')}`;
  }

  return code;
}

// Regenerar códigos de POS con formato viejo (CAJA-XX) al nuevo formato (BRANCH_CODE-CAJA-XX)
router.post(
  '/points-of-sale/regenerate-codes',
  authorize('pos:write', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;

      // Buscar todos los POS con código formato viejo (que empiecen con "CAJA-")
      const oldFormatPOS = await prisma.pointOfSale.findMany({
        where: {
          tenantId,
          code: { startsWith: 'CAJA-' },
        },
        include: {
          branch: { select: { id: true, code: true, name: true } },
        },
      });

      if (oldFormatPOS.length === 0) {
        return res.json({
          success: true,
          message: 'No hay puntos de venta con formato viejo para actualizar',
          updated: 0,
        });
      }

      const updates: { id: string; oldCode: string; newCode: string; branch: string }[] = [];

      for (const pos of oldFormatPOS) {
        const branchCode = pos.branch?.code || 'SUC';

        // Extraer el número del código viejo (CAJA-01 -> 01)
        const match = pos.code.match(/CAJA-(\d+)/);
        const number = match ? match[1] : '01';

        // Generar nuevo código
        let newCode = `${branchCode}-CAJA-${number}`;

        // Verificar que no exista ya
        let attempts = 0;
        while (attempts < 100) {
          const exists = await prisma.pointOfSale.findFirst({
            where: { tenantId, code: newCode, id: { not: pos.id } },
          });
          if (!exists) break;
          attempts++;
          const newNum = (parseInt(number) + attempts).toString().padStart(2, '0');
          newCode = `${branchCode}-CAJA-${newNum}`;
        }

        // Actualizar el POS
        await prisma.pointOfSale.update({
          where: { id: pos.id },
          data: { code: newCode },
        });

        updates.push({
          id: pos.id,
          oldCode: pos.code,
          newCode,
          branch: pos.branch?.name || 'Sin sucursal',
        });
      }

      res.json({
        success: true,
        message: `Se actualizaron ${updates.length} puntos de venta`,
        updated: updates.length,
        details: updates,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/points-of-sale',
  authorize('pos:write', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;

      const validation = createPointOfSaleSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Datos inválidos', validation.error.errors);
      }

      const { branchId, name, description, priceListId, isActive, surchargeDisplayMode, cianboxPointOfSaleId } = validation.data;
      let { code } = validation.data;

      // Verificar que la sucursal pertenece al tenant
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, tenantId },
      });

      if (!branch) {
        throw new ApiError(404, 'NOT_FOUND', 'Sucursal no encontrada');
      }

      // Autogenerar código si no se proporciona
      if (!code || code.trim() === '') {
        code = await generatePOSCode(tenantId, branchId);
      }

      // Verificar que la lista de precios pertenece al tenant (si se especifica)
      if (priceListId) {
        const priceList = await prisma.priceList.findFirst({
          where: { id: priceListId, tenantId },
        });

        if (!priceList) {
          throw new ApiError(404, 'NOT_FOUND', 'Lista de precios no encontrada');
        }
      }

      // Verificar que no exista otro POS con el mismo código en el TENANT (unicidad global para MP)
      const existing = await prisma.pointOfSale.findFirst({
        where: { tenantId, code }, // Sin branchId para unicidad global
      });

      if (existing) {
        throw new ApiError(409, 'CONFLICT', 'Ya existe un punto de venta con ese código');
      }

      const pointOfSale = await prisma.pointOfSale.create({
        data: {
          tenantId,
          branchId,
          code,
          name,
          description,
          priceListId,
          isActive,
          surchargeDisplayMode,
          cianboxPointOfSaleId,
        },
        include: {
          branch: { select: { id: true, name: true, code: true } },
          priceList: { select: { id: true, name: true, currency: true } },
        },
      });

      res.status(201).json({
        success: true,
        data: pointOfSale,
        message: 'Punto de venta creado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Actualizar punto de venta
const updatePointOfSaleSchema = z.object({
  branchId: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  priceListId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  mpDeviceId: z.string().nullable().optional(),
  mpDeviceName: z.string().nullable().optional(),
  surchargeDisplayMode: z.enum(['SEPARATE_ITEM', 'DISTRIBUTED']).nullable().optional(),
  cianboxPointOfSaleId: z.number().int().positive().nullable().optional(),
});

router.put(
  '/points-of-sale/:id',
  authorize('pos:write', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const { id } = req.params;

      const validation = updatePointOfSaleSchema.safeParse(req.body);
      if (!validation.success) {
        throw new ApiError(422, 'VALIDATION_ERROR', 'Datos inválidos', validation.error.errors);
      }

      // Verificar que el punto de venta existe y pertenece al tenant
      const existing = await prisma.pointOfSale.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        throw new ApiError(404, 'NOT_FOUND', 'Punto de venta no encontrado');
      }

      const { branchId, code, name, description, priceListId, isActive, mpDeviceId, mpDeviceName, surchargeDisplayMode, cianboxPointOfSaleId } = validation.data;

      // Verificar sucursal si se cambia
      if (branchId && branchId !== existing.branchId) {
        const branch = await prisma.branch.findFirst({
          where: { id: branchId, tenantId },
        });

        if (!branch) {
          throw new ApiError(404, 'NOT_FOUND', 'Sucursal no encontrada');
        }
      }

      // Verificar lista de precios si se cambia
      if (priceListId && priceListId !== existing.priceListId) {
        const priceList = await prisma.priceList.findFirst({
          where: { id: priceListId, tenantId },
        });

        if (!priceList) {
          throw new ApiError(404, 'NOT_FOUND', 'Lista de precios no encontrada');
        }
      }

      // Verificar código único en la sucursal
      const targetBranchId = branchId || existing.branchId;
      const targetCode = code || existing.code;

      if (code !== existing.code || branchId !== existing.branchId) {
        const duplicate = await prisma.pointOfSale.findFirst({
          where: {
            tenantId,
            branchId: targetBranchId,
            code: targetCode,
            id: { not: id },
          },
        });

        if (duplicate) {
          throw new ApiError(409, 'CONFLICT', 'Ya existe un punto de venta con ese código en la sucursal');
        }
      }

      const pointOfSale = await prisma.pointOfSale.update({
        where: { id },
        data: {
          ...(branchId && { branchId }),
          ...(code && { code }),
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(priceListId !== undefined && { priceListId }),
          ...(isActive !== undefined && { isActive }),
          ...(mpDeviceId !== undefined && { mpDeviceId }),
          ...(mpDeviceName !== undefined && { mpDeviceName }),
          ...(surchargeDisplayMode !== undefined && { surchargeDisplayMode }),
          ...(cianboxPointOfSaleId !== undefined && { cianboxPointOfSaleId }),
        },
        include: {
          branch: { select: { id: true, name: true, code: true } },
          priceList: { select: { id: true, name: true, currency: true } },
        },
      });

      res.json({
        success: true,
        data: pointOfSale,
        message: 'Punto de venta actualizado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Eliminar punto de venta
router.delete(
  '/points-of-sale/:id',
  authorize('pos:delete', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      const { id } = req.params;

      // Verificar que el punto de venta existe y pertenece al tenant
      const existing = await prisma.pointOfSale.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        throw new ApiError(404, 'NOT_FOUND', 'Punto de venta no encontrado');
      }

      // Verificar que no tenga ventas asociadas
      const salesCount = await prisma.sale.count({
        where: { pointOfSaleId: id },
      });

      if (salesCount > 0) {
        throw new ApiError(400, 'BAD_REQUEST', `No se puede eliminar: el punto de venta tiene ${salesCount} ventas asociadas`);
      }

      await prisma.pointOfSale.delete({
        where: { id },
      });

      res.json({
        success: true,
        message: 'Punto de venta eliminado exitosamente',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
