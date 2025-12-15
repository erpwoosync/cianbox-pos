import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuthRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
    email: string;
    name: string;
    isSuperAdmin: boolean;
    isAgencyUser: boolean;
    agencyUserId?: string;
    role: {
      id: string;
      name: string;
      permissions: string[];
    };
  };
}

interface TokenPayload {
  userId?: string;
  agencyUserId?: string;
  tenantId: string;
  isAgencyUser?: boolean;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;

    // Si es un AgencyUser (superadmin a nivel agencia)
    if (decoded.isAgencyUser && decoded.agencyUserId) {
      const agencyUser = await prisma.agencyUser.findUnique({
        where: { id: decoded.agencyUserId },
      });

      if (!agencyUser || agencyUser.status !== 'ACTIVE') {
        return res.status(401).json({ error: 'Usuario de agencia no válido o inactivo' });
      }

      req.user = {
        id: agencyUser.id,
        tenantId: decoded.tenantId,
        email: agencyUser.email,
        name: agencyUser.name,
        isSuperAdmin: true,
        isAgencyUser: true,
        agencyUserId: agencyUser.id,
        role: {
          id: 'agency-admin',
          name: 'Super Admin',
          permissions: ['*'],
        },
      };

      return next();
    }

    // Usuario de tenant normal
    if (!decoded.userId) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { role: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'Usuario no válido o inactivo' });
    }

    req.user = {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      isSuperAdmin: false,
      isAgencyUser: false,
      role: {
        id: user.role.id,
        name: user.role.name,
        permissions: user.role.permissions,
      },
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Token inválido' });
    }
    next(error);
  }
};

export const requirePermission = (...permissions: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const userPermissions = req.user.role.permissions;

    // Admin y AgencyUser tienen todos los permisos
    if (userPermissions.includes('*') || req.user.isAgencyUser) {
      return next();
    }

    const hasPermission = permissions.some(p => userPermissions.includes(p));
    if (!hasPermission) {
      return res.status(403).json({ error: 'Permisos insuficientes' });
    }

    next();
  };
};

// Middleware específico para verificar que es AgencyUser (superadmin de agencia)
export const requireAgencyUser = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  if (!req.user.isAgencyUser) {
    return res.status(403).json({ error: 'Solo usuarios de agencia pueden acceder a este recurso' });
  }

  next();
};
