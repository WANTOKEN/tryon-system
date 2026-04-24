import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import React from 'react';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useAuthStore, initAuth } from './stores/authStore';
import { MENU_PERMISSIONS } from './types';

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
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          // 主色调 - 使用更现代的蓝色
          colorPrimary: '#1677ff',
          // 成功色
          colorSuccess: '#52c41a',
          // 警告色
          colorWarning: '#faad14',
          // 错误色
          colorError: '#ff4d4f',
          // 信息色
          colorInfo: '#1677ff',
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
            headerBg: '#fff',
            headerHeight: 64,
            headerPadding: '0 24px',
            bodyBg: '#f5f7fa',
            siderBg: '#fff',
            triggerBg: '#f5f7fa',
          },
          // Menu 组件样式
          Menu: {
            itemBg: 'transparent',
            itemSelectedBg: '#e6f4ff',
            itemSelectedColor: '#1677ff',
            itemHoverBg: '#f5f7fa',
            subMenuItemBg: 'transparent',
            itemBorderRadius: 8,
            groupTitleColor: '#8c8c8c',
          },
          // Card 组件样式
          Card: {
            boxShadowTertiary: '0 2px 8px rgba(0, 0, 0, 0.06)',
            paddingLG: 24,
          },
          // Table 组件样式
          Table: {
            headerBg: '#fafafa',
            rowHoverBg: '#f5f7fa',
            borderColor: '#f0f0f0',
          },
          // Button 组件样式
          Button: {
            primaryShadow: '0 2px 4px rgba(22, 119, 255, 0.2)',
            defaultShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
          },
          // Input 组件样式
          Input: {
            hoverBorderColor: '#1677ff',
            activeBorderColor: '#1677ff',
          },
          // Select 组件样式
          Select: {
            optionSelectedBg: '#e6f4ff',
          },
          // Modal 组件样式
          Modal: {
            contentBg: '#fff',
            headerBg: '#fff',
          },
        },
        algorithm: [
          // 使用默认算法，保持亮色主题
        ],
      }}
    >
      <AntApp>
        <BrowserRouter>
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