import { useState, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Dropdown, Avatar, Button, theme, Badge, Tag, App, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  ShoppingOutlined,
  FileImageOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  TeamOutlined,
  AuditOutlined,
  BellOutlined,
  QuestionCircleOutlined,
  ShopOutlined,
  PieChartOutlined,
  CloudUploadOutlined,
  HistoryOutlined,
  MonitorOutlined,
  BulbOutlined,
  MoonOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import { PERMISSIONS } from '../types';
import { useTheme, BRAND_PRIMARY, BRAND_PRIMARY_DARK } from '../hooks/useTheme';
import BrandLogo from '../components/BrandLogo';

const { Header, Sider, Content } = Layout;

// 扩展菜单项类型，添加 requiredPermissions 属性
interface MenuItemWithPermission {
  key?: string;
  icon?: React.ReactNode;
  label?: React.ReactNode;
  type?: 'divider' | 'group';
  requiredPermissions?: string[];
  children?: MenuItemWithPermission[];
  danger?: boolean;
  onClick?: () => void;
}

// 超级管理员菜单
const superAdminMenuItems: MenuItemWithPermission[] = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: '仪表盘',
  },
  {
    key: '/merchants',
    icon: <ShopOutlined />,
    label: '商家管理',
    requiredPermissions: [PERMISSIONS.MERCHANT_VIEW],
  },
  {
    key: '/tryon-records',
    icon: <ShoppingOutlined />,
    label: '试穿记录',
    requiredPermissions: [PERMISSIONS.TRYON_VIEW],
  },
  {
    key: '/clothing',
    icon: <FileImageOutlined />,
    label: '服装管理',
    requiredPermissions: [PERMISSIONS.CLOTHING_VIEW],
  },
  {
    key: '/model-photos',
    icon: <UserOutlined />,
    label: '模特管理',
    requiredPermissions: [PERMISSIONS.CLOTHING_VIEW],
  },
  {
    key: '/files',
    icon: <FileImageOutlined />,
    label: '文件管理',
    requiredPermissions: [PERMISSIONS.FILE_VIEW],
  },
  {
    type: 'divider',
  },
  {
    key: 'security',
    icon: <AuditOutlined />,
    label: '权限与安全',
    requiredPermissions: [PERMISSIONS.ADMIN_VIEW],
    children: [
      {
        key: '/admin-users',
        icon: <TeamOutlined />,
        label: '管理员管理',
        requiredPermissions: [PERMISSIONS.ADMIN_VIEW],
      },
      {
        key: '/operation-logs',
        icon: <AuditOutlined />,
        label: '操作日志',
        requiredPermissions: [PERMISSIONS.LOG_VIEW],
      },
    ],
  },
  {
    key: '/system-monitor',
    icon: <MonitorOutlined />,
    label: '系统监控',
    requiredPermissions: [PERMISSIONS.SUPER_ADMIN],
  },
  {
    key: '/settings',
    icon: <SettingOutlined />,
    label: '系统设置',
    requiredPermissions: [PERMISSIONS.SYSTEM_SETTINGS],
  },
];

// 商家专用菜单
const merchantMenuItems: MenuItemWithPermission[] = [
  {
    key: '/dashboard',
    icon: <PieChartOutlined />,
    label: '数据概览',
  },
  {
    key: '/clothing',
    icon: <CloudUploadOutlined />,
    label: '服装管理',
  },
  {
    key: '/model-photos',
    icon: <UserOutlined />,
    label: '模特管理',
  },
  {
    key: '/tryon-records',
    icon: <HistoryOutlined />,
    label: '试穿记录',
  },
];

// 过滤菜单项的函数
function filterMenuByPermissions(
  items: MenuItemWithPermission[],
  hasAnyPermission: (permissions: string[]) => boolean
): MenuProps['items'] {
  const filtered = items.filter((item) => {
    if (!item || item.type === 'divider') return true;
    const { requiredPermissions } = item;
    // 没有权限要求的菜单项对所有人可见
    if (!requiredPermissions || requiredPermissions.length === 0) return true;
    return hasAnyPermission(requiredPermissions);
  });

  return filtered.map((item) => {
    if (item && 'children' in item && item.children) {
      const { requiredPermissions: _, ...rest } = item;
      return {
        ...rest,
        children: filterMenuByPermissions(item.children, hasAnyPermission),
      };
    }
    // 移除 requiredPermissions 属性，确保返回类型兼容
    const { requiredPermissions: _, ...rest } = item;
    return rest;
  }) as MenuProps['items'];
}

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isSuperAdmin, hasAnyPermission } = useAuthStore();
  const { message } = App.useApp();
  const { mode, toggleMode } = useTheme();
  const { token: { colorBgContainer, colorPrimary, colorBorderSecondary, colorText } } = theme.useToken();

  // 管理端固定品牌金单色系（与 logo 统一），亮/暗取对应主色
  const primaryColor = mode === 'dark' ? BRAND_PRIMARY_DARK : BRAND_PRIMARY;

  // 根据用户角色和权限过滤菜单
  const menuItems = useMemo(() => {
    // 商家使用专用菜单，超管使用完整菜单
    const baseItems = isSuperAdmin() ? superAdminMenuItems : merchantMenuItems;
    return filterMenuByPermissions(baseItems, hasAnyPermission);
  }, [isSuperAdmin, hasAnyPermission]);

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    navigate(e.key);
  };

  const handleLogout = () => {
    logout();
    message.success('已退出登录');
    navigate('/login');
  };

  // 角色标签
  const roleTag = isSuperAdmin() 
    ? <Tag color="red">超管</Tag> 
    : <Tag color="blue">商家</Tag>;

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={220}
        collapsedWidth={80}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          background: colorBgContainer,
          borderRight: `1px solid ${colorBorderSecondary}`,
        }}
      >
        {/* Logo 区域 */}
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: collapsed ? 0 : 12,
            padding: collapsed ? '0 16px' : '0 24px',
            borderBottom: `1px solid ${colorBorderSecondary}`,
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}99 100%)`,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <BrandLogo size={22} />
          </div>
          {!collapsed && (
            <span style={{ fontSize: 16, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap' }}>
              {isSuperAdmin() ? '超管后台' : '商家后台'}
            </span>
          )}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={['security']}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ 
            borderRight: 0, 
            marginTop: 8,
            padding: '0 8px',
          }}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 220, transition: 'margin-left 0.2s' }}>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${colorBorderSecondary}`,
            position: 'sticky',
            top: 0,
            zIndex: 10,
            height: 64,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ 
                fontSize: 16,
                width: 40,
                height: 40,
                borderRadius: 8,
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* 明暗模式切换 */}
            <Tooltip title={mode === 'dark' ? '切换到亮色' : '切换到暗色'}>
              <Button
                type="text"
                icon={mode === 'dark' ? <BulbOutlined style={{ fontSize: 16 }} /> : <MoonOutlined style={{ fontSize: 16 }} />}
                onClick={toggleMode}
                style={{ width: 40, height: 40, borderRadius: 8 }}
                aria-label="明暗模式"
              />
            </Tooltip>
            {/* 帮助按钮 */}
            <Button
              type="text"
              icon={<QuestionCircleOutlined style={{ fontSize: 16 }} />}
              style={{ width: 40, height: 40, borderRadius: 8 }}
            />
            {/* 通知按钮 */}
            <Badge count={0} size="small">
              <Button
                type="text"
                icon={<BellOutlined style={{ fontSize: 16 }} />}
                style={{ width: 40, height: 40, borderRadius: 8 }}
              />
            </Badge>
            {/* 用户下拉菜单 */}
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
              <div 
                style={{ 
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 8,
                  padding: '4px 12px',
                  borderRadius: 8,
                  transition: 'background 0.2s',
                }}
                className="user-dropdown-trigger"
              >
                <Avatar 
                  icon={<UserOutlined />} 
                  size={32}
                  style={{ backgroundColor: colorPrimary }}
                />
                <span style={{ fontWeight: 500, color: colorText }}>{user?.username || '管理员'}</span>
                {roleTag}
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content
          style={{
            margin: 24,
            padding: 24,
            background: colorBgContainer,
            borderRadius: 12,
            minHeight: 'calc(100vh - 112px)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}