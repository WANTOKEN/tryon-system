import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AdminUser, UserRole } from '../types';
import { PERMISSIONS } from '../types';

interface AuthState {
  token: string | null;
  user: AdminUser | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: AdminUser) => void;
  setToken: (token: string) => void;
  logout: () => void;
  // 权限检查方法
  isSuperAdmin: () => boolean;
  isMerchantAdmin: () => boolean;
  getRole: () => UserRole | null;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  getMerchantId: () => string | null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      setAuth: (token, user) => {
        set({ token, user, isAuthenticated: true });
      },

      // 仅写入 token（登录后、拉取用户信息前调用，确保后续请求带上 Authorization）
      setToken: (token) => {
        set({ token, isAuthenticated: false });
      },

      logout: () => {
        set({ token: null, user: null, isAuthenticated: false });
      },

      // 是否是超级管理员
      isSuperAdmin: () => {
        const { user } = get();
        return user?.is_superuser === true || user?.role === 'super_admin';
      },

      // 是否是商家管理员
      isMerchantAdmin: () => {
        const { user } = get();
        return user?.role === 'merchant_admin';
      },

      // 获取用户角色
      getRole: () => {
        const { user } = get();
        return user?.role ?? null;
      },

      // 检查是否有某个权限
      hasPermission: (permission: string) => {
        const { user } = get();
        if (!user) return false;
        // 超管拥有所有权限
        if (user.is_superuser || user.role === 'super_admin') return true;
        // 商家管理员自动拥有基础权限
        if (user.role === 'merchant_admin') {
          const merchantAdminPermissions = [
            'clothing_view',
            'clothing_manage',
            'tryon_view',
            'tryon_manage',
            'file_view',
          ];
          if (merchantAdminPermissions.includes(permission)) return true;
        }
        // 检查权限列表
        return user.permissions?.includes(permission) ?? false;
      },

      // 检查是否有任意一个权限
      hasAnyPermission: (permissions: string[]) => {
        const { user } = get();
        if (!user) return false;
        // 超管拥有所有权限
        if (user.is_superuser || user.role === 'super_admin') return true;
        // 空权限数组表示所有人可访问
        if (permissions.length === 0) return true;
        // 商家管理员自动拥有基础权限
        if (user.role === 'merchant_admin') {
          const merchantAdminPermissions = [
            'clothing_view',
            'clothing_manage',
            'tryon_view',
            'tryon_manage',
            'file_view',
          ];
          if (permissions.some(p => merchantAdminPermissions.includes(p))) return true;
        }
        // 检查权限列表
        return permissions.some(p => user.permissions?.includes(p) ?? false);
      },

      // 获取商家ID（商家管理员专用）
      getMerchantId: () => {
        const { user } = get();
        return user?.merchant_id ?? null;
      },
    }),
    {
      name: 'admin-auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// 初始化函数 - 在应用启动时调用
export const initAuth = () => {
  const storageData = localStorage.getItem('admin-auth-storage');
  if (storageData) {
    try {
      const parsed = JSON.parse(storageData);
      if (parsed.state?.token) {
        useAuthStore.setState({
          token: parsed.state.token,
          user: parsed.state.user,
          isAuthenticated: true,
        });
      }
    } catch {
      // ignore
    }
  }
};

// 导出权限常量方便使用
export { PERMISSIONS };