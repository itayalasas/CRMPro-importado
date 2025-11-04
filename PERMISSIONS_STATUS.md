# Estado de Implementación de Permisos por Módulo

## Módulos con Permisos Implementados ✅

### 1. Clientes (ClientsModule) ✅
**Archivo:** `src/components/Clients/ClientsModule.tsx`

**Permisos aplicados:**
- ✅ Botón "Nuevo Cliente" - requiere `create`
- ✅ Botón "Editar" - requiere `update`
- ✅ Botón "Eliminar" - requiere `delete`
- ✅ Botón "Guardar/Actualizar" en formulario - requiere `create` o `update`

### 2. Campañas (CampaignsModule) ✅
**Archivo:** `src/components/Campaigns/CampaignsModule.tsx`

**Permisos aplicados:**
- ✅ Botón "Nueva Campaña" - requiere `create`
- ✅ Botón "Editar Campaña" - requiere `update`
- ✅ Botón "Eliminar Campaña" - requiere `delete`
- ✅ Botón "Enviar Campaña" - requiere `update`
- ✅ Botón "Reintentar Fallidos" - requiere `update`
- ✅ Botón "Nueva Plantilla" - requiere `create`
- ✅ Botón "Editar Plantilla" - requiere `update`
- ✅ Botón "Eliminar Plantilla" - requiere `delete`
- ✅ Botón "Nuevo Grupo" - requiere `create`
- ✅ Botón "Gestionar Contactos" - requiere `update`
- ✅ Botón "Eliminar Grupo" - requiere `delete`
- ✅ Botón "Crear/Actualizar Campaña" en modal - requiere `create` o `update`
- ✅ Botón "Crear Grupo" en modal - requiere `create`

---

## Módulos Pendientes de Implementación ⏳

### 3. Órdenes (OrdersModule) ⏳
**Archivo:** `src/components/Orders/OrdersModule.tsx`

**Acciones a proteger:**
- ⏳ Botón "Nueva Orden" - requiere `create`
- ⏳ Botón "Editar Orden" - requiere `update`
- ⏳ Botón "Eliminar Orden" - requiere `delete`
- ⏳ Botón "Confirmar Orden" - requiere `update`
- ⏳ Botón "Guardar" en formulario - requiere `create` o `update`
- ⏳ Cambios de estado - requiere `update`

### 4. Facturas (InvoicesModule) ⏳
**Archivo:** `src/components/Invoices/InvoicesModule.tsx`

**Acciones a proteger:**
- ⏳ Botón "Nueva Factura" - requiere `create`
- ⏳ Botón "Editar Factura" - requiere `update`
- ⏳ Botón "Eliminar Factura" - requiere `delete`
- ⏳ Botón "Validar Factura" - requiere `update`
- ⏳ Botón "Enviar por Email" - requiere `update`
- ⏳ Botón "Guardar" en formulario - requiere `create` o `update`

### 5. Contabilidad (AccountingModule) ⏳
**Archivo:** `src/components/Accounting/AccountingModule.tsx`

**Acciones a proteger:**
- ⏳ Botón "Nuevo Registro" - requiere `create`
- ⏳ Botón "Editar" - requiere `update`
- ⏳ Botón "Eliminar" - requiere `delete`
- ⏳ Botón "Generar Reporte" - requiere `read`
- ⏳ Botón "Exportar" - requiere `read`

### 6. Llamadas (CallsModule) ⏳
**Archivo:** `src/components/Calls/CallsModule.tsx`

**Acciones a proteger:**
- ⏳ Botón "Nueva Llamada" - requiere `create`
- ⏳ Botón "Iniciar Llamada" - requiere `create`
- ⏳ Botón "Ver Detalles" - requiere `read`
- ⏳ Botón "Editar Nota" - requiere `update`
- ⏳ Botón "Eliminar Registro" - requiere `delete`

### 7. Tickets (TicketsModule) ⏳
**Archivo:** `src/components/Tickets/TicketsModule.tsx`

**Acciones a proteger:**
- ⏳ Botón "Nuevo Ticket" - requiere `create`
- ⏳ Botón "Editar Ticket" - requiere `update`
- ⏳ Botón "Eliminar Ticket" - requiere `delete`
- ⏳ Botón "Cerrar Ticket" - requiere `update`
- ⏳ Botón "Agregar Comentario" - requiere `create`
- ⏳ Botón "Guardar" en formulario - requiere `create` o `update`

### 8. Buzón (InboxModule) ⏳
**Archivo:** `src/components/Inbox/InboxModule.tsx`

**Acciones a proteger:**
- ⏳ Botón "Nuevo Email" - requiere `create`
- ⏳ Botón "Responder" - requiere `create`
- ⏳ Botón "Eliminar Email" - requiere `delete`
- ⏳ Botón "Enviar" - requiere `create`

### 9. Validación Externa (ExternalValidationModule) ⏳
**Archivo:** `src/components/Settings/ExternalValidationModule.tsx`

**Acciones a proteger:**
- ⏳ Botón "Guardar Configuración" - requiere `update`
- ⏳ Botón "Probar Conexión" - requiere `update`
- ⏳ Toggle "Activar/Desactivar" - requiere `update`

### 10. Parámetros (ParametersModule) ⏳
**Archivo:** `src/components/Settings/ParametersModule.tsx`

**Acciones a proteger:**
- ⏳ Botón "Nuevo Parámetro" - requiere `create`
- ⏳ Botón "Editar" - requiere `update`
- ⏳ Botón "Eliminar" - requiere `delete`
- ⏳ Botón "Guardar" - requiere `update`

### 11. Configuración (SettingsModule) ⏳
**Archivo:** `src/components/Settings/SettingsModule.tsx`

**Acciones a proteger:**
- ⏳ Botón "Guardar Configuración" - requiere `update`
- ⏳ Botón "Restablecer" - requiere `update`
- ⏳ Botón "Cargar Logo" - requiere `update`

### 12. Dashboard ⏳
**Archivo:** `src/components/Dashboard/DashboardModule.tsx`

**Acciones a proteger:**
- ⏳ Botones de acciones rápidas según corresponda
- ⏳ Links a otros módulos según permisos

---

## Plantilla de Implementación

Para implementar permisos en un módulo, seguir estos pasos:

### 1. Importar dependencias
```typescript
import { PermissionGate } from '../Common/PermissionGate';
import { usePermissions } from '../../hooks/usePermissions';
```

### 2. Usar el hook
```typescript
const { canCreate, canUpdate, canDelete } = usePermissions();
```

### 3. Proteger botones de crear
```typescript
<PermissionGate module="nombre_modulo" permission="create">
  <button onClick={handleCreate}>Nuevo</button>
</PermissionGate>
```

### 4. Proteger botones de editar
```typescript
<PermissionGate module="nombre_modulo" permission="update">
  <button onClick={handleEdit}>Editar</button>
</PermissionGate>
```

### 5. Proteger botones de eliminar
```typescript
<PermissionGate module="nombre_modulo" permission="delete">
  <button onClick={handleDelete}>Eliminar</button>
</PermissionGate>
```

### 6. Proteger botón de guardar en formulario
```typescript
<PermissionGate
  module="nombre_modulo"
  permission={isEditing ? 'update' : 'create'}
>
  <button type="submit">
    {isEditing ? 'Actualizar' : 'Crear'}
  </button>
</PermissionGate>
```

---

## Mapeo de Módulos

| Módulo UI | Module Key | Estado |
|-----------|-----------|--------|
| Dashboard | `dashboard` | ⏳ Pendiente |
| Clientes | `clientes` | ✅ Completado |
| Campañas | `campanas` | ✅ Completado |
| Órdenes | `ordenes` | ⏳ Pendiente |
| Facturas | `facturas` | ⏳ Pendiente |
| Contabilidad | `contabilidad` | ⏳ Pendiente |
| Llamadas | `llamadas` | ⏳ Pendiente |
| Tickets | `tickets` | ⏳ Pendiente |
| Buzón | `buzon` | ⏳ Pendiente |
| Validación Ext. | `validacion_ext` | ⏳ Pendiente |
| Parámetros | `parametros` | ⏳ Pendiente |
| Configuración | `configuracion` | ⏳ Pendiente |

---

## Progreso General

**Completados:** 2 de 12 módulos (16.7%)

**Próximo módulo recomendado:** Órdenes (OrdersModule)

---

## Testing

Para cada módulo implementado, verificar:

1. ✅ Con usuario admin (todos los permisos):
   - Todos los botones visibles
   - Todas las acciones funcionan

2. ✅ Con usuario con permisos limitados:
   - Solo botones permitidos visibles
   - Botones no permitidos ocultos

3. ✅ Con usuario sin permisos en el módulo:
   - Módulo no aparece en el sidebar
   - No puede acceder al módulo

---

## Notas

- Los permisos del frontend son solo para mejorar la UX
- La seguridad real debe implementarse en el backend
- Usar Row Level Security (RLS) en Supabase para protección adicional
- Cada módulo debe verificar permisos en sus operaciones de base de datos

---

## Referencias

- `PERMISSIONS_GUIDE.md` - Guía completa de uso
- `PERMISSIONS_MIGRATION_GUIDE.md` - Guía de migración
- `PERMISSIONS_IMPLEMENTATION_SUMMARY.md` - Resumen técnico
- `src/components/Clients/ClientsModule.tsx` - Ejemplo de referencia
- `src/components/Campaigns/CampaignsModule.tsx` - Ejemplo de referencia
