import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import React from 'react';
import { ConfigProvider, App as AntApp, theme as antdTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useAuthStore, initAuth } from './stores/authStore';
import { MENU_PERMISSIONS, PERMISSIONS } from './types';
import { useTheme } from './hooks/useTheme';

import AdminLayout from './layouts/AdminLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MerchantsPage from './pages/MerchantsPage';
import TryOnRecordsPage from './pages/TryOnRecordsPage';
import ClothingPage from './pages/ClothingPage';
import FilesPage from './pages/FilesPage';
import SettingsPage from './pages/SettingsPage';
import AdminUsersPage from './pages/AdminUsersPage';
import OperationLogsPage from './pages/OperationLogsPage';
import SystemMonitorPage from './pages/SystemMonitorPage';
import ModelPhotosPage from './pages/ModelPhotosPage';

// 初始化认证状态
initAuth();

// 认证守卫
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// 权限守卫
function PermissionRoute({ 
  children, 
  requiredPermissions 
}: { 
  children: React.ReactNode; 
  requiredPermissions: string[];
}) {
  const { hasAnyPermission, isSuperAdmin } = useAuthStore();

  // 超管拥有所有权限
  if (isSuperAdmin()) {
    return <>{children}</>;
  }

  // 检查权限
  if (!hasAnyPermission(requiredPermissions)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function App() {
  const { mode, current } = useTheme();
  const isDark = mode === 'dark';

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        cssVar: true,
        token: {
          // 主色调跟随主题色系（亮/暗分别取主色与暗色主色）
          colorPrimary: isDark ? current.primaryDark : current.primary,
          colorInfo: isDark ? current.primaryDark : current.primary,
          // 成功色
          colorSuccess: '#52c41a',
          // 警告色
          colorWarning: '#faad14',
          // 错误色
          colorError: '#ff4d4f',
          // 圆角
          borderRadius: 8,
          borderRadiusLG: 12,
          borderRadiusSM: 6,
          // 字体
          fontSize: 14,
          fontSizeLG: 16,
          fontSizeSM: 12,
          // 间距
          padding: 16,
          paddingLG: 24,
          paddingSM: 12,
          paddingXS: 8,
          // 阴影
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          boxShadowSecondary: '0 4px 12px rgba(0, 0, 0, 0.1)',
        },
        components: {
          // Layout 组件样式
          Layout: {
            headerBg: 'var(--ant-color-bg-container)',
            headerHeight: 64,
            headerPadding: '0 24px',
            bodyBg: 'var(--ant-color-bg-layout)',
            siderBg: 'var(--ant-color-bg-container)',
            triggerBg: 'var(--ant-color-bg-layout)',
          },
          // Menu 组件样式
          Menu: {
            itemBg: 'transparent',
            itemSelectedBg: 'var(--ant-color-primary-bg)',
            itemSelectedColor: isDark ? current.primaryDark : current.primary,
            itemHoverBg: 'var(--ant-color-primary-bg-hover)',
            subMenuItemBg: 'transparent',
            itemBorderRadius: 8,
            groupTitleColor: 'var(--ant-color-text-tertiary)',
          },
          // Card 组件样式
          Card: {
            boxShadowTertiary: '0 2px 8px rgba(0, 0, 0, 0.06)',
            paddingLG: 24,
          },
          // Table 组件样式
          Table: {
            headerBg: 'var(--ant-color-fill-quaternary)',
            rowHoverBg: 'var(--ant-color-primary-bg-hover)',
            borderColor: 'var(--ant-color-border)',
          },
          // Button 组件样式
          Button: {
            primaryShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
            defaultShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
          },
          // Input 组件样式
          Input: {
            hoverBorderColor: isDark ? current.primaryDark : current.primary,
            activeBorderColor: isDark ? current.primaryDark : current.primary,
          },
          // Select 组件样式
          Select: {
            optionSelectedBg: 'var(--ant-color-primary-bg)',
          },
          // Modal 组件样式
          Modal: {
            contentBg: 'var(--ant-color-bg-elevated)',
            headerBg: 'var(--ant-color-bg-elevated)',
          },
        },
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      }}
    >
      <AntApp>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            {/* 公开路由 */}
            <Route path="/login" element={<LoginPage />} />

            {/* 受保护的管理后台路由 */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              {/* 仪表盘 - 所有人可访问 */}
              <Route path="dashboard" element={<DashboardPage />} />
              {/* 商家管理 - 仅超管 */}
              <Route 
                path="merchants" 
                element={
                  <PermissionRoute requiredPermissions={MENU_PERMISSIONS['/merchants']}>
                    <MerchantsPage />
                  </PermissionRoute>
                } 
              />
              {/* 试穿记录 */}
              <Route 
                path="tryon-records" 
                element={
                  <PermissionRoute requiredPermissions={MENU_PERMISSIONS['/tryon-records']}>
                    <TryOnRecordsPage />
                  </PermissionRoute>
                } 
              />
              {/* 服装管理 */}
              <Route 
                path="clothing" 
                element={
                  <PermissionRoute requiredPermissions={MENU_PERMISSIONS['/clothing']}>
                    <ClothingPage />
                  </PermissionRoute>
                } 
              />
              {/* 模特照片管理 */}
              <Route 
                path="model-photos" 
                element={
                  <PermissionRoute requiredPermissions={MENU_PERMISSIONS['/clothing']}>
                    <ModelPhotosPage />
                  </PermissionRoute>
                } 
              />
              {/* 文件管理 */}
              <Route 
                path="files" 
                element={
                  <PermissionRoute requiredPermissions={MENU_PERMISSIONS['/files']}>
                    <FilesPage />
                  </PermissionRoute>
                } 
              />
              {/* 管理员管理 - 仅超管 */}
              <Route 
                path="admin-users" 
                element={
                  <PermissionRoute requiredPermissions={MENU_PERMISSIONS['/admin-users']}>
                    <AdminUsersPage />
                  </PermissionRoute>
                } 
              />
              {/* 操作日志 - 仅超管 */}
              <Route 
                path="operation-logs" 
                element={
                  <PermissionRoute requiredPermissions={MENU_PERMISSIONS['/operation-logs']}>
                    <OperationLogsPage />
                  </PermissionRoute>
                } 
              />
              {/* 系统监控 - 仅超管 */}
              <Route 
                path="system-monitor" 
                element={
                  <PermissionRoute requiredPermissions={[PERMISSIONS.SUPER_ADMIN]}>
                    <SystemMonitorPage />
                  </PermissionRoute>
                } 
              />
              {/* 系统设置 - 仅超管 */}
              <Route 
                path="settings" 
                element={
                  <PermissionRoute requiredPermissions={MENU_PERMISSIONS['/settings']}>
                    <SettingsPage />
                  </PermissionRoute>
                } 
              />
            </Route>

            {/* 404 重定向 */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}

export default App;