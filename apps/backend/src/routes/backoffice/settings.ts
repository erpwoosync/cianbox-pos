import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authorize, AuthenticatedRequest } from '../../middleware/auth.js';
import { ApiError } from '../../utils/errors.js';
import prisma from '../../lib/prisma.js';

const router = Router();

// =============================================
// TENANT SETTINGS
// =============================================

// GET /settings - Obtener configuración del tenant
router.get('/settings', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        surchargeDisplayMode: true,
      },
    });

    if (!tenant) {
      throw new ApiError(404, 'Tenant not found');
    }

    res.json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    next(error);
  }
});

// Validación para actualizar settings
const updateSettingsSchema = z.object({
  surchargeDisplayMode: z.enum(['SEPARATE_ITEM', 'DISTRIBUTED']).optional(),
});

// PUT /settings - Actualizar configuración del tenant
router.put('/settings', authorize('settings.edit'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    const data = updateSettingsSchema.parse(req.body);

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        surchargeDisplayMode: data.surchargeDisplayMode,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        surchargeDisplayMode: true,
      },
    });

    res.json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
