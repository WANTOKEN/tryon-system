import { usePermission } from '../hooks/usePermission';
import type { ReactNode } from 'react';

interface PermissionGuardProps {
  children: ReactNode;
  permissions?: string[];
  superAdminOnly?: boolean;
  merchantAdminOnly?: boolean;
  fallback?: ReactNode;
}

export function PermissionGuard({
  children,
  permissions = [],
  superAdminOnly = false,
  merchantAdminOnly = false,
  fallback = null,
}: PermissionGuardProps) {
  const { isSuperAdmin, isMerchantAdmin, hasAnyPermission } = usePermission();

  // 超管专属权限
  if (superAdminOnly && !isSuperAdmin) {
    return <>{fallback}</>;
  }

  // 商家管理员专属权限
  if (merchantAdminOnly && !isMerchantAdmin) {
    return <>{fallback}</>;
  }

  // 权限检查
  if (permissions.length > 0 && !hasAnyPermission(permissions)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
