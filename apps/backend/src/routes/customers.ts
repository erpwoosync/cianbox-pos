/**
 * Rutas de clientes
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { NotFoundError, ApiError } from '../utils/errors.js';
import prisma from '../lib/prisma.js';

const router = Router();

// Schemas de validación
const customerQuerySchema = z.object({
  search: z.string().optional(),
  customerType: z.enum(['CONSUMER', 'INDIVIDUAL', 'BUSINESS', 'GOVERNMENT']).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  page: z.string().default('1'),
  pageSize: z.string().default('50'),
});

const customerCreateSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  customerType: z.enum(['CONSUMER', 'INDIVIDUAL', 'BUSINESS', 'GOVERNMENT']).default('CONSUMER'),
  taxId: z.string().optional(),
  taxIdType: z.enum(['DNI', 'CUIT', 'CUIL', 'PASSPORT', 'OTHER']).optional(),
  taxCategory: z.string().optional(),
  tradeName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().default('AR'),
  notes: z.string().optional(),
  globalDiscount: z.number().min(0).max(100).default(0),
});

const customerUpdateSchema = customerCreateSchema.partial();

// =============================================
// RUTAS DE CLIENTES
// =============================================

/**
 * GET /api/customers
 * Listar clientes
 */
router.get(
  '/',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const query = customerQuerySchema.parse(req.query);
      const page = parseInt(query.page);
      const pageSize = parseInt(query.pageSize);
      const skip = (page - 1) * pageSize;

      const where: Record<string, unknown> = {
        tenantId: req.user!.tenantId,
      };

      if (query.search) {
        where.OR = [
          { name: { contains: query.search, mode: 'insensitive' } },
          { taxId: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
          { phone: { contains: query.search } },
          { mobile: { contains: query.search } },
        ];
      }

      if (query.customerType) {
        where.customerType = query.customerType;
      }

      if (query.isActive !== undefined) {
        where.isActive = query.isActive === 'true';
      }

      const [customers, total] = await Promise.all([
        prisma.customer.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            tradeName: true,
            customerType: true,
            taxId: true,
            taxIdType: true,
            email: true,
            phone: true,
            mobile: true,
            address: true,
            city: true,
            globalDiscount: true,
            isActive: true,
            createdAt: true,
          },
        }),
        prisma.customer.count({ where }),
      ]);

      res.json({
        success: true,
        data: customers,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/customers/search
 * Buscar clientes (optimizado para el POS)
 */
router.get(
  '/search',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const q = (req.query.q as string) || '';

      if (q.length < 2) {
        return res.json({ success: true, data: [] });
      }

      const customers = await prisma.customer.findMany({
        where: {
          tenantId: req.user!.tenantId,
          isActive: true,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { taxId: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
            { mobile: { contains: q } },
          ],
        },
        take: 20,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          customerType: true,
          taxId: true,
          taxIdType: true,
          email: true,
          phone: true,
          mobile: true,
          address: true,
          globalDiscount: true,
        },
      });

      res.json({ success: true, data: customers });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/customers/:id
 * Obtener cliente por ID
 */
router.get(
  '/:id',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const customer = await prisma.customer.findFirst({
        where: {
          id: req.params.id,
          tenantId: req.user!.tenantId,
        },
      });

      if (!customer) {
        throw new NotFoundError('Cliente');
      }

      res.json({ success: true, data: customer });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/customers
 * Crear cliente
 */
router.post(
  '/',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = customerCreateSchema.parse(req.body);

      // Verificar duplicado por taxId si se proporciona
      if (data.taxId) {
        const existing = await prisma.customer.findFirst({
          where: {
            tenantId: req.user!.tenantId,
            taxId: data.taxId,
          },
        });

        if (existing) {
          throw ApiError.badRequest(`Ya existe un cliente con el documento ${data.taxId}`);
        }
      }

      const customer = await prisma.customer.create({
        data: {
          ...data,
          email: data.email || null,
          tenantId: req.user!.tenantId,
        },
      });

      res.status(201).json({ success: true, data: customer });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/customers/:id
 * Actualizar cliente
 */
router.put(
  '/:id',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = customerUpdateSchema.parse(req.body);

      // Verificar que el cliente existe y pertenece al tenant
      const existing = await prisma.customer.findFirst({
        where: {
          id: req.params.id,
          tenantId: req.user!.tenantId,
        },
      });

      if (!existing) {
        throw new NotFoundError('Cliente');
      }

      // Verificar duplicado por taxId si se está actualizando
      if (data.taxId && data.taxId !== existing.taxId) {
        const duplicate = await prisma.customer.findFirst({
          where: {
            tenantId: req.user!.tenantId,
            taxId: data.taxId,
            id: { not: req.params.id },
          },
        });

        if (duplicate) {
          throw ApiError.badRequest(`Ya existe un cliente con el documento ${data.taxId}`);
        }
      }

      const customer = await prisma.customer.update({
        where: { id: req.params.id },
        data: {
          ...data,
          email: data.email || null,
        },
      });

      res.json({ success: true, data: customer });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/customers/:id
 * Eliminar cliente (soft delete - desactivar)
 */
router.delete(
  '/:id',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Verificar que el cliente existe y pertenece al tenant
      const existing = await prisma.customer.findFirst({
        where: {
          id: req.params.id,
          tenantId: req.user!.tenantId,
        },
      });

      if (!existing) {
        throw new NotFoundError('Cliente');
      }

      // Verificar si tiene ventas asociadas
      const salesCount = await prisma.sale.count({
        where: { customerId: req.params.id },
      });

      if (salesCount > 0) {
        // Soft delete si tiene ventas
        await prisma.customer.update({
          where: { id: req.params.id },
          data: { isActive: false },
        });

        return res.json({
          success: true,
          message: 'Cliente desactivado (tiene ventas asociadas)',
        });
      }

      // Hard delete si no tiene ventas
      await prisma.customer.delete({
        where: { id: req.params.id },
      });

      res.json({ success: true, message: 'Cliente eliminado' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
