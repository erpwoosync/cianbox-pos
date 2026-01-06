/**
 * Singleton de PrismaClient
 *
 * Este archivo garantiza que solo exista una instancia de PrismaClient
 * en toda la aplicación, evitando problemas de conexión a la base de datos.
 *
 * Uso:
 *   import prisma from '../lib/prisma.js';
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['error', 'warn']
      : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
