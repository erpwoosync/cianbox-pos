/**
 * Rutas del Client Backoffice
 * API para gestión de catálogo por tenant (categorías, marcas, productos, precios, stock)
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';

import dashboardRouter from './dashboard.js';
import categoriesRouter from './categories.js';
import productsRouter from './products.js';
import customersRouter from './customers.js';
import pointsOfSaleRouter from './points-of-sale.js';
import rolesRouter from './roles.js';
import usersRouter from './users.js';
import salesRouter from './sales.js';
import cashRouter from './cash.js';
import mpOrphanOrdersRouter from './mp-orphan-orders.js';
import settingsRouter from './settings.js';

const router = Router();

// Middleware: autenticación requerida para todas las rutas
router.use(authenticate);

// Montar sub-routers
router.use(dashboardRouter);
router.use(categoriesRouter);
router.use(productsRouter);
router.use(customersRouter);
router.use(pointsOfSaleRouter);
router.use(rolesRouter);
router.use(usersRouter);
router.use(salesRouter);
router.use(cashRouter);
router.use(mpOrphanOrdersRouter);
router.use(settingsRouter);

export default router;
