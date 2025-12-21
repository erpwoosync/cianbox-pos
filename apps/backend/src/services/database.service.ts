/**
 * Servicio de gestión de conexiones de base de datos
 * Permite sharding multi-tenant con diferentes servidores de DB
 *
 * ARQUITECTURA:
 * - Base de datos principal (master): Almacena AgencyUsers, DatabaseServers, Tenants (metadata)
 * - Bases de datos de tenants: Almacenan los datos de cada tenant
 *
 * Por ahora, todos los tenants usan la misma DB (sharding preparado para futuro)
 */

import { PrismaClient, DatabaseServer, Tenant } from '@prisma/client';
import crypto from 'crypto';

// Instancia principal de Prisma (base de datos master)
const masterPrisma = new PrismaClient();

// Cache de conexiones por servidor
const connectionPool: Map<string, PrismaClient> = new Map();

// Clave de encriptación para passwords
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production!';
const ENCRYPTION_IV_LENGTH = 16;

/**
 * Encripta un texto (para passwords de DB)
 */
function encrypt(text: string): string {
  const iv = crypto.randomBytes(ENCRYPTION_IV_LENGTH);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Desencripta un texto
 */
function decrypt(text: string): string {
  const [ivHex, encrypted] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Construye la URL de conexión para un servidor de DB
 */
function buildConnectionUrl(server: DatabaseServer, decryptedPassword: string): string {
  const ssl = server.sslEnabled ? '?sslmode=require' : '';
  return `postgresql://${server.username}:${encodeURIComponent(decryptedPassword)}@${server.host}:${server.port}/${server.database}${ssl}`;
}

/**
 * Obtiene o crea una conexión Prisma para un servidor específico
 */
function getOrCreateConnection(server: DatabaseServer): PrismaClient {
  // Si ya existe la conexión, retornarla
  if (connectionPool.has(server.id)) {
    return connectionPool.get(server.id)!;
  }

  // Crear nueva conexión
  const decryptedPassword = decrypt(server.password);
  const connectionUrl = buildConnectionUrl(server, decryptedPassword);

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: connectionUrl,
      },
    },
  });

  connectionPool.set(server.id, prisma);
  return prisma;
}

/**
 * Servicio principal de base de datos
 */
export class DatabaseService {
  /**
   * Obtiene la instancia de Prisma para la base de datos master
   */
  static getMaster(): PrismaClient {
    return masterPrisma;
  }

  /**
   * Obtiene la instancia de Prisma para un tenant específico
   * Por ahora retorna la misma conexión (preparado para sharding futuro)
   */
  static async forTenant(tenantId: string): Promise<PrismaClient> {
    // Obtener tenant con su servidor de DB
    const tenant = await masterPrisma.tenant.findUnique({
      where: { id: tenantId },
      include: { databaseServer: true },
    });

    if (!tenant) {
      throw new Error(`Tenant ${tenantId} no encontrado`);
    }

    // Si el tenant tiene un servidor específico, usar ese
    if (tenant.databaseServer) {
      return getOrCreateConnection(tenant.databaseServer);
    }

    // Si no, usar el servidor por defecto
    const defaultServer = await masterPrisma.databaseServer.findFirst({
      where: { isDefault: true, isActive: true },
    });

    if (defaultServer) {
      return getOrCreateConnection(defaultServer);
    }

    // Fallback: usar la conexión master
    return masterPrisma;
  }

  /**
   * Obtiene la instancia de Prisma para un tenant por slug
   */
  static async forTenantBySlug(slug: string): Promise<PrismaClient> {
    const tenant = await masterPrisma.tenant.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!tenant) {
      throw new Error(`Tenant ${slug} no encontrado`);
    }

    return this.forTenant(tenant.id);
  }

  // =============================================
  // GESTIÓN DE SERVIDORES DE DB
  // =============================================

  /**
   * Lista todos los servidores de base de datos
   */
  static async listServers() {
    return masterPrisma.databaseServer.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        database: true,
        username: true,
        sslEnabled: true,
        maxConnections: true,
        isDefault: true,
        isActive: true,
        region: true,
        description: true,
        lastHealthCheck: true,
        healthStatus: true,
        createdAt: true,
        // Conteo real de tenants asignados
        _count: { select: { tenants: true } },
        // No incluir password
      },
    });
  }

  /**
   * Crea un nuevo servidor de base de datos
   */
  static async createServer(data: {
    name: string;
    host: string;
    port?: number;
    database: string;
    username: string;
    password: string;
    sslEnabled?: boolean;
    maxConnections?: number;
    isDefault?: boolean;
    region?: string;
    description?: string;
  }) {
    // Encriptar password
    const encryptedPassword = encrypt(data.password);

    // Si es default, quitar default de otros
    if (data.isDefault) {
      await masterPrisma.databaseServer.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    return masterPrisma.databaseServer.create({
      data: {
        ...data,
        password: encryptedPassword,
      },
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        database: true,
        isDefault: true,
        isActive: true,
      },
    });
  }

  /**
   * Actualiza un servidor de base de datos
   */
  static async updateServer(
    id: string,
    data: {
      name?: string;
      host?: string;
      port?: number;
      database?: string;
      username?: string;
      password?: string;
      sslEnabled?: boolean;
      maxConnections?: number;
      isDefault?: boolean;
      isActive?: boolean;
      region?: string;
      description?: string;
    }
  ) {
    const updateData: Record<string, unknown> = { ...data };

    // Encriptar password si se proporciona
    if (data.password) {
      updateData.password = encrypt(data.password);
    }

    // Si es default, quitar default de otros
    if (data.isDefault) {
      await masterPrisma.databaseServer.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    // Limpiar conexión cacheada si cambian credenciales
    if (data.host || data.port || data.username || data.password || data.database) {
      const cached = connectionPool.get(id);
      if (cached) {
        await cached.$disconnect();
        connectionPool.delete(id);
      }
    }

    return masterPrisma.databaseServer.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        host: true,
        port: true,
        database: true,
        isDefault: true,
        isActive: true,
      },
    });
  }

  /**
   * Elimina un servidor (solo si no tiene tenants)
   */
  static async deleteServer(id: string) {
    const server = await masterPrisma.databaseServer.findUnique({
      where: { id },
      include: { _count: { select: { tenants: true } } },
    });

    if (!server) {
      throw new Error('Servidor no encontrado');
    }

    if (server._count.tenants > 0) {
      throw new Error(
        `No se puede eliminar: ${server._count.tenants} tenants asignados`
      );
    }

    // Limpiar conexión cacheada
    const cached = connectionPool.get(id);
    if (cached) {
      await cached.$disconnect();
      connectionPool.delete(id);
    }

    return masterPrisma.databaseServer.delete({ where: { id } });
  }

  /**
   * Prueba la conexión a un servidor
   */
  static async testConnection(id: string): Promise<{ success: boolean; message: string; latencyMs?: number }> {
    const server = await masterPrisma.databaseServer.findUnique({
      where: { id },
    });

    if (!server) {
      return { success: false, message: 'Servidor no encontrado' };
    }

    try {
      const startTime = Date.now();
      const prisma = getOrCreateConnection(server);

      // Ejecutar query simple para probar conexión
      await prisma.$queryRaw`SELECT 1`;

      const latencyMs = Date.now() - startTime;

      // Actualizar estado de salud
      await masterPrisma.databaseServer.update({
        where: { id },
        data: {
          lastHealthCheck: new Date(),
          healthStatus: 'HEALTHY',
        },
      });

      return {
        success: true,
        message: 'Conexión exitosa',
        latencyMs,
      };
    } catch (error) {
      // Actualizar estado de salud
      await masterPrisma.databaseServer.update({
        where: { id },
        data: {
          lastHealthCheck: new Date(),
          healthStatus: 'UNHEALTHY',
        },
      });

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  /**
   * Obtiene estadísticas de un servidor
   */
  static async getServerStats(id: string) {
    const server = await masterPrisma.databaseServer.findUnique({
      where: { id },
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            plan: true,
          },
        },
      },
    });

    if (!server) {
      throw new Error('Servidor no encontrado');
    }

    return {
      server: {
        id: server.id,
        name: server.name,
        host: server.host,
        healthStatus: server.healthStatus,
        lastHealthCheck: server.lastHealthCheck,
      },
      tenantCount: server.tenants.length,
      tenants: server.tenants,
    };
  }

  // =============================================
  // ASIGNACIÓN DE TENANTS
  // =============================================

  /**
   * Asigna un tenant a un servidor de base de datos
   */
  static async assignTenantToServer(tenantId: string, serverId: string | null) {
    // Si serverId es null, usar servidor por defecto
    if (serverId) {
      const server = await masterPrisma.databaseServer.findUnique({
        where: { id: serverId },
      });

      if (!server || !server.isActive) {
        throw new Error('Servidor no disponible');
      }
    }

    return masterPrisma.tenant.update({
      where: { id: tenantId },
      data: { databaseServerId: serverId },
    });
  }

  /**
   * Migra un tenant de un servidor a otro
   * NOTA: Esto solo cambia la asignación, la migración real de datos
   * debe hacerse manualmente o con herramientas externas
   */
  static async migrateTenant(
    tenantId: string,
    targetServerId: string
  ): Promise<{ warning: string }> {
    const tenant = await masterPrisma.tenant.findUnique({
      where: { id: tenantId },
      include: { databaseServer: true },
    });

    if (!tenant) {
      throw new Error('Tenant no encontrado');
    }

    const targetServer = await masterPrisma.databaseServer.findUnique({
      where: { id: targetServerId },
    });

    if (!targetServer || !targetServer.isActive) {
      throw new Error('Servidor destino no disponible');
    }

    // Actualizar asignación
    await masterPrisma.tenant.update({
      where: { id: tenantId },
      data: { databaseServerId: targetServerId },
    });

    // Actualizar contadores
    if (tenant.databaseServerId) {
      await masterPrisma.databaseServer.update({
        where: { id: tenant.databaseServerId },
        data: { tenantCount: { decrement: 1 } },
      });
    }

    await masterPrisma.databaseServer.update({
      where: { id: targetServerId },
      data: { tenantCount: { increment: 1 } },
    });

    return {
      warning:
        'Asignación actualizada. IMPORTANTE: Los datos del tenant deben migrarse manualmente al nuevo servidor.',
    };
  }

  // =============================================
  // HEALTH CHECK
  // =============================================

  /**
   * Ejecuta health check en todos los servidores activos
   */
  static async healthCheckAll(): Promise<
    Array<{ serverId: string; name: string; healthy: boolean; latencyMs?: number }>
  > {
    const servers = await masterPrisma.databaseServer.findMany({
      where: { isActive: true },
    });

    const results = await Promise.all(
      servers.map(async (server) => {
        const result = await this.testConnection(server.id);
        return {
          serverId: server.id,
          name: server.name,
          healthy: result.success,
          latencyMs: result.latencyMs,
        };
      })
    );

    return results;
  }

  // =============================================
  // CLEANUP
  // =============================================

  /**
   * Cierra todas las conexiones (para shutdown graceful)
   */
  static async closeAll() {
    const disconnectPromises = Array.from(connectionPool.values()).map((prisma) =>
      prisma.$disconnect()
    );
    await Promise.all(disconnectPromises);
    connectionPool.clear();
    await masterPrisma.$disconnect();
  }
}

// Exportar instancia master para uso directo
export const prisma = masterPrisma;

export default DatabaseService;
