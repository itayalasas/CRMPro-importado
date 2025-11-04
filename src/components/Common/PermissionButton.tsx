import { ReactNode, ButtonHTMLAttributes } from 'react';
import { usePermissions, ModuleKey, Permission } from '../../hooks/usePermissions';

interface PermissionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  module: ModuleKey;
  permission: Permission;
  showTooltipWhenDisabled?: boolean;
  disabledMessage?: string;
  children: ReactNode;
}

export function PermissionButton({
  module,
  permission,
  showTooltipWhenDisabled = true,
  disabledMessage = 'No tienes permisos para realizar esta acción',
  children,
  className = '',
  ...buttonProps
}: PermissionButtonProps) {
  const { hasPermission } = usePermissions();
  const hasAccess = hasPermission(module, permission);

  if (!hasAccess) {
    if (!showTooltipWhenDisabled) {
      return null;
    }

    return (
      <div className="relative group inline-block">
        <button
          {...buttonProps}
          disabled={true}
          className={`${className} opacity-50 cursor-not-allowed`}
        >
          {children}
        </button>
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
          {disabledMessage}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900"></div>
        </div>
      </div>
    );
  }

  return (
    <button {...buttonProps} className={className}>
      {children}
    </button>
  );
}
