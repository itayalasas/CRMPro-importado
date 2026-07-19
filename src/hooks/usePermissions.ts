import { useAuth } from '../contexts/AuthContext';

export type Permission = 'create' | 'read' | 'update' | 'delete';

export type ModuleKey =
  | 'dashboard'
  | 'clientes'
  | 'campanas'
  | 'ventas'
  | 'ordenes'
  | 'facturas'
  | 'contabilidad'
  | 'llamadas'
  | 'tickets'
  | 'buzon'
  | 'chat_web'
  | 'validacion_ext'
  | 'parametros'
  | 'configuracion';

export interface ModulePermissions {
  [key: string]: Permission[];
}

export function usePermissions() {
  const { user } = useAuth();

  const getAliasModules = (module: ModuleKey): ModuleKey[] => {
    if (module === 'ventas') {
      return ['ventas', 'ordenes', 'clientes'];
    }

    return [module];
  };

  const hasPermission = (module: ModuleKey, permission: Permission): boolean => {
    if (!user?.permissions) return false;

    return getAliasModules(module).some((moduleKey) => {
      const modulePermissions = user.permissions[moduleKey];
      return !!modulePermissions && modulePermissions.includes(permission);
    });
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
    return getAliasModules(module).some((moduleKey) => {
      const modulePermissions = user.permissions[moduleKey];
      return !!modulePermissions && modulePermissions.length > 0;
    });
  };

  const getModulePermissions = (module: ModuleKey): Permission[] => {
    if (!user?.permissions) return [];
    for (const moduleKey of getAliasModules(module)) {
      const modulePermissions = user.permissions[moduleKey];
      if (modulePermissions && modulePermissions.length > 0) {
        return modulePermissions;
      }
    }

    return [];
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
