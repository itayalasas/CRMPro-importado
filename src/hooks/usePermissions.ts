import { useAuth } from '../contexts/AuthContext';

export type Permission = 'create' | 'read' | 'update' | 'delete';

export type ModuleKey =
  | 'dashboard'
  | 'clientes'
  | 'campanas'
  | 'ordenes'
  | 'facturas'
  | 'contabilidad'
  | 'llamadas'
  | 'tickets'
  | 'buzon'
  | 'validacion_ext'
  | 'parametros'
  | 'configuracion';

export interface ModulePermissions {
  [key: string]: Permission[];
}

export function usePermissions() {
  const { user } = useAuth();

  const hasPermission = (module: ModuleKey, permission: Permission): boolean => {
    if (!user?.permissions) return false;

    const modulePermissions = user.permissions[module];
    if (!modulePermissions) return false;

    return modulePermissions.includes(permission);
  };

  const hasAnyPermission = (module: ModuleKey, permissions: Permission[]): boolean => {
    return permissions.some(permission => hasPermission(module, permission));
  };

  const hasAllPermissions = (module: ModuleKey, permissions: Permission[]): boolean => {
    return permissions.every(permission => hasPermission(module, permission));
  };

  const canRead = (module: ModuleKey): boolean => {
    return hasPermission(module, 'read');
  };

  const canCreate = (module: ModuleKey): boolean => {
    return hasPermission(module, 'create');
  };

  const canUpdate = (module: ModuleKey): boolean => {
    return hasPermission(module, 'update');
  };

  const canDelete = (module: ModuleKey): boolean => {
    return hasPermission(module, 'delete');
  };

  const hasModuleAccess = (module: ModuleKey): boolean => {
    if (!user?.permissions) return false;
    const modulePermissions = user.permissions[module];
    return !!modulePermissions && modulePermissions.length > 0;
  };

  const getModulePermissions = (module: ModuleKey): Permission[] => {
    if (!user?.permissions) return [];
    return user.permissions[module] || [];
  };

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canRead,
    canCreate,
    canUpdate,
    canDelete,
    hasModuleAccess,
    getModulePermissions,
    permissions: user?.permissions || {}
  };
}
