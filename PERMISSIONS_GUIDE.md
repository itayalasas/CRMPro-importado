# Guía del Sistema de Permisos

Este documento explica cómo funciona el sistema de permisos basado en roles y cómo implementarlo en los módulos de la aplicación.

## Estructura de Permisos

Los permisos vienen del sistema de autenticación externo en el JWT token y tienen la siguiente estructura:

```json
{
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

## Módulos y Keys de Permisos

| Módulo UI | Module Key | Descripción |
|-----------|-----------|-------------|
| Dashboard | `dashboard` | Panel principal |
| Clientes | `clientes` | Gestión de clientes |
| Campañas | `campanas` | Campañas de marketing |
| Órdenes | `ordenes` | Gestión de pedidos |
| Facturas | `facturas` | Facturación |
| Contabilidad | `contabilidad` | Contabilidad y comisiones |
| Llamadas | `llamadas` | Sistema de llamadas |
| Tickets | `tickets` | Soporte técnico |
| Buzón | `buzon` | Correos electrónicos |
| Validación Ext. | `validacion_ext` | Validación externa |
| Parámetros | `parametros` | Parámetros del sistema |
| Configuración | `configuracion` | Configuración general |

## Tipos de Permisos

- **`read`**: Ver/Leer información del módulo
- **`create`**: Crear nuevos registros
- **`update`**: Editar registros existentes
- **`delete`**: Eliminar registros

## Hook: usePermissions()

El hook `usePermissions` proporciona funciones para verificar permisos:

```typescript
import { usePermissions } from '../../hooks/usePermissions';

const {
  hasPermission,
  canRead,
  canCreate,
  canUpdate,
  canDelete,
  hasModuleAccess
} = usePermissions();
```

### Funciones Disponibles

#### `hasPermission(module, permission)`
Verifica si el usuario tiene un permiso específico en un módulo.

```typescript
const canEditClient = hasPermission('clientes', 'update');
```

#### `canRead(module)` / `canCreate(module)` / `canUpdate(module)` / `canDelete(module)`
Atajos para verificar permisos específicos.

```typescript
const canViewClients = canRead('clientes');
const canAddClient = canCreate('clientes');
```

#### `hasModuleAccess(module)`
Verifica si el usuario tiene cualquier permiso en el módulo (útil para mostrar/ocultar módulos completos).

```typescript
const showClientsModule = hasModuleAccess('clientes');
```

## Componentes de Control de Permisos

### PermissionGate

Controla la visibilidad de componentes según permisos.

```tsx
import { PermissionGate } from '../Common/PermissionGate';

// Mostrar botón solo si puede crear
<PermissionGate module="clientes" permission="create">
  <button onClick={handleCreate}>
    <Plus className="w-4 h-4" />
    Nuevo Cliente
  </button>
</PermissionGate>

// Requerir múltiples permisos (cualquiera)
<PermissionGate
  module="clientes"
  permission={['update', 'delete']}
>
  <div>Acciones de edición</div>
</PermissionGate>

// Requerir múltiples permisos (todos)
<PermissionGate
  module="clientes"
  permission={['update', 'delete']}
  requireAll={true}
>
  <div>Solo si tiene ambos permisos</div>
</PermissionGate>

// Con fallback
<PermissionGate
  module="clientes"
  permission="create"
  fallback={<p>No tienes permisos para crear</p>}
>
  <button>Crear</button>
</PermissionGate>
```

### ModuleGate

Controla el acceso a módulos completos.

```tsx
import { ModuleGate } from '../Common/PermissionGate';

<ModuleGate module="clientes">
  <ClientsModule />
</ModuleGate>
```

## Ejemplos de Implementación

### 1. Botones de Acción en una Tabla

```tsx
import { usePermissions } from '../../hooks/usePermissions';
import { PermissionGate } from '../Common/PermissionGate';

function ClientsTable() {
  const { canUpdate, canDelete } = usePermissions();

  return (
    <table>
      <tbody>
        {clients.map(client => (
          <tr key={client.id}>
            <td>{client.name}</td>
            <td>
              <div className="flex gap-2">
                <PermissionGate module="clientes" permission="update">
                  <button onClick={() => handleEdit(client)}>
                    <Edit2 className="w-4 h-4" />
                  </button>
                </PermissionGate>

                <PermissionGate module="clientes" permission="delete">
                  <button onClick={() => handleDelete(client.id)}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </PermissionGate>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### 2. Botón de Crear

```tsx
import { PermissionGate } from '../Common/PermissionGate';

function ClientsModule() {
  return (
    <div>
      <div className="flex justify-between">
        <h1>Clientes</h1>

        <PermissionGate module="clientes" permission="create">
          <button onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4" />
            Nuevo Cliente
          </button>
        </PermissionGate>
      </div>

      {/* Resto del módulo */}
    </div>
  );
}
```

### 3. Deshabilitar Campos en Formularios

```tsx
import { usePermissions } from '../../hooks/usePermissions';

function ClientForm({ client }) {
  const { canUpdate } = usePermissions();
  const isEditing = !!client?.id;
  const canEdit = !isEditing || canUpdate('clientes');

  return (
    <form>
      <input
        type="text"
        disabled={!canEdit}
        value={formData.name}
        onChange={e => setFormData({...formData, name: e.target.value})}
      />

      <PermissionGate
        module="clientes"
        permission={isEditing ? 'update' : 'create'}
      >
        <button type="submit">
          {isEditing ? 'Actualizar' : 'Crear'}
        </button>
      </PermissionGate>
    </form>
  );
}
```

### 4. Lógica Condicional

```tsx
import { usePermissions } from '../../hooks/usePermissions';

function ClientsModule() {
  const { canDelete } = usePermissions();

  const handleRowClick = (client) => {
    if (canDelete('clientes')) {
      // Permitir selección para eliminación
      setSelectedClients(prev => [...prev, client.id]);
    } else {
      // Solo ver detalles
      showClientDetails(client);
    }
  };

  return (
    <div>
      {/* contenido */}
    </div>
  );
}
```

### 5. Navegación Basada en Permisos

```tsx
import { usePermissions } from '../../hooks/usePermissions';

function Navigation() {
  const { hasModuleAccess } = usePermissions();

  return (
    <nav>
      {hasModuleAccess('dashboard') && (
        <NavLink to="/dashboard">Dashboard</NavLink>
      )}
      {hasModuleAccess('clientes') && (
        <NavLink to="/clients">Clientes</NavLink>
      )}
      {hasModuleAccess('facturas') && (
        <NavLink to="/invoices">Facturas</NavLink>
      )}
    </nav>
  );
}
```

## Sidebar Automático

El Sidebar ya está configurado para filtrar automáticamente los módulos según los permisos del usuario. No necesitas hacer cambios adicionales en el Sidebar.

## Buenas Prácticas

1. **Siempre verificar permisos en el frontend Y backend**: El frontend mejora la UX, pero la seguridad real está en el backend.

2. **Usar PermissionGate para UI**: Es más declarativo y fácil de mantener que lógica condicional.

3. **Combinar con disabled**: Para mejor UX, a veces es mejor mostrar el botón deshabilitado con un tooltip.

```tsx
<PermissionGate
  module="clientes"
  permission="delete"
  fallback={
    <button disabled title="No tienes permiso para eliminar">
      <Trash2 className="w-4 h-4" />
    </button>
  }
>
  <button onClick={handleDelete}>
    <Trash2 className="w-4 h-4" />
  </button>
</PermissionGate>
```

4. **Permisos granulares**: Usa los 4 tipos de permisos (create, read, update, delete) para control fino.

5. **Fallbacks informativos**: Cuando ocultas funcionalidad, considera mostrar un mensaje al usuario.

## Testing de Permisos

Para probar diferentes niveles de permisos, el sistema de autenticación externo debe devolver diferentes configuraciones de permisos en el JWT.

Ejemplo de usuario con permisos limitados:

```json
{
  "permissions": {
    "dashboard": ["read"],
    "clientes": ["read"],
    "facturas": ["read"],
    "tickets": ["create", "read", "update"]
  }
}
```

Este usuario solo podría:
- Ver el dashboard, clientes y facturas (sin editar)
- Ver, crear y editar tickets (pero no eliminar)
- No vería los otros módulos en el menú
