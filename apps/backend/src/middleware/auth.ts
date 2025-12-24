/**
 * Middleware de autenticación JWT y autorización
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticationError, AuthorizationError } from '../utils/errors.js';

// Tipos
export interface JWTPayload {
  userId: string;
  tenantId: string;
  email: string;
  roleId: string;
  permissions: string[];
  branchId?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

// Obtener secret de JWT
const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET no está configurado');
  }
  return secret;
};

/**
 * Middleware de autenticación
 * Verifica el token JWT y agrega el usuario al request
 */
export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    let token: string | undefined;

    // Primero intentar obtener del header Authorization
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    // Si no hay token en header, intentar desde query parameter (para URLs de impresión)
    if (!token && req.query.token) {
      token = req.query.token as string;
    }

    if (!token) {
      throw new AuthenticationError('Token no proporcionado');
    }

    try {
      const decoded = jwt.verify(token, getJwtSecret()) as JWTPayload;
      req.user = decoded;
      next();
    } catch (jwtError) {
      if (jwtError instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Token expirado');
      }
      if (jwtError instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Token inválido');
      }
      throw jwtError;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware de autorización por permisos
 * Verifica que el usuario tenga los permisos necesarios
 */
export const authorize = (...requiredPermissions: string[]) => {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Usuario no autenticado');
      }

      const userPermissions = req.user.permissions || [];

      // Verificar si tiene alguno de los permisos requeridos
      const hasPermission = requiredPermissions.some(
        (permission) =>
          userPermissions.includes(permission) ||
          userPermissions.includes('*') // Super admin
      );

      if (!hasPermission) {
        throw new AuthorizationError(
          `Requiere permiso: ${requiredPermissions.join(' o ')}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware para verificar que el tenantId coincida
 * Evita acceso cross-tenant
 */
export const validateTenant = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (!req.user) {
      throw new AuthenticationError('Usuario no autenticado');
    }

    // Si hay un tenantId en params o body, debe coincidir
    const paramTenantId = req.params.tenantId;
    const bodyTenantId = req.body?.tenantId;

    if (paramTenantId && paramTenantId !== req.user.tenantId) {
      throw new AuthorizationError('No tiene acceso a este tenant');
    }

    if (bodyTenantId && bodyTenantId !== req.user.tenantId) {
      throw new AuthorizationError('No tiene acceso a este tenant');
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Genera un token JWT
 */
export const generateToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(payload, getJwtSecret(), { expiresIn } as jwt.SignOptions);
};

/**
 * Genera un refresh token
 */
export const generateRefreshToken = (payload: Omit<JWTPayload, 'iat' | 'exp'>): string => {
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
  return jwt.sign(payload, getJwtSecret(), { expiresIn } as jwt.SignOptions);
};

/**
 * Verifica un token sin lanzar errores
 */
export const verifyToken = (token: string): JWTPayload | null => {
  try {
    return jwt.verify(token, getJwtSecret()) as JWTPayload;
  } catch {
    return null;
  }
};

/**
 * Middleware opcional de autenticación
 * No lanza error si no hay token, pero si hay uno inválido sí
 */
export const optionalAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return next();
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return next();
    }

    const token = parts[1];

    try {
      const decoded = jwt.verify(token, getJwtSecret()) as JWTPayload;
      req.user = decoded;
    } catch {
      // Ignorar errores de token en auth opcional
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Exportar tipos
export type { Request, Response, NextFunction };
