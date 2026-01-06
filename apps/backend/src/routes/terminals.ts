/**
 * Rutas de gestión de Terminales POS
 * Registro y administración de PCs con software POS instalado
 */

import { Router, Response, NextFunction } from 'express';
import { PosTerminalStatus } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';
import { authenticate, authorize, AuthenticatedRequest } from '../middleware/auth.js';
import { ApiError, NotFoundError } from '../utils/errors.js';
import prisma from '../lib/prisma.js';

const router = Router();

// ==============================================
// SCHEMAS DE VALIDACIÓN
// ==============================================

const registerTerminalSchema = z.object({
  hostname: z.string().min(1).max(100),
  macAddress: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, 'Formato MAC inválido'),
  osVersion: z.string().optional(),
  appVersion: z.string().optional(),
  ipAddress: z.string().optional(),
});

const heartbeatSchema = z.object({
  deviceId: z.string().uuid(),
});

const updateTerminalSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'DISABLED', 'BLOCKED']).optional(),
  pointOfSaleId: z.string().optional().nullable(),
});

// ==============================================
// RUTAS POS (usadas por el software desktop)
// ==============================================

/**
 * POST /identify
 * Identifica una terminal por MAC address y devuelve el tenant
 * Este endpoint es PÚBLICO (sin autenticación) para usarse antes del login
 */
router.post(
  '/identify',
  async (req, res: Response, next: NextFunction) => {
    try {
      const { macAddress } = req.body;

      if (!macAddress || typeof macAddress !== 'string') {
        throw new ApiError(400, 'MAC_REQUIRED', 'Se requiere la dirección MAC');
      }

      // Buscar terminal por MAC en cualquier tenant
      const terminal = await prisma.posTerminal.findFirst({
        where: { macAddress },
        include: {
          tenant: {
            select: {
              id: true,
              slug: true,
              name: true,
            },
          },
          pointOfSale: {
            include: {
              branch: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!terminal) {
        // Terminal no registrada
        return res.json({
          success: true,
          data: {
            registered: false,
            message: 'Terminal no registrada. Contacte al administrador.',
          },
        });
      }

      // Terminal encontrada
      res.json({
        success: true,
        data: {
          registered: true,
          status: terminal.status,
          tenant: {
            slug: terminal.tenant.slug,
            name: terminal.tenant.name,
          },
          terminal: {
            id: terminal.id,
            name: terminal.name || terminal.hostname,
            hostname: terminal.hostname,
          },
          branch: terminal.pointOfSale?.branch ? {
            id: terminal.pointOfSale.branch.id,
            name: terminal.pointOfSale.branch.name,
          } : null,
          isActive: terminal.status === 'ACTIVE',
          message: terminal.status === 'ACTIVE'
            ? null
            : terminal.status === 'PENDING'
              ? 'Terminal pendiente de activación. Contacte al administrador.'
              : `Terminal ${terminal.status.toLowerCase()}. Contacte al administrador.`,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /register
 * Registra o actualiza una terminal POS
 */
router.post(
  '/register',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      if (!tenantId) {
        throw new ApiError(403, 'TENANT_REQUIRED', 'Se requiere un tenant para registrar terminales');
      }

      const data = registerTerminalSchema.parse(req.body);

      // Buscar terminal existente por MAC
      let terminal = await prisma.posTerminal.findUnique({
        where: {
          tenantId_macAddress: {
            tenantId,
            macAddress: data.macAddress,
          },
        },
        include: {
          pointOfSale: {
            include: {
              branch: true,
              priceList: true,
            },
          },
        },
      });

      let isNewTerminal = false;

      if (terminal) {
        // Actualizar terminal existente
        terminal = await prisma.posTerminal.update({
          where: { id: terminal.id },
          data: {
            hostname: data.hostname,
            osVersion: data.osVersion,
            appVersion: data.appVersion,
            ipAddress: data.ipAddress,
            lastSeenAt: new Date(),
            lastLoginUserId: req.user!.userId,
          },
          include: {
            pointOfSale: {
              include: {
                branch: true,
                priceList: true,
              },
            },
          },
        });
      } else {
        // Crear nueva terminal
        isNewTerminal = true;
        terminal = await prisma.posTerminal.create({
          data: {
            tenantId,
            hostname: data.hostname,
            macAddress: data.macAddress,
            deviceId: crypto.randomUUID(),
            osVersion: data.osVersion,
            appVersion: data.appVersion,
            ipAddress: data.ipAddress,
            status: 'PENDING',
            lastLoginUserId: req.user!.userId,
          },
          include: {
            pointOfSale: {
              include: {
                branch: true,
                priceList: true,
              },
            },
          },
        });
      }

      // Si terminal no está activa, retornar error
      if (terminal.status !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'TERMINAL_NOT_ACTIVE',
            message: terminal.status === 'PENDING'
              ? 'Terminal pendiente de activación. Contacte al administrador.'
              : `Terminal ${terminal.status.toLowerCase()}. Contacte al administrador.`,
            status: terminal.status,
          },
          data: {
            id: terminal.id,
            deviceId: terminal.deviceId,
            hostname: terminal.hostname,
            status: terminal.status,
          },
          isNewTerminal,
        });
      }

      res.json({
        success: true,
        data: {
          id: terminal.id,
          deviceId: terminal.deviceId,
          hostname: terminal.hostname,
          macAddress: terminal.macAddress,
          name: terminal.name,
          status: terminal.status,
          pointOfSale: terminal.pointOfSale ? {
            id: terminal.pointOfSale.id,
            code: terminal.pointOfSale.code,
            name: terminal.pointOfSale.name,
            branch: {
              id: terminal.pointOfSale.branch.id,
              name: terminal.pointOfSale.branch.name,
            },
            priceList: terminal.pointOfSale.priceList ? {
              id: terminal.pointOfSale.priceList.id,
              name: terminal.pointOfSale.priceList.name,
            } : null,
          } : null,
          registeredAt: terminal.registeredAt,
          lastSeenAt: terminal.lastSeenAt,
        },
        isNewTerminal,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /heartbeat
 * Actualiza lastSeenAt de la terminal
 */
router.post(
  '/heartbeat',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      if (!tenantId) {
        throw new ApiError(403, 'TENANT_REQUIRED', 'Se requiere un tenant');
      }

      const data = heartbeatSchema.parse(req.body);

      const terminal = await prisma.posTerminal.findFirst({
        where: {
          tenantId,
          deviceId: data.deviceId,
        },
      });

      if (!terminal) {
        throw new NotFoundError('Terminal no encontrada');
      }

      await prisma.posTerminal.update({
        where: { id: terminal.id },
        data: {
          lastSeenAt: new Date(),
        },
      });

      res.json({
        success: true,
        lastSeenAt: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==============================================
// RUTAS BACKOFFICE (gestión de terminales)
// ==============================================

/**
 * GET /
 * Lista todas las terminales del tenant
 */
router.get(
  '/',
  authenticate,
  authorize('admin:terminals', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      if (!tenantId) {
        throw new ApiError(403, 'TENANT_REQUIRED', 'Se requiere un tenant');
      }

      const { status, branchId, search } = req.query;

      // Construir filtros
      const where: Record<string, unknown> = { tenantId };

      if (status && typeof status === 'string') {
        where.status = status as PosTerminalStatus;
      }

      if (branchId && typeof branchId === 'string') {
        where.pointOfSale = { branchId };
      }

      if (search && typeof search === 'string') {
        where.OR = [
          { hostname: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ];
      }

      const terminals = await prisma.posTerminal.findMany({
        where,
        include: {
          pointOfSale: {
            include: {
              branch: true,
              priceList: true,
            },
          },
          lastLoginUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { lastSeenAt: 'desc' },
      });

      // Calcular estadísticas
      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

      const stats = {
        total: terminals.length,
        active: terminals.filter(t => t.status === 'ACTIVE').length,
        pending: terminals.filter(t => t.status === 'PENDING').length,
        disabled: terminals.filter(t => t.status === 'DISABLED').length,
        blocked: terminals.filter(t => t.status === 'BLOCKED').length,
        online: terminals.filter(t => t.lastSeenAt >= tenMinutesAgo).length,
      };

      // Agregar flag isOnline a cada terminal
      const terminalsWithOnline = terminals.map(t => ({
        ...t,
        isOnline: t.lastSeenAt >= tenMinutesAgo,
      }));

      res.json({
        success: true,
        data: terminalsWithOnline,
        stats,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /:id
 * Obtiene detalle de una terminal
 */
router.get(
  '/:id',
  authenticate,
  authorize('admin:terminals', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      if (!tenantId) {
        throw new ApiError(403, 'TENANT_REQUIRED', 'Se requiere un tenant');
      }

      const { id } = req.params;

      const terminal = await prisma.posTerminal.findFirst({
        where: { id, tenantId },
        include: {
          pointOfSale: {
            include: {
              branch: true,
              priceList: true,
            },
          },
          lastLoginUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!terminal) {
        throw new NotFoundError('Terminal no encontrada');
      }

      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

      res.json({
        success: true,
        data: {
          ...terminal,
          isOnline: terminal.lastSeenAt >= tenMinutesAgo,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /:id
 * Actualiza una terminal (activar, renombrar, vincular POS)
 */
router.patch(
  '/:id',
  authenticate,
  authorize('admin:terminals', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      if (!tenantId) {
        throw new ApiError(403, 'TENANT_REQUIRED', 'Se requiere un tenant');
      }

      const { id } = req.params;
      const data = updateTerminalSchema.parse(req.body);

      // Verificar que la terminal existe
      const terminal = await prisma.posTerminal.findFirst({
        where: { id, tenantId },
      });

      if (!terminal) {
        throw new NotFoundError('Terminal no encontrada');
      }

      // Si se intenta activar, verificar que tenga POS asignado
      if (data.status === 'ACTIVE') {
        const pointOfSaleId = data.pointOfSaleId !== undefined ? data.pointOfSaleId : terminal.pointOfSaleId;
        if (!pointOfSaleId) {
          throw new ApiError(400, 'POS_REQUIRED', 'Debe asignar un Punto de Venta antes de activar la terminal');
        }
      }

      // Si se asigna un POS, verificar que pertenezca al tenant
      if (data.pointOfSaleId) {
        const pos = await prisma.pointOfSale.findFirst({
          where: { id: data.pointOfSaleId, tenantId },
        });
        if (!pos) {
          throw new ApiError(400, 'INVALID_POS', 'Punto de Venta no válido');
        }
      }

      const updated = await prisma.posTerminal.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          status: data.status as PosTerminalStatus,
          pointOfSaleId: data.pointOfSaleId,
        },
        include: {
          pointOfSale: {
            include: {
              branch: true,
              priceList: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /:id
 * Elimina una terminal
 */
router.delete(
  '/:id',
  authenticate,
  authorize('admin:terminals', '*'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenantId;
      if (!tenantId) {
        throw new ApiError(403, 'TENANT_REQUIRED', 'Se requiere un tenant');
      }

      const { id } = req.params;

      // Verificar que la terminal existe
      const terminal = await prisma.posTerminal.findFirst({
        where: { id, tenantId },
      });

      if (!terminal) {
        throw new NotFoundError('Terminal no encontrada');
      }

      await prisma.posTerminal.delete({
        where: { id },
      });

      res.json({
        success: true,
        message: 'Terminal eliminada correctamente',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
