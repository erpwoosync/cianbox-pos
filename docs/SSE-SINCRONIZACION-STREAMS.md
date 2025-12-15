# Sincronización con Server-Sent Events (SSE)

## Introducción

Para operaciones largas como la sincronización de productos (que pueden ser miles), usamos **Server-Sent Events (SSE)** para enviar progreso en tiempo real al cliente sin necesidad de WebSockets.

## ¿Por qué SSE?

| Característica | SSE | WebSocket | Polling |
|----------------|-----|-----------|---------|
| Complejidad | Baja | Alta | Baja |
| Unidireccional (server→client) | ✅ | ✅ | ✅ |
| Reconexión automática | ✅ | ❌ | N/A |
| Funciona con HTTP/1.1 | ✅ | ✅ | ✅ |
| Ideal para progreso | ✅ | Overkill | Ineficiente |

## Arquitectura

```
┌─────────────┐     GET /api/cianbox/sync/products     ┌─────────────┐
│   Frontend  │ ──────────────────────────────────────▶│   Backend   │
│             │                                         │             │
│ EventSource │◀─────── SSE: data: {...} ──────────────│   Express   │
│             │◀─────── SSE: data: {...} ──────────────│             │
│             │◀─────── SSE: data: {...} ──────────────│   Cianbox   │
│   Progress  │◀─────── SSE: event: complete ──────────│   Service   │
└─────────────┘                                         └─────────────┘
```

## Implementación Backend

### 1. Configurar Headers SSE

```typescript
// apps/backend/src/routes/cianbox.ts

import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { CianboxService } from '../services/cianbox.service.js';

const router = Router();

/**
 * Configurar respuesta para SSE
 */
function setupSSE(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Importante para Nginx
  res.flushHeaders();
}

/**
 * Enviar evento SSE
 */
function sendSSE(res: Response, event: string, data: any) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}
```

### 2. Endpoint de Sincronización con SSE

```typescript
/**
 * GET /api/cianbox/sync/products/stream
 * Sincroniza productos con Cianbox enviando progreso por SSE
 */
router.get('/sync/products/stream', async (req: AuthRequest, res, next) => {
  try {
    const tenantId = req.user!.tenantId;

    // Configurar SSE
    setupSSE(res);

    // Enviar evento inicial
    sendSSE(res, 'start', {
      message: 'Iniciando sincronización de productos',
      timestamp: new Date().toISOString()
    });

    const cianboxService = new CianboxService(tenantId);

    // Sincronizar con callback de progreso
    const result = await cianboxService.syncProductsFromCianbox({
      onPageProgress: (progress) => {
        // Enviar progreso por SSE
        sendSSE(res, 'progress', {
          page: progress.page,
          totalPages: progress.totalPages,
          productsInPage: progress.productsInPage,
          totalProcessed: progress.totalProcessed,
          created: progress.created,
          updated: progress.updated,
          errors: progress.errors,
          percent: Math.round((progress.page / progress.totalPages) * 100)
        });
      }
    });

    // Enviar resultado final
    sendSSE(res, 'complete', {
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });

    // Cerrar conexión
    res.end();

  } catch (error: any) {
    // Enviar error por SSE
    sendSSE(res, 'error', {
      success: false,
      message: error.message,
      timestamp: new Date().toISOString()
    });
    res.end();
  }
});
```

### 3. Servicio con Callback de Progreso

```typescript
// apps/backend/src/services/cianbox.service.ts

interface SyncProductsOptions {
  pageSize?: number;
  onPageProgress?: (progress: {
    page: number;
    totalPages: number;
    productsInPage: number;
    totalProcessed: number;
    created: number;
    updated: number;
    errors: number;
  }) => void;
}

interface SyncResult {
  totalProducts: number;
  created: number;
  updated: number;
  errors: number;
  pages: number;
  duration: number;
}

export class CianboxService {
  private tenantId: string;
  private prisma: PrismaClient;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
    this.prisma = new PrismaClient();
  }

  /**
   * Sincroniza productos desde Cianbox con soporte para SSE
   */
  async syncProductsFromCianbox(options: SyncProductsOptions = {}): Promise<SyncResult> {
    const { pageSize = 100, onPageProgress } = options;
    const startTime = Date.now();

    let page = 1;
    let totalPages = 1;
    let totalProcessed = 0;
    let created = 0;
    let updated = 0;
    let errors = 0;

    // Obtener primera página para saber total
    const firstPage = await this.fetchCianboxProducts({ page: 1, limit: pageSize });
    totalPages = Math.ceil(firstPage.total / pageSize);

    // Procesar todas las páginas
    while (page <= totalPages) {
      try {
        const response = await this.fetchCianboxProducts({ page, limit: pageSize });

        for (const product of response.data) {
          try {
            const existing = await this.prisma.product.findFirst({
              where: {
                tenantId: this.tenantId,
                cianboxId: product.id.toString()
              }
            });

            if (existing) {
              await this.prisma.product.update({
                where: { id: existing.id },
                data: this.mapCianboxProduct(product)
              });
              updated++;
            } else {
              await this.prisma.product.create({
                data: {
                  tenantId: this.tenantId,
                  cianboxId: product.id.toString(),
                  ...this.mapCianboxProduct(product)
                }
              });
              created++;
            }
            totalProcessed++;
          } catch (err) {
            errors++;
            console.error(`Error procesando producto ${product.id}:`, err);
          }
        }

        // Llamar callback de progreso (para SSE)
        if (onPageProgress) {
          onPageProgress({
            page,
            totalPages,
            productsInPage: response.data.length,
            totalProcessed,
            created,
            updated,
            errors
          });
        }

        page++;
      } catch (err) {
        console.error(`Error en página ${page}:`, err);
        errors++;
        page++; // Continuar con siguiente página
      }
    }

    return {
      totalProducts: totalProcessed,
      created,
      updated,
      errors,
      pages: totalPages,
      duration: Date.now() - startTime
    };
  }

  private mapCianboxProduct(product: any) {
    return {
      sku: product.codigo || null,
      barcode: product.codigo_barras || null,
      name: product.nombre,
      description: product.descripcion || null,
      price: parseFloat(product.precio_venta) || 0,
      cost: parseFloat(product.precio_costo) || 0,
      stock: parseInt(product.stock) || 0,
      categoryId: product.categoria_id?.toString() || null,
      brandId: product.marca_id?.toString() || null,
      isActive: product.activo === '1' || product.activo === true,
      updatedAt: new Date()
    };
  }
}
```

## Implementación Frontend

### 1. Hook personalizado para SSE

```typescript
// apps/frontend/src/hooks/useSSE.ts

import { useState, useCallback } from 'react';

interface SSEProgress {
  page: number;
  totalPages: number;
  productsInPage: number;
  totalProcessed: number;
  created: number;
  updated: number;
  errors: number;
  percent: number;
}

interface SSEResult {
  success: boolean;
  totalProducts?: number;
  created?: number;
  updated?: number;
  errors?: number;
  message?: string;
}

interface UseSSESyncReturn {
  progress: SSEProgress | null;
  result: SSEResult | null;
  isLoading: boolean;
  error: string | null;
  startSync: () => void;
  cancel: () => void;
}

export function useSSESync(url: string): UseSSESyncReturn {
  const [progress, setProgress] = useState<SSEProgress | null>(null);
  const [result, setResult] = useState<SSEResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  const startSync = useCallback(() => {
    // Resetear estado
    setProgress(null);
    setResult(null);
    setError(null);
    setIsLoading(true);

    // Crear conexión SSE
    const token = localStorage.getItem('token');
    const es = new EventSource(`${url}?token=${token}`);
    setEventSource(es);

    // Evento: inicio
    es.addEventListener('start', (e) => {
      console.log('Sync started:', JSON.parse(e.data));
    });

    // Evento: progreso
    es.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data);
      setProgress(data);
    });

    // Evento: completado
    es.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data);
      setResult(data);
      setIsLoading(false);
      es.close();
    });

    // Evento: error
    es.addEventListener('error', (e) => {
      if (e.data) {
        const data = JSON.parse(e.data);
        setError(data.message);
        setResult(data);
      } else {
        setError('Error de conexión');
      }
      setIsLoading(false);
      es.close();
    });

    // Error de conexión
    es.onerror = () => {
      setError('Error de conexión con el servidor');
      setIsLoading(false);
      es.close();
    };

  }, [url]);

  const cancel = useCallback(() => {
    if (eventSource) {
      eventSource.close();
      setIsLoading(false);
      setError('Sincronización cancelada');
    }
  }, [eventSource]);

  return { progress, result, isLoading, error, startSync, cancel };
}
```

### 2. Componente de Sincronización

```tsx
// apps/frontend/src/components/SyncProducts.tsx

import { useSSESync } from '../hooks/useSSE';

export function SyncProducts() {
  const {
    progress,
    result,
    isLoading,
    error,
    startSync,
    cancel
  } = useSSESync('/api/cianbox/sync/products/stream');

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4">Sincronizar Productos</h2>

      {/* Botones */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={startSync}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Sincronizando...' : 'Iniciar Sincronización'}
        </button>

        {isLoading && (
          <button
            onClick={cancel}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Cancelar
          </button>
        )}
      </div>

      {/* Barra de progreso */}
      {progress && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Página {progress.page} de {progress.totalPages}</span>
            <span>{progress.percent}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <div className="mt-2 text-sm text-gray-600">
            <span className="mr-4">Procesados: {progress.totalProcessed}</span>
            <span className="mr-4 text-green-600">Creados: {progress.created}</span>
            <span className="mr-4 text-blue-600">Actualizados: {progress.updated}</span>
            {progress.errors > 0 && (
              <span className="text-red-600">Errores: {progress.errors}</span>
            )}
          </div>
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div className={`p-4 rounded ${result.success ? 'bg-green-100' : 'bg-red-100'}`}>
          {result.success ? (
            <>
              <p className="font-semibold text-green-800">Sincronización completada</p>
              <p className="text-sm text-green-700">
                Total: {result.totalProducts} productos |
                Creados: {result.created} |
                Actualizados: {result.updated} |
                Errores: {result.errors}
              </p>
            </>
          ) : (
            <p className="text-red-800">{result.message}</p>
          )}
        </div>
      )}

      {/* Error */}
      {error && !result && (
        <div className="p-4 bg-red-100 rounded">
          <p className="text-red-800">{error}</p>
        </div>
      )}
    </div>
  );
}
```

### 3. Alternativa con Fetch (sin EventSource)

Si necesitas enviar headers de autenticación (EventSource no soporta headers custom):

```typescript
// apps/frontend/src/hooks/useSSEFetch.ts

export function useSSESyncFetch(url: string) {
  const [progress, setProgress] = useState<SSEProgress | null>(null);
  const [result, setResult] = useState<SSEResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const startSync = useCallback(async () => {
    setProgress(null);
    setResult(null);
    setError(null);
    setIsLoading(true);

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream'
        },
        signal: controller.signal
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No reader available');

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const eventMatch = line.match(/event: (\w+)/);
          const dataMatch = line.match(/data: (.+)/);

          if (eventMatch && dataMatch) {
            const event = eventMatch[1];
            const data = JSON.parse(dataMatch[1]);

            switch (event) {
              case 'progress':
                setProgress(data);
                break;
              case 'complete':
                setResult(data);
                setIsLoading(false);
                break;
              case 'error':
                setError(data.message);
                setResult(data);
                setIsLoading(false);
                break;
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message);
        setIsLoading(false);
      }
    }
  }, [url]);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    setIsLoading(false);
    setError('Sincronización cancelada');
  }, []);

  return { progress, result, isLoading, error, startSync, cancel };
}
```

## Configuración Nginx

Para que SSE funcione correctamente con Nginx:

```nginx
location /api/ {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_set_header Host $host;
    proxy_buffering off;           # Importante para SSE
    proxy_cache off;               # Importante para SSE
    proxy_read_timeout 86400;      # Timeout largo para streams

    # Headers SSE
    add_header X-Accel-Buffering no;
}
```

## Manejo de Reconexión

EventSource reconecta automáticamente, pero puedes manejarlo manualmente:

```typescript
es.onerror = (e) => {
  if (es.readyState === EventSource.CONNECTING) {
    console.log('Reconectando...');
  } else if (es.readyState === EventSource.CLOSED) {
    console.log('Conexión cerrada');
    // Reintentar manualmente si es necesario
    setTimeout(() => startSync(), 5000);
  }
};
```

## Eventos SSE Definidos

| Evento | Descripción | Data |
|--------|-------------|------|
| `start` | Inicio de sincronización | `{ message, timestamp }` |
| `progress` | Progreso por página | `{ page, totalPages, percent, created, updated, errors }` |
| `complete` | Sincronización exitosa | `{ success: true, totalProducts, created, updated, errors }` |
| `error` | Error durante sync | `{ success: false, message }` |

## Consideraciones de Rendimiento

1. **Batch de actualizaciones**: En lugar de actualizar el estado por cada producto, actualizar por página
2. **Throttle en frontend**: Si hay muchas actualizaciones, usar throttle para no re-renderizar constantemente
3. **Timeout**: Configurar timeout adecuado en Nginx y Express
4. **Memory**: Para miles de productos, procesar en batches y liberar memoria

```typescript
// Backend: Procesar en batches de 100
const BATCH_SIZE = 100;
for (let i = 0; i < products.length; i += BATCH_SIZE) {
  const batch = products.slice(i, i + BATCH_SIZE);
  await Promise.all(batch.map(p => processProduct(p)));
}
```
