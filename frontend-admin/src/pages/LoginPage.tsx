import { useState } from 'react';
import { Form, Input, Button, Checkbox, App, Modal, Space, Typography } from 'antd';
import { UserOutlined, LockOutlined, PhoneOutlined, WechatOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import { useAuthStore } from '../stores/authStore';
import BrandLogo from '../components/BrandLogo';

const { Text } = Typography;

interface LoginForm {
  username: string;
  password: string;
  remember?: boolean;
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [adminContact, setAdminContact] = useState<{
    name?: string;
    phone?: string;
    wechat?: string;
    email?: string;
  }>({});
  const navigate = useNavigate();
  const { setAuth, setToken } = useAuthStore();
  const { message } = App.useApp();

  const fetchAdminContact = async () => {
    try {
      const response = await fetch('/api/v1/common/admin-contact/');
      const data = await response.json();
      if (data.success) {
        setAdminContact(data.data || {});
      }
    } catch (error) {
      console.error('Failed to fetch admin contact:', error);
    }
  };

  const showContactModal = () => {
    fetchAdminContact();
    setContactModalVisible(true);
  };

  const maskPhone = (phone: string) => {
    if (!phone || phone.length < 7) return phone;
    return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
  };

  const maskWechat = (wechat: string) => {
    if (!wechat || wechat.length < 4) return wechat;
    return `${wechat.slice(0, 2)}***${wechat.slice(-2)}`;
  };

  const maskEmail = (email: string) => {
    if (!email || !email.includes('@')) return email;
    const [name, domain] = email.split('@');
    return `${name.slice(0, 2)}***@${domain}`;
  };

  const onFinish = async (values: LoginForm) => {
    setLoading(true);
    try {
      // 直接发送密码（后端不支持 RSA 加密）
      const response = await authApi.login(values.username, values.password);

      // 先持久化 token，确保接下来获取用户信息的 /me 请求带上 Authorization
      setToken(response.access_token);

      // 登录成功后获取用户信息
      const userInfo = await authApi.getCurrentUser();
      
      // 使用 /auth/me/ 返回的真实角色，否则超管会被降级成商家而无法访问后台菜单
      const adminUser = {
        ...userInfo,
        role: (userInfo.role ?? 'merchant_admin') as typeof userInfo.role,
        is_superuser: userInfo.is_superuser ?? false,
        merchant_id: userInfo.id,
      };
      
      setAuth(response.access_token, adminUser);
      message.success('登录成功');
      navigate('/dashboard');
    } catch (error) {
      // 处理各种错误格式
      let errorMessage = '登录失败，请检查用户名和密码';
      
      if (error && typeof error === 'object') {
        const err = error as {
          response?: {
            status?: number;
            data?: { message?: string; detail?: string };
          };
          message?: string;
        };
        
        // 优先使用后端返回的错误信息
        if (err.response?.data?.detail) {
          errorMessage = err.response.data.detail;
        } else if (err.response?.data?.message) {
          errorMessage = err.response.data.message;
        } else if (err.message) {
          errorMessage = err.message;
        }
        
        // 根据状态码提供更友好的提示
        if (err.response?.status === 403) {
          errorMessage = err.response?.data?.detail || '无管理员权限，请联系管理员开通';
          showContactModal();
        } else if (err.response?.status === 401) {
          errorMessage = err.response?.data?.detail || '用户名或密码错误';
        }
      }
      
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* 左侧装饰区域 */}
      <div className="login-left">
        <div className="login-left-content">
          <div className="login-logo">
            <div className="logo-icon">
              <BrandLogo size={28} />
            </div>
            <h1>AI Virtual Try-On</h1>
          </div>
          <h2>智能试穿管理平台</h2>
          <p>一站式 AI 虚拟试穿解决方案，为您的服装业务赋能</p>
          
          <div className="feature-list">
            <div className="feature-item">
              <div className="feature-icon">🎯</div>
              <div className="feature-text">
                <h3>精准试穿</h3>
                <p>AI 驱动的高精度虚拟试穿体验</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">⚡</div>
              <div className="feature-text">
                <h3>高效处理</h3>
                <p>秒级响应，批量处理能力</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">📊</div>
              <div className="feature-text">
                <h3>数据分析</h3>
                <p>全面的数据统计与分析报告</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* 装饰性背景元素 */}
        <div className="decoration-circles">
          <div className="circle circle-1"></div>
          <div className="circle circle-2"></div>
          <div className="circle circle-3"></div>
        </div>
      </div>
      
      {/* 右侧登录表单区域 */}
      <div className="login-right">
        <div className="login-form-wrapper">
          <div className="login-header">
            <h2>欢迎回来</h2>
            <p>请登录您的管理员账户</p>
          </div>
          
          <Form
            name="login"
            onFinish={onFinish}
            autoComplete="off"
            size="large"
            initialValues={{ remember: true }}
            className="login-form"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="用户名"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="密码"
              />
            </Form.Item>

            <Form.Item>
              <div className="form-options">
                <Form.Item name="remember" valuePropName="checked" noStyle>
                  <Checkbox>记住我</Checkbox>
                </Form.Item>
                <a className="forgot-link" href="#">忘记密码？</a>
              </div>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                className="login-button"
              >
                登 录
              </Button>
            </Form.Item>
          </Form>
          
          <div className="login-footer">
            <p>© 2024 AI Virtual Try-On. All rights reserved.</p>
          </div>
        </div>
      </div>
      
      <style>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          background: #f5f7fa;
        }
        
        /* 左侧装饰区域 */
        .login-left {
          flex: 1;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
          position: relative;
          overflow: hidden;
        }
        
        .login-left-content {
          position: relative;
          z-index: 2;
          color: white;
          max-width: 480px;
        }
        
        .login-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }
        
        .logo-icon {
          width: 48px;
          height: 48px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(10px);
        }
        
        .logo-icon svg {
          width: 28px;
          height: 28px;
          color: white;
        }
        
        .login-logo h1 {
          font-size: 24px;
          font-weight: 700;
          margin: 0;
          letter-spacing: 0.5px;
        }
        
        .login-left-content h2 {
          font-size: 36px;
          font-weight: 700;
          margin: 0 0 16px 0;
          line-height: 1.2;
        }
        
        .login-left-content > p {
          font-size: 16px;
          opacity: 0.9;
          margin: 0 0 48px 0;
          line-height: 1.6;
        }
        
        .feature-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        .feature-item {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          background: rgba(255, 255, 255, 0.1);
          padding: 16px 20px;
          border-radius: 12px;
          backdrop-filter: blur(10px);
          transition: transform 0.3s ease, background 0.3s ease;
        }
        
        .feature-item:hover {
          transform: translateX(8px);
          background: rgba(255, 255, 255, 0.15);
        }
        
        .feature-icon {
          font-size: 24px;
          line-height: 1;
        }
        
        .feature-text h3 {
          font-size: 15px;
          font-weight: 600;
          margin: 0 0 4px 0;
        }
        
        .feature-text p {
          font-size: 13px;
          opacity: 0.85;
          margin: 0;
        }
        
        /* 装饰性圆圈 */
        .decoration-circles {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        
        .circle {
          position: absolute;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
        }
        
        .circle-1 {
          width: 300px;
          height: 300px;
          top: -100px;
          right: -100px;
        }
        
        .circle-2 {
          width: 200px;
          height: 200px;
          bottom: 10%;
          left: -50px;
        }
        
        .circle-3 {
          width: 150px;
          height: 150px;
          bottom: -50px;
          right: 20%;
        }
        
        /* 右侧登录表单区域 */
        .login-right {
          width: 480px;
          min-width: 480px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
          background: white;
        }
        
        .login-form-wrapper {
          width: 100%;
          max-width: 360px;
        }
        
        .login-header {
          text-align: center;
          margin-bottom: 40px;
        }
        
        .login-header h2 {
          font-size: 28px;
          font-weight: 700;
          color: #1a1a2e;
          margin: 0 0 8px 0;
        }
        
        .login-header p {
          font-size: 15px;
          color: #6b7280;
          margin: 0;
        }
        
        .login-form .ant-input-affix-wrapper {
          height: 48px;
          border-radius: 10px;
          border: 1.5px solid #e5e7eb;
          background: #f9fafb;
          transition: all 0.3s ease;
        }
        
        .login-form .ant-input-affix-wrapper:hover,
        .login-form .ant-input-affix-wrapper:focus,
        .login-form .ant-input-affix-wrapper-focused {
          border-color: #667eea;
          background: white;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        .login-form .ant-input {
          background: transparent;
        }
        
        .login-form .ant-input-prefix {
          color: #9ca3af;
          margin-right: 12px;
        }
        
        .form-options {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .form-options .ant-checkbox-wrapper {
          color: #6b7280;
        }
        
        .forgot-link {
          color: #667eea;
          font-size: 14px;
          transition: color 0.3s ease;
        }
        
        .forgot-link:hover {
          color: #764ba2;
        }
        
        .login-button {
          height: 52px;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 600;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
          transition: all 0.3s ease;
        }
        
        .login-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
        }
        
        .login-button:active {
          transform: translateY(0);
        }
        
        .login-footer {
          text-align: center;
          margin-top: 32px;
        }
        
        .login-footer p {
          font-size: 13px;
          color: #9ca3af;
          margin: 0;
        }
        
        /* 响应式设计 */
        @media (max-width: 900px) {
          .login-left {
            display: none;
          }
          
          .login-right {
            width: 100%;
            min-width: auto;
          }
        }
        
        @media (max-width: 480px) {
          .login-right {
            padding: 24px;
          }
          
          .login-header h2 {
            font-size: 24px;
          }
        }
      `}</style>
      
      <Modal
        title="联系管理员"
        open={contactModalVisible}
        onCancel={() => setContactModalVisible(false)}
        footer={null}
        width={400}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">如需开通管理后台权限，请联系管理员</Text>
        </div>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {adminContact.name && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <UserOutlined style={{ fontSize: 20, color: '#667eea' }} />
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>管理员</Text>
                <br />
                <Text strong>{adminContact.name}</Text>
              </div>
            </div>
          )}
          {adminContact.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <PhoneOutlined style={{ fontSize: 20, color: '#667eea' }} />
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>手机号</Text>
                <br />
                <Text strong>{maskPhone(adminContact.phone)}</Text>
              </div>
            </div>
          )}
          {adminContact.wechat && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <WechatOutlined style={{ fontSize: 20, color: '#667eea' }} />
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>微信号</Text>
                <br />
                <Text strong>{maskWechat(adminContact.wechat)}</Text>
              </div>
            </div>
          )}
          {adminContact.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <MailOutlined style={{ fontSize: 20, color: '#667eea' }} />
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>邮箱</Text>
                <br />
                <Text strong>{maskEmail(adminContact.email)}</Text>
              </div>
            </div>
          )}
          {!adminContact.phone && !adminContact.wechat && !adminContact.email && (
            <Text type="secondary">暂无联系方式</Text>
          )}
        </Space>
      </Modal>
    </div>
  );
}