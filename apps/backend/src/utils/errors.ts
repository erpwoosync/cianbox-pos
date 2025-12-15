/**
 * Errores personalizados para la API
 */

export class ApiError extends Error {
  public statusCode: number;
  public code: string;
  public details?: unknown;

  constructor(
    statusCode: number,
    message: string,
    code: string = 'API_ERROR',
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'ApiError';
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, code: string = 'BAD_REQUEST', details?: unknown) {
    return new ApiError(400, message, code, details);
  }

  static unauthorized(message: string = 'No autorizado', code: string = 'UNAUTHORIZED') {
    return new ApiError(401, message, code);
  }

  static forbidden(message: string = 'Acceso denegado', code: string = 'FORBIDDEN') {
    return new ApiError(403, message, code);
  }

  static notFound(message: string = 'Recurso no encontrado', code: string = 'NOT_FOUND') {
    return new ApiError(404, message, code);
  }

  static conflict(message: string, code: string = 'CONFLICT', details?: unknown) {
    return new ApiError(409, message, code, details);
  }

  static unprocessable(message: string, code: string = 'UNPROCESSABLE', details?: unknown) {
    return new ApiError(422, message, code, details);
  }

  static internal(message: string = 'Error interno del servidor', code: string = 'INTERNAL_ERROR') {
    return new ApiError(500, message, code);
  }

  static serviceUnavailable(message: string = 'Servicio no disponible', code: string = 'SERVICE_UNAVAILABLE') {
    return new ApiError(503, message, code);
  }

  toJSON() {
    const error: { code: string; message: string; details?: unknown } = {
      code: this.code,
      message: this.message,
    };
    if (this.details) {
      error.details = this.details;
    }
    return { error };
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(422, message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Credenciales inválidas') {
    super(401, message, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends ApiError {
  constructor(message: string = 'No tiene permisos para esta acción') {
    super(403, message, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string = 'Recurso') {
    super(404, `${resource} no encontrado`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class CianboxError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(502, message, 'CIANBOX_ERROR', details);
    this.name = 'CianboxError';
  }
}
