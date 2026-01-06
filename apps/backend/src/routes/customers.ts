/**
 * Rutas de clientes
 * Refactorizado para usar CustomerRepository
 */

import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { customerRepository } from '../repositories/index.js';
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
      const tenantId = req.user!.tenantId;

      const result = await customerRepository.findWithFilters(
        tenantId,
        {
          search: query.search,
          customerType: query.customerType,
          isActive: query.isActive !== undefined ? query.isActive === 'true' : undefined,
        },
        {
          page: parseInt(query.page),
          pageSize: parseInt(query.pageSize),
        }
      );

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
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

      // Búsqueda rápida usando prisma directamente (no necesita paginación)
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
      const customer = await customerRepository.findByIdOrFail(
        req.params.id,
        req.user!.tenantId
      );

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

      const customer = await customerRepository.createWithValidation(
        req.user!.tenantId,
        { ...data, email: data.email || null }
      );

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

      const customer = await customerRepository.updateWithValidation(
        req.params.id,
        req.user!.tenantId,
        { ...data, email: data.email || null }
      );

      res.json({ success: true, data: customer });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/customers/:id
 * Eliminar cliente (soft delete si tiene ventas)
 */
router.delete(
  '/:id',
  authenticate,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const result = await customerRepository.deleteOrDeactivate(
        req.params.id,
        req.user!.tenantId
      );

      res.json({ success: true, message: result.message });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
