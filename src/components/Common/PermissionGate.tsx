import { ReactNode } from 'react';
import { usePermissions, ModuleKey, Permission } from '../../hooks/usePermissions';

interface PermissionGateProps {
  module: ModuleKey;
  permission: Permission | Permission[];
  requireAll?: boolean;
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGate({
  module,
  permission,
  requireAll = false,
  fallback = null,
  children
}: PermissionGateProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  const hasAccess = (() => {
    if (Array.isArray(permission)) {
      return requireAll
        ? hasAllPermissions(module, permission)
        : hasAnyPermission(module, permission);
    }
    return hasPermission(module, permission);
  })();

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface ModuleGateProps {
  module: ModuleKey;
  fallback?: ReactNode;
  children: ReactNode;
}

export function ModuleGate({ module, fallback = null, children }: ModuleGateProps) {
  const { hasModuleAccess } = usePermissions();

  if (!hasModuleAccess(module)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
