# Guía de Migración del Sistema de Permisos

## Resumen de Cambios

El sistema de autenticación ahora incluye permisos granulares a nivel de módulo y acción, permitiendo un control más fino sobre lo que cada usuario puede hacer en la aplicación.

## Cambios en el JWT

### Formato Anterior

```json
{
  "roles": ["admin"],
  "permissions": ["manage_clients", "view_reports"]
}
```

### Formato Nuevo

```json
{
  "role": "admin",
  "permissions": {
    "dashboard": ["create", "delete", "read", "update"],
    "clientes": ["create", "delete", "read", "update"],
    "campanas": ["create", "delete", "read", "update"],
    "ordenes": ["create", "delete", "read", "update"],
    "facturas": ["create", "delete", "read", "update"],
    "contabilidad": ["create", "delete", "read", "update"],
    "llamadas": ["create", "delete", "read", "update"],
    "tickets": ["create", "delete", "read", "update"],
    "buzon": ["create", "delete", "read", "update"],
    "validacion_ext": ["create", "delete", "read", "update"],
    "parametros": ["create", "delete", "read", "update"],
    "configuracion": ["create", "delete", "read", "update"]
  }
}
```

## Cambios en las Interfaces TypeScript

### AuthUser Interface

**Antes:**
```typescript
interface AuthUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  permissions: string[];
}
```

**Después:**
```typescript
interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: ModulePermissions;
}

interface ModulePermissions {
  [key: string]: string[];
}
```

## Nuevos Archivos y Componentes

### 1. Hook: usePermissions
**Ubicación:** `src/hooks/usePermissions.ts`

Proporciona funciones para verificar permisos:
- `hasPermission(module, permission)` - Verificar un permiso específico
- `canRead(module)` - Verificar permiso de lectura
- `canCreate(module)` - Verificar permiso de creación
- `canUpdate(module)` - Verificar permiso de actualización
- `canDelete(module)` - Verificar permiso de eliminación
- `hasModuleAccess(module)` - Verificar acceso al módulo

### 2. Componente: PermissionGate
**Ubicación:** `src/components/Common/PermissionGate.tsx`

Componente para controlar la visibilidad de elementos según permisos.

**Uso:**
```tsx
<PermissionGate module="clientes" permission="create">
  <button>Crear Cliente</button>
</PermissionGate>
```

### 3. Componente: ModuleGate
**Ubicación:** `src/components/Common/PermissionGate.tsx`

Componente para controlar el acceso a módulos completos.

**Uso:**
```tsx
<ModuleGate module="clientes">
  <ClientsModule />
</ModuleGate>
```

### 4. Componente: PermissionButton
**Ubicación:** `src/components/Common/PermissionButton.tsx`

Botón inteligente que se deshabilita y muestra un tooltip cuando el usuario no tiene permisos.

**Uso:**
```tsx
<PermissionButton
  module="clientes"
  permission="delete"
  onClick={handleDelete}
  className="btn-danger"
  disabledMessage="No tienes permiso para eliminar clientes"
>
  Eliminar
</PermissionButton>
```

## Mapeo de Módulos

| ID Módulo UI | Module Key (Permisos) | Descripción |
|-------------|----------------------|-------------|
| dashboard | `dashboard` | Panel principal |
| clients | `clientes` | Gestión de clientes |
| campaigns | `campanas` | Campañas de marketing |
| orders | `ordenes` | Gestión de pedidos |
| invoices | `facturas` | Facturación |
| accounting | `contabilidad` | Contabilidad |
| calls | `llamadas` | Sistema de llamadas |
| tickets | `tickets` | Soporte técnico |
| inbox | `buzon` | Correos electrónicos |
| validation | `validacion_ext` | Validación externa |
| parameters | `parametros` | Parámetros del sistema |
| settings | `configuracion` | Configuración |

## Cómo Migrar un Módulo Existente

### Paso 1: Importar los hooks y componentes

```typescript
import { usePermissions } from '../../hooks/usePermissions';
import { PermissionGate } from '../Common/PermissionGate';
```

### Paso 2: Usar el hook en el componente

```typescript
function MyModule() {
  const { canCreate, canUpdate, canDelete } = usePermissions();

  // Tu código...
}
```

### Paso 3: Proteger botones de acción

**Botón de Crear:**
```tsx
<PermissionGate module="clientes" permission="create">
  <button onClick={handleCreate}>
    <Plus className="w-4 h-4" />
    Nuevo
  </button>
</PermissionGate>
```

**Botones de Editar/Eliminar:**
```tsx
<PermissionGate module="clientes" permission="update">
  <button onClick={() => handleEdit(item)}>
    <Edit2 className="w-4 h-4" />
    Editar
  </button>
</PermissionGate>

<PermissionGate module="clientes" permission="delete">
  <button onClick={() => handleDelete(item.id)}>
    <Trash2 className="w-4 h-4" />
    Eliminar
  </button>
</PermissionGate>
```

### Paso 4: Proteger formularios

```tsx
<PermissionGate
  module="clientes"
  permission={isEditing ? 'update' : 'create'}
>
  <button type="submit">
    {isEditing ? 'Actualizar' : 'Crear'}
  </button>
</PermissionGate>
```

## Ejemplo Completo: Migración del Módulo de Clientes

### Antes
```tsx
export function ClientsModule() {
  return (
    <div>
      <button onClick={() => setShowModal(true)}>
        Nuevo Cliente
      </button>

      {clients.map(client => (
        <div key={client.id}>
          <button onClick={() => handleEdit(client)}>Editar</button>
          <button onClick={() => handleDelete(client.id)}>Eliminar</button>
        </div>
      ))}
    </div>
  );
}
```

### Después
```tsx
import { PermissionGate } from '../Common/PermissionGate';
import { usePermissions } from '../../hooks/usePermissions';

export function ClientsModule() {
  const { canCreate, canUpdate, canDelete } = usePermissions();

  return (
    <div>
      <PermissionGate module="clientes" permission="create">
        <button onClick={() => setShowModal(true)}>
          Nuevo Cliente
        </button>
      </PermissionGate>

      {clients.map(client => (
        <div key={client.id}>
          <PermissionGate module="clientes" permission="update">
            <button onClick={() => handleEdit(client)}>Editar</button>
          </PermissionGate>

          <PermissionGate module="clientes" permission="delete">
            <button onClick={() => handleDelete(client.id)}>Eliminar</button>
          </PermissionGate>
        </div>
      ))}
    </div>
  );
}
```

## Sidebar Automático

El Sidebar ya está actualizado y filtra automáticamente los módulos según los permisos del usuario. No se requiere acción adicional.

## Testing

Para probar diferentes niveles de permisos, el sistema de autenticación debe retornar diferentes configuraciones en el JWT.

### Usuario Admin (acceso completo)
```json
{
  "permissions": {
    "dashboard": ["create", "delete", "read", "update"],
    "clientes": ["create", "delete", "read", "update"],
    // ... todos los módulos con todos los permisos
  }
}
```

### Usuario con permisos limitados
```json
{
  "permissions": {
    "dashboard": ["read"],
    "clientes": ["read"],
    "tickets": ["create", "read", "update"]
  }
}
```

En este ejemplo, el usuario solo podría:
- Ver el dashboard (sin crear/editar/eliminar)
- Ver clientes (sin crear/editar/eliminar)
- Crear, ver y editar tickets (pero no eliminar)
- No vería ningún otro módulo

## Buenas Prácticas

1. **Siempre proteger en frontend y backend**: Los controles del frontend mejoran la UX, pero la seguridad real está en el backend.

2. **Usar nombres consistentes**: Usar siempre las mismas claves de módulo definidas en `ModuleKey`.

3. **Permisos granulares**: Aprovechar los 4 tipos de permisos para control fino.

4. **Feedback al usuario**: Cuando ocultas funcionalidad, considera mostrar por qué (tooltip, mensaje, etc.).

5. **Testing exhaustivo**: Probar con diferentes combinaciones de permisos.

## Checklist de Migración

Para cada módulo que migres:

- [ ] Importar `usePermissions` y `PermissionGate`
- [ ] Proteger botón de "Crear/Nuevo"
- [ ] Proteger botones de "Editar" en listados/tarjetas
- [ ] Proteger botones de "Eliminar" en listados/tarjetas
- [ ] Proteger botón de "Guardar/Actualizar" en formularios
- [ ] Proteger cualquier acción especial (exportar, importar, etc.)
- [ ] Probar con usuario con permisos limitados
- [ ] Verificar que no hay errores en consola

## Soporte

Para más información, consulta:
- `PERMISSIONS_GUIDE.md` - Guía completa de uso
- `src/hooks/usePermissions.ts` - Implementación del hook
- `src/components/Common/PermissionGate.tsx` - Componentes de control
- `src/components/Clients/ClientsModule.tsx` - Ejemplo de implementación
