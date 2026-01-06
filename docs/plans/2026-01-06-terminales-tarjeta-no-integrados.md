# Terminales de Tarjetas no Integrados

**Fecha:** 2026-01-06
**Estado:** Aprobado

## Objetivo

Capturar datos del cupón de tarjeta cuando se paga con crédito o débito usando terminales externos (no integrados) como Posnet, Lapos, Getnet, etc.

## Modelo de Datos

### Nueva entidad: CardTerminal

```prisma
model CardTerminal {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])

  name        String   // "Posnet", "Lapos", "Getnet", etc.
  code        String   // "POSNET", "LAPOS", etc.
  isActive    Boolean  @default(true)
  isSystem    Boolean  @default(false) // true = viene precargado, no se puede borrar

  // Configuración de campos requeridos
  requiresAuthCode      Boolean @default(true)  // Nro autorización
  requiresVoucherNumber Boolean @default(true)  // Nro cupón
  requiresCardBrand     Boolean @default(false) // Visa, MC, etc.
  requiresLastFour      Boolean @default(false) // Últimos 4 dígitos
  requiresInstallments  Boolean @default(true)  // Cuotas
  requiresBatchNumber   Boolean @default(true)  // Nro de lote

  payments    Payment[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([tenantId, code])
}
```

### Cambios en Payment

```prisma
model Payment {
  // ... campos existentes ...

  // Nuevos campos para datos de cupón
  cardTerminalId    String?
  cardTerminal      CardTerminal? @relation(fields: [cardTerminalId], references: [id])
  authorizationCode String?       // Código de autorización
  voucherNumber     String?       // Número de cupón
  batchNumber       String?       // Número de lote

  // Campos existentes que ya tenemos:
  // cardBrand      String?   // Visa, Mastercard, etc.
  // cardLastFour   String?   // Últimos 4 dígitos
  // installments   Int?      // Cuotas
}
```

## Terminales Precargados (isSystem=true)

| Nombre | Código | Campos Requeridos |
|--------|--------|-------------------|
| Posnet | POSNET | Autorización, Cuotas, Lote, Cupón |
| Lapos | LAPOS | Autorización, Cuotas, Lote, Cupón |
| Payway | PAYWAY | Autorización, Cuotas, Lote, Cupón |
| Getnet | GETNET | Autorización, Cuotas, Lote, Cupón |
| Clover | CLOVER | Autorización, Cuotas, Lote, Cupón |
| NaranjaX | NARANJAX | Autorización, Cuotas, Lote, Cupón |
| Ualá | UALA | Autorización, Cuotas, Lote, Cupón |
| Viumi Macro | VIUMI | Autorización, Cuotas, Lote, Cupón |

## Flujo en el POS

1. Usuario selecciona Crédito o Débito
2. Se muestra modal "Datos del Cupón"
3. Usuario selecciona terminal del dropdown
4. Se muestran campos según configuración del terminal
5. Usuario completa campos requeridos
6. Clic en "Confirmar Pago"
7. Se registra el pago con todos los datos

### Modal de Datos del Cupón

```
┌─────────────────────────────────────────┐
│  Datos del Cupón - Crédito              │
├─────────────────────────────────────────┤
│  Terminal:     [Posnet        ▼]        │
│                                         │
│  Autorización: [____________]  *        │
│  Nro Cupón:    [____________]  *        │
│  Lote:         [____________]  *        │
│  Cuotas:       [1            ▼]  *      │
│  Marca:        [Visa         ▼]         │
│  Últimos 4:    [____]                   │
│                                         │
│  Monto: $4.500                          │
│                                         │
│  [Cancelar]          [Confirmar Pago]   │
└─────────────────────────────────────────┘
```

Campos con `*` son obligatorios según configuración del terminal.

## CRUD en Backoffice

Nueva sección: **Configuración > Terminales de Tarjetas no integrados**

### Funcionalidades:
- Listar terminales (activos e inactivos)
- Crear nueva terminal personalizada
- Editar terminal (nombre, código, campos requeridos)
- Activar/desactivar terminal
- Terminales de sistema (isSystem=true) no se pueden eliminar, solo desactivar

## Implementación

### Backend
1. `schema.prisma` - Nueva entidad + campos en Payment
2. `routes/card-terminals.ts` - CRUD completo
3. `routes/sales.ts` - Aceptar nuevos campos
4. Seed - Precargar terminales de sistema

### Frontend (POS)
1. `CardPaymentModal.tsx` - Modal datos del cupón
2. `POS.tsx` - Integrar modal

### Backoffice
1. `CardTerminals.tsx` - Página CRUD
2. Menú - Agregar entrada

### Migración
- Crear tabla CardTerminal
- Agregar campos a Payment
- Insertar terminales de sistema
