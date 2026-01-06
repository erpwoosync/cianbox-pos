# Guia Tecnica: Desarrollo de POS con Integracion Cianbox

**Version:** 2.0.0
**Fecha:** 2026-01-06
**Proposito:** Documentacion tecnica para el desarrollo de una aplicacion POS (Point of Sale) con integracion a Cianbox ERP.

---

## Tabla de Contenidos

1. [Stack Tecnologico](#1-stack-tecnologico)
2. [Arquitectura Multi-tenant](#2-arquitectura-multi-tenant)
3. [Integracion con Cianbox ERP](#3-integracion-con-cianbox-erp)
4. [Modelo de Datos](#4-modelo-de-datos)
5. [Codigo Reutilizable](#5-codigo-reutilizable)
6. [Guia de Arquitectura para POS](#6-guia-de-arquitectura-para-pos)
7. [API Reference de Cianbox](#7-api-reference-de-cianbox)

---

## 1. Stack Tecnologico

### 1.1 Backend

| Tecnologia | Version | Proposito |
|------------|---------|-----------|
| **Node.js** | 18+ | Runtime de JavaScript |
| **Express** | 4.x | Framework web |
| **Prisma** | 5.x | ORM para PostgreSQL |
| **PostgreSQL** | 15+ | Base de datos relacional |
| **JWT** | jsonwebtoken | Autenticacion stateless |
| **Zod** | 3.x | Validacion de esquemas |
| **Socket.io** | 4.x | Comunicacion en tiempo real |
| **bcryptjs** | - | Hashing de passwords |

### 1.2 Frontend

| Tecnologia | Version | Proposito |
|------------|---------|-----------|
| **React** | 18.x | Libreria de UI |
| **Vite** | 5.x | Build tool y dev server |
| **TailwindCSS** | 3.x | Framework CSS utility-first |
| **React Router** | 6.x | Enrutamiento SPA |
| **Axios/Fetch** | - | Cliente HTTP |

### 1.3 Herramientas de Desarrollo

```bash
# Dependencias backend recomendadas
npm install express prisma @prisma/client jsonwebtoken bcryptjs zod cors dotenv
npm install -D typescript @types/node @types/express @types/jsonwebtoken @types/bcryptjs

# Dependencias frontend recomendadas
npm create vite@latest pos-frontend -- --template react-ts
cd pos-frontend
npm install react-router-dom axios tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 1.4 Estructura de Proyecto Recomendada

```
pos-cianbox/
  apps/
    backend/
      src/
        index.ts              # Entry point
        middleware/
          auth.ts             # Autenticacion JWT
        routes/
          auth.ts             # Login, logout, /me
          cianbox.ts          # Integracion Cianbox
          products.ts         # CRUD productos
          sales.ts            # Ventas POS
          promotions.ts       # Promociones
        services/
          cianbox.service.ts  # Logica de Cianbox
        utils/
          errors.ts           # Manejo de errores
      prisma/
        schema.prisma         # Modelo de datos
      package.json
      tsconfig.json
    frontend/
      src/
        pages/
        components/
        services/
          api.ts              # Cliente HTTP
        hooks/
        context/
      package.json
      vite.config.ts
```

---

## 2. Arquitectura Multi-tenant

### 2.1 Concepto

El sistema multi-tenant permite que multiples clientes (tenants) usen la misma instancia de la aplicacion, con datos completamente aislados.

### 2.2 Modelo de Aislamiento por Tenant

**Estrategia:** Aislamiento a nivel de fila (Row-Level Security via codigo)

Cada tabla relevante incluye un campo `tenantId` que actua como filtro obligatorio en todas las queries.

### 2.3 Middleware de Autenticacion

```typescript
// apps/backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Interfaz extendida de Request con datos del usuario autenticado
 * Extended Request interface with authenticated user data
 */
export interface AuthRequest extends Request {
  user?: {
    id: string;
    tenantId: string;        // IMPORTANTE: tenantId siempre presente
    email: string;
    name: string;
    isSuperAdmin: boolean;   // true si es admin de agencia
    isAgencyUser: boolean;   // true si es usuario de agencia (puede ver todos los tenants)
    agencyUserId?: string;
    role: {
      id: string;
      name: string;
      permissions: string[];  // Array de permisos: ['*'] = todos
    };
  };
}

/**
 * Payload del token JWT
 */
interface TokenPayload {
  userId?: string;           // ID del usuario de tenant
  agencyUserId?: string;     // ID del usuario de agencia (superadmin)
  tenantId: string;          // Tenant actual (obligatorio)
  isAgencyUser?: boolean;    // Flag para usuarios de agencia
}

/**
 * Middleware de autenticacion
 * Verifica el token JWT y carga los datos del usuario
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // 1. Extraer token del header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const token = authHeader.split(' ')[1];

    // 2. Verificar y decodificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as TokenPayload;

    // 3. Si es AgencyUser (superadmin a nivel agencia)
    if (decoded.isAgencyUser && decoded.agencyUserId) {
      const agencyUser = await prisma.agencyUser.findUnique({
        where: { id: decoded.agencyUserId },
      });

      if (!agencyUser || agencyUser.status !== 'ACTIVE') {
        return res.status(401).json({ error: 'Usuario de agencia no valido o inactivo' });
      }

      // AgencyUser tiene todos los permisos
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
          permissions: ['*'],  // Todos los permisos
        },
      };

      return next();
    }

    // 4. Usuario de tenant normal
    if (!decoded.userId) {
      return res.status(401).json({ error: 'Token invalido' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { role: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'Usuario no valido o inactivo' });
    }

    req.user = {
      id: user.id,
      tenantId: user.tenantId,  // IMPORTANTE: siempre del usuario, no del token
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
      return res.status(401).json({ error: 'Token invalido' });
    }
    next(error);
  }
};

/**
 * Middleware para verificar permisos especificos
 * @param permissions - Lista de permisos requeridos (OR)
 */
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

    // Verificar si tiene al menos uno de los permisos requeridos
    const hasPermission = permissions.some(p => userPermissions.includes(p));
    if (!hasPermission) {
      return res.status(403).json({ error: 'Permisos insuficientes' });
    }

    next();
  };
};

/**
 * Middleware para rutas solo de AgencyUser
 */
export const requireAgencyUser = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  if (!req.user.isAgencyUser) {
    return res.status(403).json({ error: 'Solo usuarios de agencia pueden acceder a este recurso' });
  }

  next();
};
```

### 2.4 Uso del tenantId en Queries

**REGLA CRITICA:** TODA query a la base de datos DEBE filtrar por `tenantId`.

```typescript
// CORRECTO - Siempre filtrar por tenantId
const products = await prisma.product.findMany({
  where: {
    tenantId: req.user!.tenantId,  // OBLIGATORIO
    isActive: true,
  },
});

// INCORRECTO - Nunca hacer queries sin tenantId
const products = await prisma.product.findMany({
  where: {
    isActive: true,
  },
});
```

### 2.5 Estructura del Token JWT

```typescript
// Token para usuario de tenant
{
  userId: "clxxxxxx",     // ID del usuario
  tenantId: "clyyyyyyy",  // ID del tenant
}

// Token para AgencyUser (superadmin)
{
  agencyUserId: "clzzzzzz",
  tenantId: "clyyyyyyy",  // Tenant actual seleccionado
  isAgencyUser: true,
}
```

---

## 3. Integracion con Cianbox ERP

### 3.1 Vision General

Cianbox es un ERP que expone una API REST v2. La integracion permite:
- Sincronizar productos, categorias y marcas
- Obtener estados de pedidos
- Sincronizar pedidos
- Integrar ventas de MercadoLibre

### 3.2 Autenticacion con Cianbox

**Base URL:** `https://cianbox.org/{cuenta}/api/v2`

**Flujo de autenticacion:**

```
1. POST /auth/credentials
   - Enviar: app_name, app_code, user, password
   - Recibir: access_token, expires_in (segundos)

2. Usar token en todas las requests como query param:
   GET /productos/lista?access_token=xxxxx
```

### 3.3 Servicio de Cianbox Completo

```typescript
// apps/backend/src/services/cianbox.service.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================
// TIPOS DE DATOS / DATA TYPES
// ============================================

/**
 * Respuesta de autenticacion de Cianbox
 */
interface CianboxTokenResponse {
  status: string;           // 'ok' si exitoso
  body: {
    access_token: string;
    refresh_token?: string;
    expires_in: number;     // Segundos hasta expiracion
  };
  message?: string;         // Mensaje de error si falla
}

/**
 * Respuesta generica de la API de Cianbox
 */
interface CianboxApiResponse {
  status: string;           // 'ok' si exitoso
  body: any;                // Datos de la respuesta
  message?: string;         // Mensaje de error si falla
  page?: string;            // Pagina actual (string)
  total_pages?: number;     // Total de paginas
}

/**
 * Producto de Cianbox
 */
interface CianboxProduct {
  id: number;
  codigo: string;
  codigo_interno?: string;  // SKU real
  producto: string;         // Nombre
  descripcion?: string;
  codigo_barras?: string;
  ubicacion?: string;
  stock?: number;
  precio?: number;
  id_categoria?: number;
  categoria?: string;
  id_marca?: number;
  marca?: string;
  imagen?: string;
  vigente?: boolean;
}

/**
 * Categoria de Cianbox
 */
interface CianboxCategory {
  id: number;
  categoria: string;
  padre?: number;           // ID de categoria padre (0 = root)
}

/**
 * Marca de Cianbox
 */
interface CianboxBrand {
  id: number;
  marca: string;
}

// ============================================
// CACHE DE TOKENS
// ============================================

/**
 * Cache en memoria de tokens por tenant
 * Evita re-autenticar en cada request
 */
const tokenCache = new Map<string, { token: string; expiresAt: Date }>();

// ============================================
// FUNCIONES PRINCIPALES
// ============================================

/**
 * Obtiene un access_token valido para Cianbox
 * Usa cache para evitar autenticaciones innecesarias
 *
 * @param tenantId - ID del tenant
 * @returns Access token valido
 */
export async function getAccessToken(tenantId: string): Promise<string> {
  // 1. Verificar cache primero
  const cached = tokenCache.get(tenantId);
  if (cached && new Date() < cached.expiresAt) {
    return cached.token;
  }

  // 2. Obtener credenciales del tenant desde la BD
  const connection = await prisma.cianboxConnection.findUnique({
    where: { tenantId },
  });

  if (!connection) {
    throw new Error('No hay conexion Cianbox configurada para este tenant');
  }

  if (!connection.isActive) {
    throw new Error('La conexion Cianbox esta desactivada');
  }

  // 3. Construir URL base
  const baseUrl = `https://cianbox.org/${connection.cuenta}/api/v2`;

  // 4. Solicitar access token
  const response = await fetch(`${baseUrl}/auth/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_name: connection.appName,
      app_code: connection.appCode,
      user: connection.user,
      password: connection.password,
    }),
  });

  const data = (await response.json()) as CianboxTokenResponse;

  if (data.status !== 'ok' || !data.body?.access_token) {
    throw new Error(`Error de autenticacion Cianbox: ${data.message || 'Respuesta invalida'}`);
  }

  // 5. Guardar en cache con margen de seguridad de 5 minutos
  const expiresAt = new Date(Date.now() + (data.body.expires_in - 300) * 1000);
  tokenCache.set(tenantId, {
    token: data.body.access_token,
    expiresAt,
  });

  return data.body.access_token;
}

/**
 * Prueba la conexion con Cianbox
 * Util para validar credenciales
 */
export async function testCianboxConnection(tenantId: string): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    const token = await getAccessToken(tenantId);
    // Intentar obtener estados como prueba
    const statuses = await fetchCianboxOrderStatuses(tenantId);

    return {
      success: true,
      message: 'Conexion exitosa',
      details: {
        tokenObtained: !!token,
        orderStatusesCount: statuses.length,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message,
    };
  }
}

// ============================================
// ESTADOS DE PEDIDOS
// ============================================

/**
 * Obtiene los estados de pedidos de Cianbox
 * Endpoint: GET /pedidos/estados
 */
export async function fetchCianboxOrderStatuses(tenantId: string): Promise<any[]> {
  const connection = await prisma.cianboxConnection.findUnique({
    where: { tenantId },
  });

  if (!connection) {
    throw new Error('No hay conexion Cianbox configurada');
  }

  const token = await getAccessToken(tenantId);
  const baseUrl = `https://cianbox.org/${connection.cuenta}/api/v2`;

  const response = await fetch(`${baseUrl}/pedidos/estados?access_token=${token}`);
  const data = (await response.json()) as CianboxApiResponse;

  if (data.status !== 'ok') {
    throw new Error(`Error al obtener estados: ${data.message}`);
  }

  return data.body || [];
}

// ============================================
// CATEGORIAS
// ============================================

/**
 * Obtiene categorias de Cianbox con paginacion automatica
 * Endpoint: GET /productos/categorias
 */
export async function fetchCianboxCategories(tenantId: string): Promise<CianboxCategory[]> {
  const connection = await prisma.cianboxConnection.findUnique({
    where: { tenantId },
  });

  if (!connection) {
    throw new Error('No hay conexion Cianbox configurada');
  }

  const token = await getAccessToken(tenantId);
  const baseUrl = `https://cianbox.org/${connection.cuenta}/api/v2`;

  let allCategories: CianboxCategory[] = [];
  let currentPage = 1;
  let hasMoreData = true;

  // Paginar hasta obtener todas las categorias
  while (hasMoreData) {
    const params = new URLSearchParams({
      access_token: token,
      page: currentPage.toString(),
      limit: '100',
    });

    const response = await fetch(`${baseUrl}/productos/categorias?${params.toString()}`);
    const data = (await response.json()) as CianboxApiResponse;

    if (data.status !== 'ok') {
      throw new Error(`Error al obtener categorias: ${data.message}`);
    }

    const pageCategories: CianboxCategory[] = data.body || [];
    if (pageCategories.length === 0) {
      hasMoreData = false;
    } else {
      allCategories = allCategories.concat(pageCategories);
      currentPage++;
      if (pageCategories.length < 100) {
        hasMoreData = false;
      }
    }
  }

  console.log(`[Cianbox Categories] Fetched ${allCategories.length} categories`);
  return allCategories;
}

/**
 * Sincroniza categorias de Cianbox a la BD local
 * Maneja jerarquias (categorias padre-hijo)
 */
export async function syncCategoriesFromCianbox(
  tenantId: string
): Promise<{
  imported: number;
  updated: number;
  errors: string[];
}> {
  const result = { imported: 0, updated: 0, errors: [] as string[] };

  try {
    const cianboxCategories = await fetchCianboxCategories(tenantId);

    if (cianboxCategories.length === 0) {
      return result;
    }

    // Primer paso: Crear/actualizar categorias sin relacion padre
    const cianboxIdToLocalId = new Map<number, string>();

    for (const category of cianboxCategories) {
      try {
        const existing = await prisma.category.findUnique({
          where: {
            tenantId_cianboxCategoryId: {
              tenantId,
              cianboxCategoryId: category.id,
            },
          },
        });

        if (existing) {
          await prisma.category.update({
            where: { id: existing.id },
            data: {
              name: category.categoria,
              lastSyncedAt: new Date(),
            },
          });
          cianboxIdToLocalId.set(category.id, existing.id);
          result.updated++;
        } else {
          const created = await prisma.category.create({
            data: {
              tenantId,
              cianboxCategoryId: category.id,
              name: category.categoria,
              lastSyncedAt: new Date(),
            },
          });
          cianboxIdToLocalId.set(category.id, created.id);
          result.imported++;
        }
      } catch (catError: any) {
        result.errors.push(`Categoria ${category.id}: ${catError.message}`);
      }
    }

    // Segundo paso: Actualizar relaciones padre-hijo
    for (const category of cianboxCategories) {
      if (category.padre && category.padre > 0) {
        const localId = cianboxIdToLocalId.get(category.id);
        const parentLocalId = cianboxIdToLocalId.get(category.padre);

        if (localId && parentLocalId) {
          try {
            await prisma.category.update({
              where: { id: localId },
              data: { parentId: parentLocalId },
            });
          } catch (parentError: any) {
            result.errors.push(`Padre de categoria ${category.id}: ${parentError.message}`);
          }
        }
      }
    }

    console.log(`[Cianbox Categories Sync] Imported: ${result.imported}, Updated: ${result.updated}`);
    return result;
  } catch (error: any) {
    result.errors.push(error.message);
    return result;
  }
}

// ============================================
// MARCAS
// ============================================

/**
 * Obtiene marcas de Cianbox con paginacion automatica
 * Endpoint: GET /productos/marcas
 */
export async function fetchCianboxBrands(tenantId: string): Promise<CianboxBrand[]> {
  const connection = await prisma.cianboxConnection.findUnique({
    where: { tenantId },
  });

  if (!connection) {
    throw new Error('No hay conexion Cianbox configurada');
  }

  const token = await getAccessToken(tenantId);
  const baseUrl = `https://cianbox.org/${connection.cuenta}/api/v2`;

  let allBrands: CianboxBrand[] = [];
  let currentPage = 1;
  let hasMoreData = true;

  while (hasMoreData) {
    const params = new URLSearchParams({
      access_token: token,
      page: currentPage.toString(),
      limit: '100',
    });

    const response = await fetch(`${baseUrl}/productos/marcas?${params.toString()}`);
    const data = (await response.json()) as CianboxApiResponse;

    if (data.status !== 'ok') {
      throw new Error(`Error al obtener marcas: ${data.message}`);
    }

    const pageBrands: CianboxBrand[] = data.body || [];
    if (pageBrands.length === 0) {
      hasMoreData = false;
    } else {
      allBrands = allBrands.concat(pageBrands);
      currentPage++;
      if (pageBrands.length < 100) {
        hasMoreData = false;
      }
    }
  }

  console.log(`[Cianbox Brands] Fetched ${allBrands.length} brands`);
  return allBrands;
}

/**
 * Sincroniza marcas de Cianbox a la BD local
 */
export async function syncBrandsFromCianbox(
  tenantId: string
): Promise<{
  imported: number;
  updated: number;
  errors: string[];
}> {
  const result = { imported: 0, updated: 0, errors: [] as string[] };

  try {
    const cianboxBrands = await fetchCianboxBrands(tenantId);

    if (cianboxBrands.length === 0) {
      return result;
    }

    for (const brand of cianboxBrands) {
      try {
        const existing = await prisma.brand.findUnique({
          where: {
            tenantId_cianboxBrandId: {
              tenantId,
              cianboxBrandId: brand.id,
            },
          },
        });

        if (existing) {
          await prisma.brand.update({
            where: { id: existing.id },
            data: {
              name: brand.marca,
              lastSyncedAt: new Date(),
            },
          });
          result.updated++;
        } else {
          await prisma.brand.create({
            data: {
              tenantId,
              cianboxBrandId: brand.id,
              name: brand.marca,
              lastSyncedAt: new Date(),
            },
          });
          result.imported++;
        }
      } catch (brandError: any) {
        result.errors.push(`Marca ${brand.id}: ${brandError.message}`);
      }
    }

    console.log(`[Cianbox Brands Sync] Imported: ${result.imported}, Updated: ${result.updated}`);
    return result;
  } catch (error: any) {
    result.errors.push(error.message);
    return result;
  }
}

// ============================================
// PRODUCTOS
// ============================================

// Helpers para conversion de tipos
const toInt = (val: any): number => {
  if (typeof val === 'number') return Math.floor(val);
  if (typeof val === 'string') return parseInt(val, 10) || 0;
  return 0;
};

const toFloat = (val: any): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val) || 0;
  return 0;
};

/**
 * Sincroniza productos de Cianbox a la BD local
 * Incluye sincronizacion previa de categorias y marcas
 * Soporta callback para progreso (SSE)
 *
 * @param tenantId - ID del tenant
 * @param options.onPageProgress - Callback para reportar progreso
 */
export async function syncProductsFromCianbox(
  tenantId: string,
  options: {
    onPageProgress?: (progress: {
      page: number;
      totalPages: number;
      productsInPage: number;
      savedInPage: number;
      totalFetched: number;
      totalImported: number;
      totalUpdated: number;
    }) => void;
  } = {}
): Promise<{
  imported: number;
  updated: number;
  errors: string[];
}> {
  const result = { imported: 0, updated: 0, errors: [] as string[] };

  try {
    const connection = await prisma.cianboxConnection.findUnique({
      where: { tenantId },
    });

    if (!connection) {
      throw new Error('No hay conexion Cianbox configurada');
    }

    // 1. Sincronizar categorias y marcas primero
    console.log(`[Cianbox Products Sync] Syncing categories and brands first...`);
    await syncCategoriesFromCianbox(tenantId);
    await syncBrandsFromCianbox(tenantId);

    // 2. Construir mapas de IDs Cianbox -> IDs locales
    const categories = await prisma.category.findMany({
      where: { tenantId },
      select: { id: true, cianboxCategoryId: true },
    });
    const categoryMap = new Map<number, string>();
    categories.forEach(c => categoryMap.set(c.cianboxCategoryId, c.id));

    const brands = await prisma.brand.findMany({
      where: { tenantId },
      select: { id: true, cianboxBrandId: true },
    });
    const brandMap = new Map<number, string>();
    brands.forEach(b => brandMap.set(b.cianboxBrandId, b.id));

    // 3. Obtener token y configurar
    const token = await getAccessToken(tenantId);
    const baseUrl = `https://cianbox.org/${connection.cuenta}/api/v2`;

    let currentPage = 1;
    let totalPages = 1;
    // Usar syncPageSize de la conexion, default 20, max 200
    const perPage = Math.min(connection.syncPageSize || 20, 200);
    let totalFetched = 0;

    console.log(`[Cianbox Products Sync] Starting incremental sync (batch size: ${perPage})...`);

    // 4. Sincronizar pagina por pagina
    while (currentPage <= totalPages) {
      const params = new URLSearchParams({
        access_token: token,
        page: currentPage.toString(),
        limit: perPage.toString(),
      });

      const response = await fetch(`${baseUrl}/productos/lista?${params.toString()}`);
      const data = (await response.json()) as CianboxApiResponse;

      if (data.status !== 'ok') {
        throw new Error(`Error al obtener productos: ${data.message}`);
      }

      // Obtener total de paginas de la primera respuesta
      if (currentPage === 1 && data.total_pages) {
        totalPages = data.total_pages;
        console.log(`[Cianbox Products Sync] Total pages to sync: ${totalPages}`);
      }

      const pageProducts: CianboxProduct[] = data.body || [];

      if (pageProducts.length === 0) {
        break;
      }

      totalFetched += pageProducts.length;

      // Guardar pagina con upserts en batch
      const prevImported = result.imported;
      const prevUpdated = result.updated;

      // Preparar operaciones de upsert
      const upsertOperations = pageProducts.map(product => {
        // Extraer SKU de codigo_interno o del nombre si tiene patron [CODIGO]
        let sku = product.codigo_interno?.trim() || null;
        if (!sku && product.producto) {
          const match = product.producto.match(/^\[([^\]]+)\]/);
          if (match) {
            sku = match[1];
          }
        }

        const productData = {
          sku,
          name: product.producto || 'Producto sin nombre',
          description: product.descripcion || null,
          ean: product.codigo_barras || null,
          location: product.ubicacion || null,
          imageUrl: product.imagen || null,
          stock: product.stock != null ? toInt(product.stock) : null,
          price: product.precio != null ? toFloat(product.precio) : null,
          categoryId: product.id_categoria ? categoryMap.get(product.id_categoria) || null : null,
          brandId: product.id_marca ? brandMap.get(product.id_marca) || null : null,
          isActive: product.vigente !== false,
          lastSyncedAt: new Date(),
        };

        return prisma.product.upsert({
          where: {
            tenantId_cianboxProductId: {
              tenantId,
              cianboxProductId: product.id,
            },
          },
          update: productData,
          create: {
            tenantId,
            cianboxProductId: product.id,
            ...productData,
          },
        });
      });

      try {
        // Ejecutar todos los upserts en una transaccion
        await prisma.$transaction(upsertOperations);
        result.updated += pageProducts.length;
      } catch (batchError: any) {
        result.errors.push(`Batch page ${currentPage}: ${batchError.message}`);
      }

      const savedInPage = (result.imported - prevImported) + (result.updated - prevUpdated);

      console.log(`[Cianbox Products Sync] Page ${currentPage}/${totalPages}: fetched ${pageProducts.length}, saved ${savedInPage}`);

      // Llamar callback de progreso si existe (para SSE)
      if (options.onPageProgress) {
        options.onPageProgress({
          page: currentPage,
          totalPages,
          productsInPage: pageProducts.length,
          savedInPage,
          totalFetched,
          totalImported: result.imported,
          totalUpdated: result.updated,
        });
      }

      currentPage++;
    }

    console.log(`[Cianbox Products Sync] COMPLETED: total=${totalFetched}, updated=${result.updated}`);

    // 5. Actualizar lastSync de la conexion
    await prisma.cianboxConnection.update({
      where: { tenantId },
      data: {
        lastSync: new Date(),
        syncStatus: `Productos - Importados: ${result.imported}, Actualizados: ${result.updated}`,
      },
    });

    return result;
  } catch (error: any) {
    result.errors.push(error.message);
    return result;
  }
}
```

### 3.4 Endpoints de la API de Cianbox Descubiertos

| Endpoint | Metodo | Descripcion | Parametros |
|----------|--------|-------------|------------|
| `/auth/credentials` | POST | Obtener access_token | app_name, app_code, user, password |
| `/pedidos/estados` | GET | Lista de estados de pedidos | access_token |
| `/pedidos/lista` | GET | Lista de pedidos | access_token, id_estado, limit, page, fecha_desde, fecha_hasta |
| `/pedidos/editar-estado` | PUT | Cambiar estado de pedido | id, access_token + body: {id_estado} |
| `/pedidos/editar-observaciones` | PUT | Editar observaciones | id, access_token + body: {observaciones} |
| `/productos/lista` | GET | Lista de productos | access_token, page, limit, id, fields |
| `/productos/categorias` | GET | Lista de categorias | access_token, page, limit |
| `/productos/marcas` | GET | Lista de marcas | access_token, page, limit |
| `/mercadolibre/ventas/lista` | GET | Ventas de MercadoLibre | access_token, despachado, cobrado, vigente, order, page |

### 3.5 Consideraciones de Paginacion

- Cianbox devuelve `total_pages` en la primera respuesta
- El parametro `limit` tiene un maximo de 200 por request
- Siempre usar `page` empezando en 1
- El campo `total_pages` puede no estar presente en todas las respuestas

### 3.6 Manejo de Errores y Reintentos

```typescript
/**
 * Wrapper para requests a Cianbox con reintentos
 */
async function cianboxRequest<T>(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      const data = await response.json();

      if (data.status === 'ok') {
        return data as T;
      }

      // Error de Cianbox (no de red)
      throw new Error(data.message || 'Error desconocido de Cianbox');
    } catch (error: any) {
      lastError = error;

      // Si es error de autenticacion, no reintentar
      if (error.message?.includes('autenticacion')) {
        throw error;
      }

      // Esperar antes de reintentar (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        await new Promise(resolve => setTimeout(resolve, delay));
        console.log(`[Cianbox] Reintento ${attempt + 1}/${maxRetries} en ${delay}ms`);
      }
    }
  }

  throw lastError || new Error('Error en request a Cianbox');
}
```

---

## 4. Modelo de Datos

### 4.1 Modelos Base (Reutilizables)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// NIVEL AGENCIA (Super Admins globales)
// ============================================

model AgencyUser {
  id           String           @id @default(cuid())
  email        String           @unique
  passwordHash String
  name         String
  avatar       String?
  status       AgencyUserStatus @default(ACTIVE)
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  @@map("agency_users")
}

enum AgencyUserStatus {
  ACTIVE
  DISABLED
}

// ============================================
// NIVEL TENANT (Multi-tenant)
// ============================================

model Tenant {
  id        String       @id @default(cuid())
  name      String                          // "Mi Tienda"
  slug      String       @unique            // "mi-tienda" (usado en login)
  logo      String?
  plan      Plan         @default(FREE)
  status    TenantStatus @default(TRIAL)
  settings  Json         @default("{}")     // Configuracion JSON flexible
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  // Relaciones
  users             User[]
  roles             Role[]
  cianboxConnection CianboxConnection?
  categories        Category[]
  brands            Brand[]
  products          Product[]
  sales             Sale[]
  promotions        Promotion[]

  @@map("tenants")
}

enum Plan {
  FREE
  PRO
  ENTERPRISE
}

enum TenantStatus {
  TRIAL
  ACTIVE
  SUSPENDED
  CANCELLED
}

// ============================================
// USUARIOS
// ============================================

model User {
  id           String     @id @default(cuid())
  tenantId     String
  email        String
  passwordHash String
  name         String
  avatar       String?
  status       UserStatus @default(ACTIVE)
  roleId       String
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  // Relaciones
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  role   Role   @relation(fields: [roleId], references: [id])
  sales  Sale[]

  @@unique([tenantId, email])  // Email unico por tenant
  @@map("users")
}

enum UserStatus {
  ACTIVE
  INVITED
  DISABLED
}

model Role {
  id          String   @id @default(cuid())
  tenantId    String
  name        String
  description String?
  isSystem    Boolean  @default(false)
  permissions String[]                    // Array de permisos
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relaciones
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  users  User[]

  @@unique([tenantId, name])
  @@map("roles")
}

// ============================================
// CONEXION CIANBOX
// ============================================

model CianboxConnection {
  id           String   @id @default(cuid())
  tenantId     String   @unique
  cuenta       String                      // Nombre de cuenta en Cianbox
  appName      String
  appCode      String
  user         String
  password     String                      // Encriptado o texto plano segun implementacion
  syncPageSize Int      @default(20)       // Productos por pagina en sync
  isActive     Boolean  @default(true)
  lastSync     DateTime?
  syncStatus   String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Relaciones
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@map("cianbox_connections")
}

// ============================================
// CATALOGO DE PRODUCTOS
// ============================================

model Category {
  id                String    @id @default(cuid())
  tenantId          String
  cianboxCategoryId Int                       // ID en Cianbox
  name              String
  parentId          String?                   // Categoria padre (jerarquia)
  isActive          Boolean   @default(true)
  lastSyncedAt      DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // Relaciones
  tenant   Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  parent   Category?  @relation("CategoryHierarchy", fields: [parentId], references: [id])
  children Category[] @relation("CategoryHierarchy")
  products Product[]

  @@unique([tenantId, cianboxCategoryId])
  @@index([tenantId, parentId])
  @@map("categories")
}

model Brand {
  id             String    @id @default(cuid())
  tenantId       String
  cianboxBrandId Int                         // ID en Cianbox
  name           String
  isActive       Boolean   @default(true)
  lastSyncedAt   DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  // Relaciones
  tenant   Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  products Product[]

  @@unique([tenantId, cianboxBrandId])
  @@map("brands")
}

model Product {
  id               String    @id @default(cuid())
  tenantId         String
  cianboxProductId Int?                       // ID en Cianbox (null si producto local)
  sku              String?                    // Codigo interno
  name             String
  description      String?
  ean              String?                    // Codigo de barras
  location         String?                    // Ubicacion en deposito
  imageUrl         String?
  stock            Int?
  price            Decimal?  @db.Decimal(12, 2)
  categoryId       String?
  brandId          String?
  isActive         Boolean   @default(true)
  lastSyncedAt     DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  // Relaciones
  tenant    Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  category  Category?   @relation(fields: [categoryId], references: [id])
  brand     Brand?      @relation(fields: [brandId], references: [id])
  saleItems SaleItem[]

  @@unique([tenantId, sku])
  @@unique([tenantId, cianboxProductId])
  @@index([tenantId, ean])
  @@index([tenantId, categoryId])
  @@index([tenantId, brandId])
  @@map("products")
}
```

### 4.2 Modelos Especificos para POS

```prisma
// ============================================
// VENTAS POS
// ============================================

model Sale {
  id           String      @id @default(cuid())
  tenantId     String
  saleNumber   String                        // Numero de venta (001-00001)
  userId       String                        // Cajero que realizo la venta
  customerId   String?                       // Cliente (opcional)
  subtotal     Decimal     @db.Decimal(12, 2)
  discount     Decimal     @default(0) @db.Decimal(12, 2)
  tax          Decimal     @default(0) @db.Decimal(12, 2)
  total        Decimal     @db.Decimal(12, 2)
  paymentMethod PaymentMethod
  status       SaleStatus  @default(COMPLETED)
  notes        String?
  metadata     Json        @default("{}")    // Datos adicionales
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  // Relaciones
  tenant   Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user     User       @relation(fields: [userId], references: [id])
  items    SaleItem[]
  payments Payment[]

  @@unique([tenantId, saleNumber])
  @@index([tenantId, createdAt])
  @@index([tenantId, userId])
  @@map("sales")
}

enum PaymentMethod {
  CASH          // Efectivo
  CREDIT_CARD   // Tarjeta credito
  DEBIT_CARD    // Tarjeta debito
  TRANSFER      // Transferencia
  QR            // QR (MercadoPago, etc)
  MIXED         // Pago mixto
}

enum SaleStatus {
  PENDING       // En proceso
  COMPLETED     // Completada
  CANCELLED     // Anulada
  REFUNDED      // Devuelta
}

model SaleItem {
  id            String   @id @default(cuid())
  saleId        String
  productId     String
  productName   String                       // Nombre al momento de venta
  productSku    String?                      // SKU al momento de venta
  quantity      Int
  unitPrice     Decimal  @db.Decimal(12, 2)
  discount      Decimal  @default(0) @db.Decimal(12, 2)
  subtotal      Decimal  @db.Decimal(12, 2)  // (unitPrice * quantity) - discount
  promotionId   String?                      // Promocion aplicada
  createdAt     DateTime @default(now())

  // Relaciones
  sale      Sale       @relation(fields: [saleId], references: [id], onDelete: Cascade)
  product   Product    @relation(fields: [productId], references: [id])
  promotion Promotion? @relation(fields: [promotionId], references: [id])

  @@map("sale_items")
}

model Payment {
  id           String        @id @default(cuid())
  saleId       String
  method       PaymentMethod
  amount       Decimal       @db.Decimal(12, 2)
  reference    String?                       // Numero de tarjeta, ref transferencia, etc
  createdAt    DateTime      @default(now())

  // Relaciones
  sale Sale @relation(fields: [saleId], references: [id], onDelete: Cascade)

  @@map("payments")
}

// ============================================
// PROMOCIONES
// ============================================

model Promotion {
  id             String          @id @default(cuid())
  tenantId       String
  name           String                       // "2x1 en Shampoos"
  description    String?
  type           PromotionType
  config         Json                         // Configuracion segun tipo
  discountType   DiscountType    @default(PERCENTAGE)
  discountValue  Decimal         @db.Decimal(12, 2)  // Valor del descuento
  minQuantity    Int?                         // Cantidad minima para aplicar
  maxUses        Int?                         // Usos maximos (null = ilimitado)
  currentUses    Int             @default(0)
  startDate      DateTime?                    // Inicio de vigencia
  endDate        DateTime?                    // Fin de vigencia
  isActive       Boolean         @default(true)
  priority       Int             @default(0)  // Mayor prioridad = se aplica primero
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  // Relaciones
  tenant           Tenant               @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  applicableProducts PromotionProduct[]
  saleItems        SaleItem[]

  @@index([tenantId, isActive, startDate, endDate])
  @@map("promotions")
}

enum PromotionType {
  TWO_FOR_ONE          // 2x1
  SECOND_HALF_PRICE    // 2da unidad 50%
  PERCENTAGE           // % de descuento
  FIXED_AMOUNT         // Monto fijo de descuento
  BUY_X_GET_Y          // Compra X lleva Y
  BUNDLE               // Combo/Pack
  FLASH_SALE           // Venta flash (BlackFriday, CyberMonday)
}

enum DiscountType {
  PERCENTAGE
  FIXED_AMOUNT
}

model PromotionProduct {
  id          String @id @default(cuid())
  promotionId String
  productId   String

  // Relaciones
  promotion Promotion @relation(fields: [promotionId], references: [id], onDelete: Cascade)

  @@unique([promotionId, productId])
  @@map("promotion_products")
}
```

---

## 5. Codigo Reutilizable

### 5.1 Validacion con Zod

```typescript
// apps/backend/src/utils/validators.ts
import { z } from 'zod';

/**
 * Schema de login
 */
export const loginSchema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(1, 'Password requerido'),
  tenantSlug: z.string().optional(),
  tenantId: z.string().optional(),
});

/**
 * Schema de registro
 */
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password debe tener al menos 6 caracteres'),
  name: z.string().min(2, 'Nombre debe tener al menos 2 caracteres'),
});

/**
 * Schema de producto
 */
export const productSchema = z.object({
  sku: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  ean: z.string().optional(),
  price: z.number().positive().optional(),
  stock: z.number().int().nonnegative().optional(),
  categoryId: z.string().optional(),
  brandId: z.string().optional(),
  isActive: z.boolean().default(true),
});

/**
 * Schema de venta POS
 */
export const saleSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(),
    discount: z.number().nonnegative().default(0),
  })).min(1, 'Debe incluir al menos un producto'),
  paymentMethod: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'TRANSFER', 'QR', 'MIXED']),
  payments: z.array(z.object({
    method: z.enum(['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'TRANSFER', 'QR']),
    amount: z.number().positive(),
    reference: z.string().optional(),
  })).optional(),
  customerId: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * Schema de promocion
 */
export const promotionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum([
    'TWO_FOR_ONE',
    'SECOND_HALF_PRICE',
    'PERCENTAGE',
    'FIXED_AMOUNT',
    'BUY_X_GET_Y',
    'BUNDLE',
    'FLASH_SALE',
  ]),
  config: z.record(z.any()).default({}),
  discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']).default('PERCENTAGE'),
  discountValue: z.number().positive(),
  minQuantity: z.number().int().positive().optional(),
  maxUses: z.number().int().positive().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
  priority: z.number().int().default(0),
  productIds: z.array(z.string()).optional(),
});

/**
 * Middleware para validar body con Zod
 */
export const validate = <T>(schema: z.ZodSchema<T>) => {
  return (req: any, res: any, next: any) => {
    try {
      req.validatedBody = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
};
```

### 5.2 Manejo de Errores

```typescript
// apps/backend/src/utils/errors.ts

/**
 * Error personalizado para respuestas HTTP
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(message: string, code?: string) {
    return new ApiError(400, message, code);
  }

  static unauthorized(message: string = 'No autorizado') {
    return new ApiError(401, message, 'UNAUTHORIZED');
  }

  static forbidden(message: string = 'Acceso denegado') {
    return new ApiError(403, message, 'FORBIDDEN');
  }

  static notFound(message: string = 'Recurso no encontrado') {
    return new ApiError(404, message, 'NOT_FOUND');
  }

  static conflict(message: string) {
    return new ApiError(409, message, 'CONFLICT');
  }

  static internal(message: string = 'Error interno del servidor') {
    return new ApiError(500, message, 'INTERNAL_ERROR');
  }
}

/**
 * Middleware de manejo de errores
 */
export const errorHandler = (
  err: any,
  req: any,
  res: any,
  next: any
) => {
  console.error('Error:', err);

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
  }

  // Error de Prisma
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'Ya existe un registro con esos datos',
      code: 'DUPLICATE_ENTRY',
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      error: 'Registro no encontrado',
      code: 'NOT_FOUND',
    });
  }

  // Error generico
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Error interno del servidor'
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};
```

### 5.3 Rutas de Autenticacion

```typescript
// apps/backend/src/routes/auth.ts
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Schemas de validacion
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantSlug: z.string().optional(),
  tenantId: z.string().optional(),
});

/**
 * POST /api/auth/check-tenants
 * Verifica credenciales y devuelve empresas disponibles
 *
 * Body: { email, password }
 * Response:
 *   - Si tiene una empresa: { requiresTenantSelection: false, token, user }
 *   - Si tiene multiples: { requiresTenantSelection: true, tenants: [...] }
 */
router.post('/check-tenants', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.pick({ email: true, password: true }).parse(req.body);

    // Buscar usuarios con ese email
    const users = await prisma.user.findMany({
      where: { email },
      include: {
        tenant: true,
        role: true,
      },
    });

    if (users.length === 0) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    // Verificar password con el primer usuario
    const validPassword = await bcrypt.compare(password, users[0].passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    // Filtrar empresas activas
    const validUsers = users.filter(
      u => u.status === 'ACTIVE' &&
           (u.tenant.status === 'ACTIVE' || u.tenant.status === 'TRIAL')
    );

    if (validUsers.length === 0) {
      return res.status(403).json({ error: 'Usuario o empresa inactiva' });
    }

    // Si solo hay una empresa, login directo
    if (validUsers.length === 1) {
      const user = validUsers[0];
      const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
      const token = jwt.sign(
        { userId: user.id, tenantId: user.tenantId },
        process.env.JWT_SECRET!,
        { expiresIn } as SignOptions
      );

      return res.json({
        requiresTenantSelection: false,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          isSuperAdmin: false,
          role: {
            id: user.role.id,
            name: user.role.name,
            permissions: user.role.permissions,
          },
          tenant: {
            id: user.tenant.id,
            name: user.tenant.name,
            slug: user.tenant.slug,
          },
        },
      });
    }

    // Multiples empresas: devolver lista
    res.json({
      requiresTenantSelection: true,
      tenants: validUsers.map(u => ({
        id: u.tenant.id,
        name: u.tenant.name,
        slug: u.tenant.slug,
        roleName: u.role.name,
      })),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    next(error);
  }
});

/**
 * POST /api/auth/login
 * Login con tenant especifico
 *
 * Body: { email, password, tenantId? }
 * Response: { token, user }
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password, tenantId } = loginSchema.parse(req.body);

    // Buscar usuario
    const users = await prisma.user.findMany({
      where: { email },
      include: { role: true, tenant: true },
    });

    if (users.length === 0) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    // Verificar password
    const validPassword = await bcrypt.compare(password, users[0].passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    // Buscar usuario en el tenant especifico
    const user = tenantId
      ? users.find(u => u.tenantId === tenantId)
      : users[0];

    if (!user) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Usuario inactivo' });
    }

    // Generar token
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenantId },
      process.env.JWT_SECRET!,
      { expiresIn } as SignOptions
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isSuperAdmin: false,
        role: {
          id: user.role.id,
          name: user.role.name,
          permissions: user.role.permissions,
        },
        tenant: {
          id: user.tenant.id,
          name: user.tenant.name,
          slug: user.tenant.slug,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    next(error);
  }
});

/**
 * GET /api/auth/me
 * Obtiene el usuario actual
 */
router.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { role: true, tenant: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      isSuperAdmin: false,
      role: {
        id: user.role.id,
        name: user.role.name,
        permissions: user.role.permissions,
      },
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
        plan: user.tenant.plan,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/change-password
 * Cambiar password del usuario actual
 */
router.post('/change-password', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const schema = z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(6),
    });

    const { currentPassword, newPassword } = schema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Password actual incorrecto' });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    res.json({ message: 'Password actualizado correctamente' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    next(error);
  }
});

export default router;
```

---

## 6. Guia de Arquitectura para POS

### 6.1 Flujo de Venta POS

```
1. Cliente agrega productos al carrito
2. Sistema verifica stock
3. Sistema aplica promociones automaticamente
4. Cliente selecciona metodo de pago
5. Sistema registra venta
6. Sistema actualiza stock (opcional, depende de integracion)
7. Sistema genera comprobante
```

### 6.2 Implementacion de Promociones

```typescript
// apps/backend/src/services/promotions.service.ts
import { PrismaClient, Promotion, PromotionType } from '@prisma/client';

const prisma = new PrismaClient();

interface CartItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

interface AppliedPromotion {
  promotionId: string;
  promotionName: string;
  itemIndex: number;
  discount: number;
  description: string;
}

/**
 * Aplica promociones a un carrito de compras
 * Retorna el carrito con los descuentos aplicados
 */
export async function applyPromotions(
  tenantId: string,
  items: CartItem[]
): Promise<{
  items: (CartItem & { discount: number; appliedPromotions: string[] })[];
  totalDiscount: number;
  appliedPromotions: AppliedPromotion[];
}> {
  const now = new Date();

  // 1. Obtener promociones activas y vigentes
  const promotions = await prisma.promotion.findMany({
    where: {
      tenantId,
      isActive: true,
      OR: [
        { startDate: null, endDate: null },
        { startDate: { lte: now }, endDate: null },
        { startDate: null, endDate: { gte: now } },
        { startDate: { lte: now }, endDate: { gte: now } },
      ],
      OR: [
        { maxUses: null },
        { currentUses: { lt: prisma.promotion.fields.maxUses } },
      ],
    },
    include: {
      applicableProducts: true,
    },
    orderBy: { priority: 'desc' },
  });

  // 2. Inicializar resultado
  const result = {
    items: items.map(item => ({
      ...item,
      discount: 0,
      appliedPromotions: [] as string[],
    })),
    totalDiscount: 0,
    appliedPromotions: [] as AppliedPromotion[],
  };

  // 3. Aplicar cada promocion segun su tipo
  for (const promo of promotions) {
    const applicableProductIds = promo.applicableProducts.map(p => p.productId);

    switch (promo.type) {
      case 'TWO_FOR_ONE':
        applyTwoForOne(result, promo, applicableProductIds);
        break;

      case 'SECOND_HALF_PRICE':
        applySecondHalfPrice(result, promo, applicableProductIds);
        break;

      case 'PERCENTAGE':
        applyPercentageDiscount(result, promo, applicableProductIds);
        break;

      case 'FIXED_AMOUNT':
        applyFixedDiscount(result, promo, applicableProductIds);
        break;

      case 'FLASH_SALE':
        // Igual que PERCENTAGE pero solo si esta en rango de fechas
        applyPercentageDiscount(result, promo, applicableProductIds);
        break;
    }
  }

  // 4. Calcular total de descuentos
  result.totalDiscount = result.items.reduce((sum, item) => sum + item.discount, 0);

  return result;
}

/**
 * Aplica promocion 2x1
 * Por cada 2 unidades del producto, la segunda es gratis
 */
function applyTwoForOne(
  result: any,
  promo: Promotion,
  applicableProductIds: string[]
) {
  result.items.forEach((item: any, index: number) => {
    if (!applicableProductIds.includes(item.productId) && applicableProductIds.length > 0) {
      return; // No aplica a este producto
    }

    // Calcular pares de productos
    const pairs = Math.floor(item.quantity / 2);
    if (pairs > 0) {
      const discount = pairs * item.unitPrice;
      item.discount += discount;
      item.appliedPromotions.push(promo.id);
      result.appliedPromotions.push({
        promotionId: promo.id,
        promotionName: promo.name,
        itemIndex: index,
        discount,
        description: `2x1: ${pairs} unidad(es) gratis`,
      });
    }
  });
}

/**
 * Aplica segunda unidad al 50%
 */
function applySecondHalfPrice(
  result: any,
  promo: Promotion,
  applicableProductIds: string[]
) {
  result.items.forEach((item: any, index: number) => {
    if (!applicableProductIds.includes(item.productId) && applicableProductIds.length > 0) {
      return;
    }

    // Por cada par, la segunda unidad tiene 50% descuento
    const pairs = Math.floor(item.quantity / 2);
    if (pairs > 0) {
      const discount = pairs * (item.unitPrice * 0.5);
      item.discount += discount;
      item.appliedPromotions.push(promo.id);
      result.appliedPromotions.push({
        promotionId: promo.id,
        promotionName: promo.name,
        itemIndex: index,
        discount,
        description: `2da unidad 50%: ${pairs} unidad(es) a mitad de precio`,
      });
    }
  });
}

/**
 * Aplica descuento porcentual
 */
function applyPercentageDiscount(
  result: any,
  promo: Promotion,
  applicableProductIds: string[]
) {
  result.items.forEach((item: any, index: number) => {
    if (!applicableProductIds.includes(item.productId) && applicableProductIds.length > 0) {
      return;
    }

    // Verificar cantidad minima
    if (promo.minQuantity && item.quantity < promo.minQuantity) {
      return;
    }

    const subtotal = item.quantity * item.unitPrice;
    const discount = subtotal * (Number(promo.discountValue) / 100);
    item.discount += discount;
    item.appliedPromotions.push(promo.id);
    result.appliedPromotions.push({
      promotionId: promo.id,
      promotionName: promo.name,
      itemIndex: index,
      discount,
      description: `${promo.discountValue}% de descuento`,
    });
  });
}

/**
 * Aplica descuento de monto fijo
 */
function applyFixedDiscount(
  result: any,
  promo: Promotion,
  applicableProductIds: string[]
) {
  result.items.forEach((item: any, index: number) => {
    if (!applicableProductIds.includes(item.productId) && applicableProductIds.length > 0) {
      return;
    }

    if (promo.minQuantity && item.quantity < promo.minQuantity) {
      return;
    }

    const discount = Math.min(Number(promo.discountValue), item.quantity * item.unitPrice);
    item.discount += discount;
    item.appliedPromotions.push(promo.id);
    result.appliedPromotions.push({
      promotionId: promo.id,
      promotionName: promo.name,
      itemIndex: index,
      discount,
      description: `$${promo.discountValue} de descuento`,
    });
  });
}
```

### 6.3 Promociones por Fecha (BlackFriday, CyberMonday)

```typescript
// Ejemplo de promocion Flash Sale
const blackFridayPromo = await prisma.promotion.create({
  data: {
    tenantId: 'xxx',
    name: 'Black Friday 2024',
    description: '30% de descuento en toda la tienda',
    type: 'FLASH_SALE',
    config: {
      eventName: 'BLACK_FRIDAY',
      year: 2024,
    },
    discountType: 'PERCENTAGE',
    discountValue: 30,
    startDate: new Date('2024-11-29T00:00:00Z'),
    endDate: new Date('2024-11-30T23:59:59Z'),
    isActive: true,
    priority: 100, // Alta prioridad para que se aplique primero
  },
});

// Endpoint para activar/desactivar promociones
router.patch('/promotions/:id/toggle', authenticate, async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  const promo = await prisma.promotion.update({
    where: {
      id,
      tenantId: req.user!.tenantId,
    },
    data: { isActive },
  });

  res.json(promo);
});

// Endpoint para obtener promociones vigentes
router.get('/promotions/active', authenticate, async (req, res) => {
  const now = new Date();

  const promos = await prisma.promotion.findMany({
    where: {
      tenantId: req.user!.tenantId,
      isActive: true,
      OR: [
        { startDate: null, endDate: null },
        { startDate: { lte: now }, endDate: { gte: now } },
      ],
    },
    orderBy: { priority: 'desc' },
  });

  res.json(promos);
});
```

### 6.4 Sincronizacion Bidireccional con Cianbox (POS)

Para el POS, podrias necesitar enviar ventas de vuelta a Cianbox:

```typescript
/**
 * Envia una venta al sistema Cianbox
 * NOTA: Verificar documentacion de Cianbox para endpoints de creacion de ventas
 */
export async function sendSaleToCianbox(
  tenantId: string,
  sale: {
    items: Array<{
      cianboxProductId: number;
      quantity: number;
      unitPrice: number;
    }>;
    total: number;
    paymentMethod: string;
    reference?: string;
  }
): Promise<{ success: boolean; cianboxSaleId?: number; error?: string }> {
  const connection = await prisma.cianboxConnection.findUnique({
    where: { tenantId },
  });

  if (!connection) {
    return { success: false, error: 'No hay conexion Cianbox configurada' };
  }

  const token = await getAccessToken(tenantId);
  const baseUrl = `https://cianbox.org/${connection.cuenta}/api/v2`;

  // NOTA: Este endpoint es hipotetico - verificar con documentacion de Cianbox
  const response = await fetch(`${baseUrl}/ventas/crear?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      detalles: sale.items.map(item => ({
        id_producto: item.cianboxProductId,
        cantidad: item.quantity,
        precio: item.unitPrice,
      })),
      total: sale.total,
      forma_pago: sale.paymentMethod,
      referencia: sale.reference,
    }),
  });

  const data = await response.json();

  if (data.status !== 'ok') {
    return { success: false, error: data.message };
  }

  return { success: true, cianboxSaleId: data.body?.id };
}
```

---

## 7. API Reference de Cianbox

### 7.1 Endpoints Documentados

| Metodo | Endpoint | Descripcion |
|--------|----------|-------------|
| POST | `/auth/credentials` | Obtener access_token |
| GET | `/productos/lista` | Listar productos |
| GET | `/productos/categorias` | Listar categorias |
| GET | `/productos/marcas` | Listar marcas |
| GET | `/pedidos/lista` | Listar pedidos |
| GET | `/pedidos/estados` | Listar estados de pedidos |
| PUT | `/pedidos/editar-estado` | Cambiar estado de pedido |
| PUT | `/pedidos/editar-observaciones` | Editar observaciones |
| GET | `/mercadolibre/ventas/lista` | Listar ventas de ML |

### 7.2 Parametros Comunes

| Parametro | Tipo | Descripcion |
|-----------|------|-------------|
| `access_token` | string | Token de autenticacion (obligatorio) |
| `page` | number | Numero de pagina (desde 1) |
| `limit` | number | Items por pagina (max 200) |
| `fields` | string | Campos a incluir (separados por coma) |
| `id` | number/string | ID especifico o lista de IDs separados por coma |

### 7.3 Respuesta Tipo

```json
{
  "status": "ok",
  "body": [ /* datos */ ],
  "message": "",
  "page": "1",
  "total_pages": 5
}
```

### 7.4 Filtros de Pedidos

| Parametro | Valores | Descripcion |
|-----------|---------|-------------|
| `id_estado` | number | ID de estado (o IDs separados por coma) |
| `fecha_desde` | YYYY-MM-DD | Fecha desde |
| `fecha_hasta` | YYYY-MM-DD | Fecha hasta |

### 7.5 Filtros de Ventas MELI

| Parametro | Valores | Descripcion |
|-----------|---------|-------------|
| `despachado` | 0, 1 | Filtrar por despachado |
| `cobrado` | 0, 1 | Filtrar por cobrado |
| `vigente` | 0, 1 | Filtrar por vigente |
| `order` | string | Ordenamiento (create-date-desc, etc) |

---

## Anexo A: Variables de Entorno

```bash
# .env
DATABASE_URL="postgresql://user:password@localhost:5432/pos_cianbox"
JWT_SECRET="tu-secret-key-muy-segura"
JWT_EXPIRES_IN="7d"
PORT=3000
NODE_ENV=development
CORS_ORIGIN="http://localhost:5173"
```

---

## Anexo B: Comandos Utiles

```bash
# Inicializar Prisma
npx prisma init
npx prisma migrate dev --name init
npx prisma generate

# Ejecutar seeds
npx prisma db seed

# Ver base de datos
npx prisma studio

# Build produccion
npm run build
npm start

# Desarrollo
npm run dev
```

---

## Anexo C: Notas de Implementacion

1. **Siempre filtrar por tenantId** en todas las queries de base de datos
2. **Validar inputs** con Zod antes de procesarlos
3. **Usar transacciones** para operaciones que modifican multiples tablas
4. **Loggear errores** de forma estructurada para debugging
5. **Cachear tokens** de Cianbox para evitar autenticaciones innecesarias
6. **Manejar paginacion** correctamente al sincronizar con Cianbox
7. **Usar SSE** para operaciones largas (sincronizacion de productos)
8. **Implementar retry logic** para requests a APIs externas

---

**Documento generado automaticamente desde el codebase de warehouse-picking**
