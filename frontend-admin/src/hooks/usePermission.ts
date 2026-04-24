import { useAuthStore } from '../stores/authStore';
import { PERMISSIONS } from '../types';
import type { UserRole } from '../types';

/**
 * 权限管理 Hook
 * 提供便捷的权限检查方法
 */
export function usePermission() {
  const { 
    user, 
    isSuperAdmin, 
    isMerchantAdmin, 
    getRole, 
    hasPermission, 
    hasAnyPermission, 
    getMerchantId 
  } = useAuthStore();

  return {
    // 当前用户
    user,
    
    // 角色检查
    isSuperAdmin: isSuperAdmin(),
    isMerchantAdmin: isMerchantAdmin(),
    role: getRole(),
    
    // 商家ID（商家管理员专用）
    merchantId: getMerchantId(),
    
    // 权限检查方法
    hasPermission,
    hasAnyPermission,
    
    // 常用权限快捷检查
    can: {
      // 商家管理
      viewMerchants: hasPermission(PERMISSIONS.MERCHANT_VIEW),
      manageMerchants: hasPermission(PERMISSIONS.MERCHANT_MANAGE),
      
      // 试穿记录
      viewTryOn: hasPermission(PERMISSIONS.TRYON_VIEW),
      manageTryOn: hasPermission(PERMISSIONS.TRYON_MANAGE),
      
      // 服装管理
      viewClothing: hasPermission(PERMISSIONS.CLOTHING_VIEW),
      manageClothing: hasPermission(PERMISSIONS.CLOTHING_MANAGE),
      
      // 文件管理
      viewFiles: hasPermission(PERMISSIONS.FILE_VIEW),
      manageFiles: hasPermission(PERMISSIONS.FILE_MANAGE),
      
      // 系统设置
      systemSettings: hasPermission(PERMISSIONS.SYSTEM_SETTINGS),
      
      // 管理员管理
      viewAdmins: hasPermission(PERMISSIONS.ADMIN_VIEW),
      manageAdmins: hasPermission(PERMISSIONS.ADMIN_MANAGE),
      
      // 操作日志
      viewLogs: hasPermission(PERMISSIONS.LOG_VIEW),
    },
    
    // 是否可以执行某个操作（考虑商家数据隔离）
    canAccessMerchantData: (targetMerchantId: number): boolean => {
      // 超管可以访问所有商家数据
      if (isSuperAdmin()) return true;
      // 商家管理员只能访问自己的数据
      const myMerchantId = getMerchantId();
      return myMerchantId === targetMerchantId;
    },
  };
}

export type { UserRole };
